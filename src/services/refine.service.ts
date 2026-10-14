// xiao1009 RefineAD: turns one clip plus a preset or a free-text request into one AI suggestion.
// This service is READ-ONLY by design: it never writes to the database and never calls TTS. Accepting
// a suggestion goes through the existing clip-update endpoint, exactly as a manual edit does.
//
// Written against the most recent service in this repo, audioDescriptionsRating.service.ts, which is
// mongodb-only and does not branch on CURRENT_DATABASE; older services such as notes.service.ts:16-71
// still carry a postgres branch. RefineAD has no postgres path.
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RefineSuggestResponseDto } from '../dtos/refine.dto';
import { HttpException } from '../exceptions/HttpException';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoDialog_Timestamps_Model, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { REFINE_SYSTEM_PROMPT, buildRefineUserPrompt } from '../prompts/refine.prompt';
import { REFINE_PRESET_IDS, RefinePreset, getRefinePreset } from '../prompts/refinePresets';
import { AuthorizationError } from '../utils/customErrors';
import { callLlmChat } from '../utils/llm.util';
import { logger } from '../utils/logger';

/**
 * xiao1009 Speech rate used to turn an available time window into a word target.
 * The AI pipeline assumes 150 wpm at 1.25x playback, which is about 3 words per second
 * (AI-generated-AD/description_optimize_inline.py:50-55 and :260), and this repo's TTS also
 * synthesises at `speakingRate: 1.25` (audioClips.util.ts:190). Keeping one constant here means the
 * suggestion budget and the narration that is actually generated use the same assumption.
 */
export const SPEECH_WORDS_PER_SECOND = 3;

/**
 * xiao1009 Never ask for fewer words than this, however tight the gap is. Mirrors the floor in
 * AI-generated-AD/description_optimize_inline.py:274.
 */
export const MIN_WORD_BUDGET = 3;

/**
 * xiao1009 Guard against a model that ignores the output rules and replies with an essay, a list of
 * options, or its own commentary. A suggestion may grow, because the describer can ask for a fuller
 * sentence, but not without limit. The floor keeps very short originals from being over-constrained.
 */
export const MAX_SUGGESTION_GROWTH_FACTOR = 3;
export const MIN_SUGGESTION_CHARS_ALLOWED = 400;

// xiao1009 What the controller hands over. `currentText` is the text in the describer's edit box,
// which can differ from what the database holds, because the editor keeps unsaved edits in local
// state (EditClip.tsx:81-83). The clip is still looked up in the database, for the ownership check,
// the neighbours and the timing, but the text that gets rewritten is the one on screen.
export interface RefineSuggestionInput {
  audioDescriptionId: string;
  userId: string;
  clipId: string;
  currentText: string;
  presetId?: string;
  instruction?: string;
}

/**
 * xiao1009 Everything the prompt may need about one clip's surroundings. Deliberately a separate,
 * public type and a separate method: v2 is expected to add dialogue text, more neighbours and video
 * frames, and all of that arrives here without touching the orchestration below.
 */
export interface RefineClipContext {
  clipId: string;
  descriptionType: string;
  startTime: number;
  previousText?: string;
  nextText?: string;
  videoTitle?: string;
  availableSeconds?: number;
  wordBudget?: number;
}

class RefineService {
  /**
   * xiao1009 One suggestion for one clip. Throws, never returns an error shape: every throw below
   * carries the status that error.middleware.ts:7 turns into the HTTP response.
   */
  public async getSuggestion(input: RefineSuggestionInput): Promise<RefineSuggestResponseDto> {
    const requestId = uuidv4();
    const preset = this.resolvePreset(input.presetId, input.instruction);

    const audioDescription = await this.loadOwnedAudioDescription(input.audioDescriptionId, input.userId);
    const context = await this.buildClipContext(audioDescription, input.clipId);

    // xiao1009 Only a preset that declares usesWordBudget gets the time budget in its prompt. Handing
    // it to every preset would nudge the model into shortening text when the describer only asked to
    // fix the grammar.
    const includeWordBudget = preset?.usesWordBudget === true && context.wordBudget != null;

    const userPrompt = buildRefineUserPrompt({
      currentText: input.currentText,
      videoTitle: context.videoTitle,
      previousText: context.previousText,
      nextText: context.nextText,
      availableSeconds: includeWordBudget ? context.availableSeconds : undefined,
      wordBudget: includeWordBudget ? context.wordBudget : undefined,
      presetInstruction: preset?.instruction,
      userInstruction: input.instruction,
    });

    // xiao1009 Decision 8A of refinead-v1-options.md: log the request, never the text. No clip text,
    // no instruction and no suggestion goes into the daily log files.
    logger.info(
      `[refine ${requestId}] clip: ${input.clipId}, ad: ${input.audioDescriptionId}, preset: ${input.presetId || 'none'}, freeText: ${Boolean(
        input.instruction,
      )}, availableSeconds: ${context.availableSeconds ?? 'n/a'}, wordBudget: ${includeWordBudget ? context.wordBudget : 'n/a'}`,
    );

    const completion = await callLlmChat({ systemPrompt: REFINE_SYSTEM_PROMPT, userPrompt });
    const suggestion = this.cleanSuggestion(completion.text, input.currentText, requestId);

    return {
      requestId,
      model: completion.model,
      suggestions: [
        {
          clipId: input.clipId,
          original: input.currentText,
          suggestion,
          wordBudget: includeWordBudget ? context.wordBudget : undefined,
        },
      ],
    };
  }

  /**
   * xiao1009 Context assembly, kept separate so it can grow on its own. Everything it returns is
   * optional except the ids and the timing: a clip can be the first or the last of its description,
   * and a video row can be missing its title.
   */
  public async buildClipContext(audioDescription: IAudioDescription, clipId: string): Promise<RefineClipContext> {
    // xiao1009 Same query and sort as audioDescriptions.service.ts:74-81, so "previous" and "next"
    // mean the same thing here as they do in the editor's clip list.
    const clips = await MongoAudioClipsModel.find({ audio_description: audioDescription._id })
      .sort({
        start_time: 'asc',
        end_time: 'asc',
      })
      .exec();

    const index = clips.findIndex(clip => clip._id.toString() === clipId);
    if (index === -1) throw new HttpException(404, 'Clip not found in this audio description');

    const clip = clips[index];
    const video = await MongoVideosModel.findById(audioDescription.video).exec();
    const availableSeconds = await this.computeAvailableSeconds(clip, clips[index + 1], audioDescription.video, video?.duration);

    return {
      clipId,
      descriptionType: clip.description_type,
      startTime: clip.start_time,
      previousText: this.readClipText(clips[index - 1]),
      nextText: this.readClipText(clips[index + 1]),
      videoTitle: video?.title,
      availableSeconds,
      wordBudget: availableSeconds != null ? this.computeWordBudget(availableSeconds) : undefined,
    };
  }

  /**
   * xiao1009 How much narration time this clip really has: up to whichever comes first of the next
   * clip, the next line of dialogue, or the end of the video. Returns undefined when none of those is
   * known, in which case the prompt simply leaves the budget out rather than inventing one.
   */
  private async computeAvailableSeconds(
    clip: IAudioClip,
    nextClip: IAudioClip | undefined,
    videoId: string,
    videoDuration?: number,
  ): Promise<number | undefined> {
    // xiao1009 Same collection and time-window idea as audioClips.util.ts:241-244, narrowed to the
    // next line of dialogue that starts after this clip does.
    const nextDialog = await MongoDialog_Timestamps_Model.findOne({
      video: videoId,
      dialog_start_time: { $gt: clip.start_time },
    })
      .sort({ dialog_start_time: 'asc' })
      .exec();

    const boundaries: number[] = [];
    if (nextClip?.start_time != null) boundaries.push(nextClip.start_time);
    if (nextDialog?.dialog_start_time != null) boundaries.push(nextDialog.dialog_start_time);
    if (videoDuration != null) boundaries.push(videoDuration);

    const gap = boundaries.length > 0 ? Math.min(...boundaries) - clip.start_time : undefined;

    // xiao1009 Clips and dialogue are allowed to overlap in this data, so a boundary can sit before
    // the clip even starts. Fall back to the clip's own duration, which is what the describer already
    // recorded or was allotted, and give up rather than guess if that is missing too.
    if (gap != null && gap > 0) return gap;
    if (clip.duration > 0) return clip.duration;
    return undefined;
  }

  /** xiao1009 Seconds to a word target, floored so a very tight gap still asks for a usable sentence. */
  private computeWordBudget(availableSeconds: number): number {
    return Math.max(MIN_WORD_BUDGET, Math.round(availableSeconds * SPEECH_WORDS_PER_SECOND));
  }

  /**
   * xiao1009 A recorded clip stores its words in `transcript`, not in `description_text`; the editor
   * falls back the same way in audioDescriptions.service.ts:95. Returns undefined rather than an empty
   * string so that the prompt builder drops the section entirely.
   */
  private readClipText(clip?: IAudioClip): string | undefined {
    if (!clip) return undefined;
    const text = clip.description_text || (clip.transcript || []).map(entry => entry.sentence).join(' ');
    return text?.trim() || undefined;
  }

  /**
   * xiao1009 Rejects an unknown preset id with 400 before anything is loaded or spent on the model.
   * The controller checks this too; this is the guard the unit tests exercise, and it keeps the
   * service safe to call from anywhere else later.
   */
  private resolvePreset(presetId?: string, instruction?: string): RefinePreset | undefined {
    if (!presetId) {
      if (!instruction?.trim()) throw new HttpException(400, 'Either presetId or instruction is required');
      return undefined;
    }

    const preset = getRefinePreset(presetId);
    if (!preset) throw new HttpException(400, `Unknown presetId "${presetId}". Valid values: ${REFINE_PRESET_IDS.join(', ')}`);
    return preset;
  }

  /**
   * xiao1009 Ownership check, following audioDescriptions.service.ts:61-67: only the describer who owns
   * the description may refine its clips. AuthorizationError is what error.middleware.ts:12 turns into
   * a 403, so the status is not repeated here.
   */
  private async loadOwnedAudioDescription(audioDescriptionId: string, userId: string): Promise<IAudioDescription> {
    // xiao1009 A malformed id would make Mongoose throw a CastError, which the middleware would report
    // as a 500; the contract calls that a client mistake, so it is rejected as a 400 first.
    if (!Types.ObjectId.isValid(audioDescriptionId)) throw new HttpException(400, 'audioDescriptionId is not a valid id');

    const audioDescription = await MongoAudio_Descriptions_Model.findById(audioDescriptionId).exec();
    if (!audioDescription) throw new HttpException(404, 'Audio description not found');

    if (audioDescription.user.toString() !== userId.toString()) {
      throw new AuthorizationError('You do not have permission to refine this audio description');
    }

    return audioDescription;
  }

  /**
   * xiao1009 Last line of defence against a model that ignored the output rules: strip code fences,
   * a leading label and one layer of surrounding quotes, then refuse anything empty or implausibly
   * long. The fence stripping follows openAPI.util.ts:81-88.
   */
  private cleanSuggestion(raw: string, originalText: string, requestId: string): string {
    let text = (raw || '').trim();

    if (text.startsWith('```')) {
      text = text
        .replace(/^```[a-zA-Z]*\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
    }

    text = text.replace(/^(?:rewritten\s+)?(?:description|suggestion|output|result)\s*:\s*/i, '').trim();

    const wrappedInDoubleQuotes = text.startsWith('"') && text.endsWith('"');
    const wrappedInSingleQuotes = text.startsWith("'") && text.endsWith("'");
    if (text.length >= 2 && (wrappedInDoubleQuotes || wrappedInSingleQuotes)) {
      text = text.slice(1, -1).trim();
    }

    if (!text) {
      logger.error(`[refine ${requestId}] suggestion was empty after cleaning`);
      throw new HttpException(502, 'AI service returned an unusable suggestion');
    }

    const maxChars = Math.max(MIN_SUGGESTION_CHARS_ALLOWED, originalText.trim().length * MAX_SUGGESTION_GROWTH_FACTOR);
    if (text.length > maxChars) {
      logger.error(`[refine ${requestId}] suggestion too long: ${text.length} chars, allowed ${maxChars}`);
      throw new HttpException(502, 'AI service returned an unusable suggestion');
    }

    return text;
  }
}

export default RefineService;
