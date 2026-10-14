// xiao1009 Request and response shapes for POST /api/refine/suggest (RefineAD).
//
// IMPORTANT: the class-validator decorators below are documentation only, they never run. This repo
// has no validationMiddleware wired up — the only mentions of it are commented out in
// videos.route.ts:27-28 — so nothing ever turns the request body into a DTO instance or validates it.
// The real gate is the hand-written validation in refine.controller.ts. The decorators are kept
// because every other DTO in this folder has them (audioClips.dto.ts:12-23), so wiring
// validationMiddleware in later would cover this route too. Note that @ValidateNested would also
// need class-transformer, which is not a dependency of this repo.
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

// xiao1009 v1 accepts exactly one clip per request; more than one is a 400. Kept as a named constant
// because batch refinement is the first thing v2 is expected to add.
export const REFINE_MAX_CLIPS = 1;

export class RefineClipInputDto {
  @IsString()
  public clipId: string;
  @IsString()
  public currentText: string;
}

// xiao1009 presetId and instruction are both optional on their own, but the controller rejects a
// request that has neither. Sending both means "apply this preset, plus this extra request".
export class RefineSuggestDto {
  @IsString()
  public audioDescriptionId: string;
  @IsArray()
  @ValidateNested({ each: true })
  public clips: RefineClipInputDto[];
  @IsOptional()
  @IsString()
  public presetId?: string;
  @IsOptional()
  @IsString()
  public instruction?: string;
}

// xiao1009 Response shapes. `wordBudget` is only present for presets that use a time budget, so the
// panel can show "aim for about N words" next to the suggestion.
export interface RefineSuggestionDto {
  clipId: string;
  original: string;
  suggestion: string;
  wordBudget?: number;
}

export interface RefineSuggestResponseDto {
  requestId: string;
  model: string;
  suggestions: RefineSuggestionDto[];
}

// xiao1009 Every failure goes through error.middleware.ts:22, which responds with exactly this shape.
export interface RefineErrorResponseDto {
  message: string;
}
