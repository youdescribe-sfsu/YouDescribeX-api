// xiao1009 Controller for POST /api/refine/suggest (RefineAD).
//
// All validation here is written out by hand. The DTO decorators in refine.dto.ts never execute,
// because this repo wires no validationMiddleware, so this file is the only thing standing between a
// malformed request and the database or the model. It follows audioClips.controller.ts:57-62, which
// also returns `res.status(400).json({ message })` directly rather than throwing.
import { NextFunction, Request, Response } from 'express';
import { REFINE_MAX_CLIPS } from '../dtos/refine.dto';
import { IUser } from '../models/mongodb/User.mongo';
import { REFINE_PRESET_IDS, getRefinePreset } from '../prompts/refinePresets';
import RefineService from '../services/refine.service';
import { AuthenticationError } from '../utils/customErrors';
import { logger } from '../utils/logger';

// xiao1009 Upper bounds on what a client may send. These are not business rules, they are a cheap
// guard: the free-text box is a single-line input, and a clip description that long cannot be a real
// one. Without them, one request could push an arbitrary amount of text into a paid model call.
export const MAX_INSTRUCTION_CHARS = 500;
export const MAX_CURRENT_TEXT_CHARS = 5000;

// xiao1009 Treats null, undefined, a non-string and a whitespace-only string all as "not provided",
// which is what every check below actually cares about.
const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim().length === 0;

class RefineController {
  public refineService = new RefineService();

  public suggest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // xiao1009 authMiddleware already rejects an anonymous request with 401; this repeats the check
      // the way audioClips.controller.ts:135-137 does, so the controller is still safe if the route
      // is ever mounted without the middleware.
      const userData = req.user as unknown as IUser;
      if (!userData) {
        throw new AuthenticationError('User not logged in');
      }

      const { audioDescriptionId, clips, presetId, instruction } = req.body;

      if (isBlank(audioDescriptionId)) {
        return res.status(400).json({ message: 'audioDescriptionId is required' });
      }

      if (!Array.isArray(clips) || clips.length === 0) {
        return res.status(400).json({ message: 'clips must be a non-empty array' });
      }

      // xiao1009 v1 is deliberately one clip per request, so a batch cannot sneak in through the API
      // before the UI and the word-budget logic are ready for it.
      if (clips.length !== REFINE_MAX_CLIPS) {
        return res.status(400).json({ message: `clips must contain exactly ${REFINE_MAX_CLIPS} item, received ${clips.length}` });
      }

      const [clip] = clips;

      if (!clip || isBlank(clip.clipId)) {
        return res.status(400).json({ message: 'clips[0].clipId is required' });
      }

      if (isBlank(clip.currentText)) {
        return res.status(400).json({ message: 'clips[0].currentText is required' });
      }

      if (clip.currentText.length > MAX_CURRENT_TEXT_CHARS) {
        return res.status(400).json({ message: `clips[0].currentText must be at most ${MAX_CURRENT_TEXT_CHARS} characters` });
      }

      // xiao1009 Either is enough, both together means "apply this preset, plus this extra request",
      // but neither leaves the model with nothing to do.
      if (isBlank(presetId) && isBlank(instruction)) {
        return res.status(400).json({ message: 'Either presetId or instruction is required' });
      }

      if (!isBlank(presetId) && !getRefinePreset(presetId)) {
        return res.status(400).json({ message: `Unknown presetId "${presetId}". Valid values: ${REFINE_PRESET_IDS.join(', ')}` });
      }

      if (!isBlank(instruction) && instruction.length > MAX_INSTRUCTION_CHARS) {
        return res.status(400).json({ message: `instruction must be at most ${MAX_INSTRUCTION_CHARS} characters` });
      }

      const result = await this.refineService.getSuggestion({
        audioDescriptionId,
        userId: userData._id,
        clipId: clip.clipId,
        currentText: clip.currentText,
        presetId: isBlank(presetId) ? undefined : presetId.trim(),
        instruction: isBlank(instruction) ? undefined : instruction.trim(),
      });

      res.status(200).json(result);
    } catch (error) {
      // xiao1009 The text itself is never logged here either; the service already logged the request
      // with its requestId, which is what ties a user report back to a log line.
      logger.error(`Refine suggest controller error: ${error?.message}`);
      next(error);
    }
  };
}

export default RefineController;
