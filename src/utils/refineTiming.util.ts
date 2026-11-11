// Leijie Fix timing (refinead-button-pipeline.md section 6.5): the rules that decide HOW a clip
// should be made to fit. Pure functions over plain numbers, no database and no model, so every branch
// of the decision is unit-testable. The LLM is only used afterwards, to shorten the text, when the
// plan says "shorten".
//
// Order of preference, as in the pipeline doc: keep it as it is > switch extended back to inline >
// shorten > move the start time > pause the video (extended).
//
// Not implemented on purpose: the F3 "is this worth pausing for" model check. It needs the dialogue
// text, and the database only stores dialogue timestamps.

/**
 * Leijie PENDING (to be confirmed): shortening is only tried when the word budget keeps at least this
 * share of the original's words; below it, shortening would drop key information.
 */
export const SHORTEN_MIN_KEEP_RATIO = 0.6;

/** Leijie PENDING (to be confirmed): how far, in seconds, a start time may move either way. */
export const MOVE_WINDOW_SECONDS = 3;

export interface TimeInterval {
  start: number;
  end: number;
}

export type PlaybackType = 'inline' | 'extended';

export interface TimingInputs {
  clipStart: number;
  estimatedSeconds: number;
  wordCount: number;
  playbackType: PlaybackType;
  dialogs: TimeInterval[];
  // Every other clip of the same description, never the clip itself.
  otherClips: TimeInterval[];
  videoDuration?: number;
  wordsPerSecond: number;
  minWordBudget: number;
  // Leijie False for a description that must stay word for word: shortening is skipped. Default true.
  canShorten?: boolean;
}

export type TimingPlan =
  | { kind: 'fits'; availableSeconds: number }
  | { kind: 'switch-to-inline'; availableSeconds: number }
  | { kind: 'shorten'; availableSeconds: number; wordBudget: number }
  | { kind: 'move'; availableSeconds: number; startTime: number }
  | { kind: 'extended'; availableSeconds: number }
  | { kind: 'stay-extended'; availableSeconds: number };

const EPSILON = 1e-6;

const round2 = (value: number): number => Math.round(value * 100) / 100;

const overlaps = (a: TimeInterval, b: TimeInterval): boolean => a.start < b.end - EPSILON && a.end > b.start + EPSILON;

/**
 * Leijie Seconds of narration room from the clip's start to whichever comes first of the next
 * dialogue, the next clip, or the end of the video. Zero when the start already sits inside dialogue
 * or inside another clip. Unlike computeAvailableSeconds in refine.service.ts, this never falls back
 * to the clip's own duration: that fallback hides exactly the conflict Fix timing is meant to find.
 * Infinity when nothing bounds the clip at all.
 */
export const computeInlineGap = (inputs: Pick<TimingInputs, 'clipStart' | 'dialogs' | 'otherClips' | 'videoDuration'>): number => {
  const { clipStart, dialogs, otherClips, videoDuration } = inputs;
  const busy = [...dialogs, ...otherClips];

  if (busy.some(interval => interval.start <= clipStart + EPSILON && interval.end > clipStart + EPSILON)) return 0;

  const boundaries = busy.map(interval => interval.start).filter(start => start > clipStart);
  if (videoDuration != null) boundaries.push(videoDuration);

  if (boundaries.length === 0) return Infinity;
  return Math.max(0, Math.min(...boundaries) - clipStart);
};

/**
 * Leijie Nearest start time within MOVE_WINDOW_SECONDS where `length` seconds of narration overlap
 * neither dialogue nor another clip and stay inside the video. Candidates are the window edges and
 * every point where a busy interval ends or where the narration would end right as one begins: if any
 * free placement exists, one of these is the closest. Returns undefined when there is none.
 */
export const findMoveTarget = (inputs: Pick<TimingInputs, 'clipStart' | 'dialogs' | 'otherClips' | 'videoDuration'>, length: number): number | undefined => {
  const { clipStart, dialogs, otherClips, videoDuration } = inputs;
  const busy = [...dialogs, ...otherClips];
  const low = Math.max(0, clipStart - MOVE_WINDOW_SECONDS);
  const high = clipStart + MOVE_WINDOW_SECONDS;

  const candidates = [low, high, ...busy.map(interval => interval.end), ...busy.map(interval => interval.start - length)];

  const isFree = (start: number): boolean => {
    if (start < low - EPSILON || start > high + EPSILON) return false;
    if (videoDuration != null && start + length > videoDuration + EPSILON) return false;
    const placed = { start, end: start + length };
    return !busy.some(interval => overlaps(placed, interval));
  };

  const free = candidates.filter(start => Math.abs(start - clipStart) > EPSILON && isFree(start));
  if (free.length === 0) return undefined;

  free.sort((a, b) => Math.abs(a - clipStart) - Math.abs(b - clipStart));
  return round2(free[0]);
};

/** Leijie The decision tree. Returns which strategy to use; the caller does the rest. */
export const planTiming = (inputs: TimingInputs): TimingPlan => {
  const availableSeconds = computeInlineGap(inputs);

  if (inputs.estimatedSeconds <= availableSeconds + EPSILON) {
    // Existing editor logic never turns an extended clip back to inline on its own
    // (audioClips.util.ts analyzePlaybackType keeps a requested "extended"), so say so here.
    return inputs.playbackType === 'extended' ? { kind: 'switch-to-inline', availableSeconds } : { kind: 'fits', availableSeconds };
  }

  const wordBudget = Math.round(availableSeconds * inputs.wordsPerSecond);
  if (inputs.canShorten !== false && wordBudget >= inputs.minWordBudget && wordBudget >= inputs.wordCount * SHORTEN_MIN_KEEP_RATIO) {
    return { kind: 'shorten', availableSeconds, wordBudget };
  }

  const startTime = findMoveTarget(inputs, inputs.estimatedSeconds);
  if (startTime != null) return { kind: 'move', availableSeconds, startTime };

  return inputs.playbackType === 'extended' ? { kind: 'stay-extended', availableSeconds } : { kind: 'extended', availableSeconds };
};
