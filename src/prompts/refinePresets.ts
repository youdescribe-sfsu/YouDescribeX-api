// src/prompts/refinePresets.ts

// xiao1009 Preset list for RefineAD. One entry per button the describer can press. The frontend only
// ever sends the `id`, so wording can be changed here without releasing the frontend (decision 5B in
// refinead-v1-options.md). Adding a preset = append one entry to PRESETS below, nothing else:
// the id union, the id list and the lookup helper are all derived from that array.
//
// Wording sources, copied and adapted from the AI-generated-AD repo (read-only, never modified):
//   - shorten-to-fit              : description_optimize_inline.py:235-241 (_COMPRESS_GUIDANCE) and :256-265 (compress task)
//   - simplify                    : description_optimize_inline.py:332-336 (polish/rewrite prompt)
//   - keep-onscreen-text-verbatim : description_optimize_inline.py:356-364 (_MIXED_GUIDANCE)
//   - fix-grammar                 : no AI-generated-AD source; written from the "Correction" category listed in refinead-v1-options.md:104
//
// Output-format rules ("reply with only the description text", no markdown) deliberately live in the
// system prompt (refine.prompt.ts), not here, so that every preset shares one single set of rules.

// xiao1009 `usesWordBudget` tells the prompt builder whether to include the available seconds and the
// resulting word budget for this clip. Only compression actually needs it; adding it to every preset
// would push the model to shorten text when the describer only asked to fix grammar.
export interface RefinePreset {
  id: string;
  label: string;
  usesWordBudget: boolean;
  instruction: string;
}

// xiao1009 Id convention (decision 5B): lower-case kebab-case, verb first, never renamed once shipped,
// new presets are appended. The frontend hard-codes the same ids in its own refinePresets.ts.
const PRESETS = [
  {
    id: 'shorten-to-fit',
    label: 'Shorten to fit',
    usesWordBudget: true,
    instruction:
      'Rewrite the description so that it fits the available narration time. ' +
      'Preserve all concrete visual details: colors, materials, shapes, named objects, and character actions in their original order. ' +
      "Drop only filler: vague qualifiers such as 'very' or 'really', redundant phrasing, and descriptions of a state that the action already implies. " +
      'Do not change the meaning and do not remove any factual visual detail. ' +
      'The result must be complete, grammatical sentence(s) with the same subject(s) and action(s) as the original. ' +
      'If the description already fits the available time, return it unchanged.',
  },
  {
    id: 'simplify',
    label: 'Simplify',
    usesWordBudget: false,
    instruction:
      'Rewrite the description in plainer, more direct language so that a listener understands it on first hearing. ' +
      'Keep the same meaning and all visual details. ' +
      'Prefer short sentences, everyday words and active voice over long clauses, jargon and nested descriptions. ' +
      'Do not add interpretation, opinion, or any information that is not already in the description.',
  },
  {
    id: 'fix-grammar',
    label: 'Fix grammar',
    usesWordBudget: false,
    instruction:
      'Correct only grammar, spelling, punctuation and word-order mistakes. ' +
      'Do not rephrase for style, do not shorten or expand the text, and do not change which details are mentioned. ' +
      'Leave any sentence that is already correct exactly as it is. ' +
      'If the whole description is already correct, return it unchanged.',
  },
  {
    id: 'keep-onscreen-text-verbatim',
    label: 'Keep on-screen text',
    usesWordBudget: false,
    instruction:
      'Any words that literally appear on screen must be reproduced verbatim, character for character: ' +
      'do not paraphrase, abbreviate, translate, or drop any of them, and do not wrap them in narrative phrases such as "a title card reads". ' +
      'The surrounding visual description may be tightened by dropping filler and condensing phrasing, as long as the key visual details remain. ' +
      'Do not prefix the result with labels such as "Text:", "Caption:" or "On screen:".',
  },
] as const;

// xiao1009 Derived from PRESETS, so a new entry widens the union automatically.
export type RefinePresetId = (typeof PRESETS)[number]['id'];

export const REFINE_PRESETS: readonly RefinePreset[] = PRESETS;

// xiao1009 Used by the controller to reject an unknown presetId with 400, and to name the valid ids in
// the error message.
export const REFINE_PRESET_IDS: readonly string[] = PRESETS.map(preset => preset.id);

export const getRefinePreset = (presetId: string): RefinePreset | undefined => REFINE_PRESETS.find(preset => preset.id === presetId);

export default REFINE_PRESETS;
