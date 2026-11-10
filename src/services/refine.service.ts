// xiao1009 RefineAD: turns one clip plus a preset or a free-text request into one AI suggestion.
// This service is READ-ONLY by design: it never writes to the database and never calls TTS. Accepting
// a suggestion goes through the existing clip-update endpoint, exactly as a manual edit does.
//
// Written against the most recent service in this repo, audioDescriptionsRating.service.ts, which is
// mongodb-only and does not branch on CURRENT_DATABASE; older services such as notes.service.ts:16-71
// still carry a postgres branch. RefineAD has no postgres path.
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RefineSuggestResponseDto, RefineSuggestionDto, RefineTimingChangeDto } from '../dtos/refine.dto';
import { HttpException } from '../exceptions/HttpException';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoDialog_Timestamps_Model, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { REFINE_SYSTEM_PROMPT, buildRefineUserPrompt } from '../prompts/refine.prompt';
import { REFINE_PRESET_IDS, RefinePreset, getRefinePreset } from '../prompts/refinePresets';
import { AuthorizationError } from '../utils/customErrors';
import { callLlmChat } from '../utils/llm.util';
import { logger } from '../utils/logger';
import { MOVE_WINDOW_SECONDS, PlaybackType, TimeInterval, TimingPlan, planTiming } from '../utils/refineTiming.util';

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

/** Leijie Floor for the LENGTH LIMIT, so a one- or two-word original still gets a usable target. */
export const MIN_LENGTH_LIMIT = 1;

/** Leijie Reported as `model` when Fix timing answered from its rules alone, without calling the LLM. */
export const RULES_ONLY_MODEL = 'none';

// Leijie The description_type value the editor stores for a description of on-screen text.
export const TEXT_ON_SCREEN_TYPE = 'Text on Screen';

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
  videoGenre?: string;
  availableSeconds?: number;
  wordBudget?: number;
  // Leijie Read by Fix timing only.
  playbackType: PlaybackType;
  clipDuration?: number;
  savedText?: string;
  videoId: string;
  videoDuration?: number;
  otherClips: TimeInterval[];
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

    if (preset?.timing) return this.fixTiming(requestId, input, preset, context);

    // Leijie Too short to restyle: answer unchanged without calling the model. Checked after the
    // ownership check, so it never answers for a clip the caller does not own.
    if (preset?.minWords && this.countWords(input.currentText) < preset.minWords) {
      logger.info(`[refine ${requestId}] clip: ${input.clipId}, ad: ${input.audioDescriptionId}, preset: ${preset.id}, skipped: too short`);
      return {
        requestId,
        model: RULES_ONLY_MODEL,
        suggestions: [
          {
            clipId: input.clipId,
            original: input.currentText,
            suggestion: input.currentText.trim(),
            unchanged: true,
            reason: preset.tooShortReason,
          },
        ],
      };
    }

    // Leijie Every text preset gets a length limit from the original's word count and never sees the
    // time budget; buildClipContext still computes it, for the log. Fix timing has its own gap rules
    // (refineTiming.util.ts). A free-text request has no preset and so no limit.
    const lengthBase = preset?.requiresInstruction ? `${input.currentText} ${input.instruction || ''}` : input.currentText;
    const lengthLimit = preset ? this.computeLengthLimit(lengthBase, preset.lengthRatio, preset.minExtraWords) : undefined;

    const userPrompt = buildRefineUserPrompt({
      currentText: input.currentText,
      videoTitle: context.videoTitle,
      videoGenre: context.videoGenre,
      descriptionType: context.descriptionType,
      previousText: context.previousText,
      nextText: context.nextText,
      lengthLimit,
      presetInstruction: preset?.instruction,
      userInstruction: input.instruction,
    });

    // xiao1009 Decision 8A of refinead-v1-options.md: log the request, never the text. No clip text,
    // no instruction and no suggestion goes into the daily log files.
    logger.info(
      `[refine ${requestId}] clip: ${input.clipId}, ad: ${input.audioDescriptionId}, preset: ${input.presetId || 'none'}, freeText: ${Boolean(
        input.instruction,
      )}, availableSeconds: ${context.availableSeconds ?? 'n/a'}, lengthLimit: ${lengthLimit ?? 'n/a'}`,
    );

    const completion = await callLlmChat({ systemPrompt: REFINE_SYSTEM_PROMPT, userPrompt, temperature: preset?.temperature });
    const suggestion = this.cleanSuggestion(completion.text, input.currentText, requestId);

    return {
      requestId,
      model: completion.model,
      suggestions: [
        {
          clipId: input.clipId,
          original: input.currentText,
          suggestion,
          // Leijie Returning the description unchanged is a valid answer, so the panel can say so.
          unchanged: suggestion === input.currentText.trim(),
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
      videoGenre: video?.category || undefined,
      availableSeconds,
      wordBudget: availableSeconds != null ? this.computeWordBudget(availableSeconds) : undefined,
      playbackType: clip.playback_type === 'extended' ? 'extended' : 'inline',
      clipDuration: clip.duration > 0 ? clip.duration : undefined,
      savedText: this.readClipText(clip),
      videoId: audioDescription.video,
      videoDuration: video?.duration,
      otherClips: clips
        .filter((_, i) => i !== index)
        .filter(other => other.start_time != null && other.end_time != null)
        .map(other => ({ start: other.start_time, end: other.end_time })),
    };
  }

  /**
   * Leijie Fix timing. The rules pick the strategy; only "shorten" calls the model. Never writes
   * anything: a suggested start time or playback type is returned for the describer to apply in the
   * editor, and it is saved together with the clip, like any manual edit.
   */
  private async fixTiming(
    requestId: string,
    input: RefineSuggestionInput,
    preset: RefinePreset,
    context: RefineClipContext,
  ): Promise<RefineSuggestResponseDto> {
    const currentText = input.currentText.trim();
    const wordCount = this.countWords(currentText);

    // Leijie The TTS duration is exact, but only for the text that was saved. Unsaved edits are estimated.
    const estimatedSeconds = context.clipDuration != null && context.savedText === currentText ? context.clipDuration : wordCount / SPEECH_WORDS_PER_SECOND;

    const dialogs = await MongoDialog_Timestamps_Model.find({ video: context.videoId }).exec();

    const plan = planTiming({
      clipStart: context.startTime,
      estimatedSeconds,
      wordCount,
      playbackType: context.playbackType,
      dialogs: dialogs.map(dialog => ({ start: dialog.dialog_start_time, end: dialog.dialog_end_time })),
      otherClips: context.otherClips,
      videoDuration: context.videoDuration,
      wordsPerSecond: SPEECH_WORDS_PER_SECOND,
      minWordBudget: MIN_WORD_BUDGET,
      // Leijie On-screen text is kept word for word (core constraint 7), so it can only move or pause.
      canShorten: context.descriptionType !== TEXT_ON_SCREEN_TYPE,
    });

    logger.info(
      `[refine ${requestId}] clip: ${input.clipId}, ad: ${input.audioDescriptionId}, preset: ${preset.id}, plan: ${
        plan.kind
      }, estimatedSeconds: ${estimatedSeconds.toFixed(2)}, availableSeconds: ${plan.availableSeconds}`,
    );

    const timing = {
      estimatedSeconds: Math.round(estimatedSeconds * 100) / 100,
      availableSeconds: Number.isFinite(plan.availableSeconds) ? Math.round(plan.availableSeconds * 100) / 100 : undefined,
    };
    const base: Omit<RefineSuggestionDto, 'suggestion' | 'unchanged'> = { clipId: input.clipId, original: input.currentText, timing };

    if (plan.kind !== 'shorten') {
      return {
        requestId,
        model: RULES_ONLY_MODEL,
        suggestions: [
          {
            ...base,
            suggestion: currentText,
            unchanged: true,
            timingChange: this.timingChangeFor(plan, context.playbackType),
            reason: this.timingReason(plan, timing.estimatedSeconds, timing.availableSeconds, context.descriptionType === TEXT_ON_SCREEN_TYPE),
          },
        ],
      };
    }

    const userPrompt = buildRefineUserPrompt({
      currentText: input.currentText,
      videoTitle: context.videoTitle,
      videoGenre: context.videoGenre,
      descriptionType: context.descriptionType,
      previousText: context.previousText,
      nextText: context.nextText,
      availableSeconds: plan.availableSeconds,
      lengthLimit: plan.wordBudget,
      presetInstruction: preset.instruction,
      userInstruction: input.instruction,
    });

    const completion = await callLlmChat({ systemPrompt: REFINE_SYSTEM_PROMPT, userPrompt, temperature: preset.temperature });
    const suggestion = this.cleanSuggestion(completion.text, input.currentText, requestId);

    // Leijie Decision 7: a reply that misses the budget is an error, not retried.
    const suggestionWords = this.countWords(suggestion);
    if (suggestionWords > plan.wordBudget) {
      logger.error(`[refine ${requestId}] fix-timing reply over budget: ${suggestionWords} words, allowed ${plan.wordBudget}`);
      throw new HttpException(502, 'The AI could not shorten the description enough. Please try again.');
    }

    return {
      requestId,
      model: completion.model,
      suggestions: [
        {
          ...base,
          suggestion,
          unchanged: suggestion === currentText,
          timingChange: this.timingChangeFor(plan, context.playbackType),
          reason: this.timingReason(plan, timing.estimatedSeconds, timing.availableSeconds),
        },
      ],
    };
  }

  /** Leijie The start time or playback type the describer should set, if any. */
  private timingChangeFor(plan: TimingPlan, playbackType: PlaybackType): RefineTimingChangeDto | undefined {
    switch (plan.kind) {
      case 'switch-to-inline':
        return { track: 'inline' };
      case 'move':
        return playbackType === 'extended' ? { startTime: plan.startTime, track: 'inline' } : { startTime: plan.startTime };
      case 'extended':
        return { track: 'extended' };
      case 'shorten':
        // A shortened extended clip can play inline once it fits.
        return playbackType === 'extended' ? { track: 'inline' } : undefined;
      default:
        return undefined;
    }
  }

  /** Leijie One plain sentence or two for the panel, saying what was decided and why. */
  private timingReason(plan: TimingPlan, estimatedSeconds: number, availableSeconds?: number, textOnScreen = false): string {
    const need = `about ${estimatedSeconds.toFixed(1)} s of narration`;
    const room = availableSeconds != null ? `${availableSeconds.toFixed(1)} s available` : 'no limit before the next dialogue or description';
    switch (plan.kind) {
      case 'fits':
        return `It already fits: ${need}, ${room}.`;
      case 'switch-to-inline':
        return `It fits in the gap (${need}, ${room}), so it can play inline without pausing the video.`;
      case 'shorten':
        return `Too long for the gap (${need}, ${room}). Shortened to ${plan.wordBudget} words or fewer.`;
      case 'move':
        return `Too long for the gap (${need}, ${room}), and ${
          textOnScreen ? 'on-screen text is kept word for word' : 'shortening would drop key information'
        }. Starting at ${plan.startTime.toFixed(2)} s, it fits without overlapping dialogue or another description.`;
      case 'extended':
        return `Too long for the gap (${need}, ${room}), and no free gap within ${MOVE_WINDOW_SECONDS} s. Use extended playback so the video pauses for it.`;
      default:
        return `No inline gap within ${MOVE_WINDOW_SECONDS} s is long enough (${need}), so keep extended playback.`;
    }
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
   * Leijie Word count of the original times the preset's ratio, never below the floor, and never
   * below the original plus `minExtraWords` when the preset sets it.
   */
  private computeLengthLimit(text: string, ratio: number, minExtraWords = 0): number {
    const words = this.countWords(text);
    return Math.max(MIN_LENGTH_LIMIT, Math.round(words * ratio), minExtraWords > 0 ? words + minExtraWords : 0);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
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
    if (preset.requiresInstruction && !instruction?.trim()) {
      throw new HttpException(400, `${preset.label} needs the details to add. Type them in the text box first.`);
    }
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
