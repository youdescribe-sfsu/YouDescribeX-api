// Leijie Unit tests for the Fix timing rules. Plain numbers in, a plan out: nothing to mock.
import { MOVE_WINDOW_SECONDS, TimingInputs, computeInlineGap, findMoveTarget, planTiming } from '../utils/refineTiming.util';

const baseInputs = (overrides: Partial<TimingInputs> = {}): TimingInputs => ({
  clipStart: 10,
  estimatedSeconds: 3,
  wordCount: 9,
  playbackType: 'inline',
  dialogs: [],
  otherClips: [],
  videoDuration: 60,
  wordsPerSecond: 3,
  minWordBudget: 3,
  ...overrides,
});

describe('computeInlineGap', () => {
  it('runs to the nearest of the next dialogue, the next clip and the video end', () => {
    expect(computeInlineGap(baseInputs({ dialogs: [{ start: 14, end: 16 }], otherClips: [{ start: 13, end: 15 }] }))).toBe(3);
    expect(computeInlineGap(baseInputs({ videoDuration: 12 }))).toBe(2);
  });

  it('is zero when the clip starts inside dialogue or inside another clip', () => {
    expect(computeInlineGap(baseInputs({ dialogs: [{ start: 9, end: 11 }] }))).toBe(0);
    expect(computeInlineGap(baseInputs({ otherClips: [{ start: 8, end: 10.5 }] }))).toBe(0);
  });

  it('ignores what ends before the clip starts', () => {
    expect(computeInlineGap(baseInputs({ dialogs: [{ start: 2, end: 10 }], videoDuration: 15 }))).toBe(5);
  });

  it('is unbounded when nothing follows and the video length is unknown', () => {
    expect(computeInlineGap(baseInputs({ videoDuration: undefined }))).toBe(Infinity);
  });
});

describe('findMoveTarget', () => {
  it('picks the nearest free start inside the window', () => {
    const inputs = baseInputs({
      dialogs: [{ start: 11, end: 12.5 }],
      otherClips: [
        { start: 2, end: 5 },
        { start: 20, end: 24 },
      ],
    });
    expect(findMoveTarget(inputs, 4)).toBe(12.5);
  });

  it('never moves further than the window', () => {
    // the only room is from 15 on, which is 5 s away
    const inputs = baseInputs({ dialogs: [{ start: 6, end: 15 }] });
    expect(MOVE_WINDOW_SECONDS).toBeLessThan(5);
    expect(findMoveTarget(inputs, 2)).toBeUndefined();
  });

  it('keeps the narration inside the video', () => {
    const inputs = baseInputs({ clipStart: 58, videoDuration: 60, dialogs: [{ start: 55, end: 58.5 }] });
    expect(findMoveTarget(inputs, 3)).toBeUndefined();
  });
});

describe('planTiming', () => {
  it('leaves an inline clip that fits alone', () => {
    expect(planTiming(baseInputs({ dialogs: [{ start: 14, end: 15 }] }))).toEqual({ kind: 'fits', availableSeconds: 4 });
  });

  it('suggests inline for an extended clip that fits', () => {
    expect(planTiming(baseInputs({ playbackType: 'extended', dialogs: [{ start: 14, end: 15 }] })).kind).toBe('switch-to-inline');
  });

  it('shortens when the budget keeps enough of the words', () => {
    // 2 s gap -> 6 words, 6 >= 9 x 0.6
    expect(planTiming(baseInputs({ dialogs: [{ start: 12, end: 13 }] }))).toEqual({ kind: 'shorten', availableSeconds: 2, wordBudget: 6 });
  });

  // Leijie A "Text on Screen" description is kept word for word, so it is never shortened.
  it('moves instead of shortening when the text may not be shortened', () => {
    const plan = planTiming(baseInputs({ dialogs: [{ start: 12, end: 13 }], canShorten: false }));
    expect(plan.kind).not.toBe('shorten');
  });

  it('moves instead of shortening when the budget would drop too much', () => {
    // 1 s gap -> 3 words, 3 < 9 x 0.6
    const plan = planTiming(baseInputs({ dialogs: [{ start: 11, end: 12 }] }));
    expect(plan).toEqual({ kind: 'move', availableSeconds: 1, startTime: 12 });
  });

  it('falls back to extended when there is nowhere to move', () => {
    expect(planTiming(baseInputs({ dialogs: [{ start: 5, end: 30 }] })).kind).toBe('extended');
    expect(planTiming(baseInputs({ playbackType: 'extended', dialogs: [{ start: 5, end: 30 }] })).kind).toBe('stay-extended');
  });
});
