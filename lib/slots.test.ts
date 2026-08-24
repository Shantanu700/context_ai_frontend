import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SLOT_DURATION,
  MIN_SLOT_DURATION,
  canAddAt,
  canSplitAt,
  fitNewSlot,
  placeSlot,
  splitSlot,
  trimSlot,
  type Slot,
} from "./slots";

const slot: Slot = {
  key: "id-1",
  scene: 3,
  ad: 7,
  ad_detail: null,
  at_seconds: 100,
  duration: 15,
  placement: "mid_roll",
  is_overlay: false,
  state: "accepted",
  score: 0.9,
};

test("a mid-slot cut splits the duration and keeps the creative", () => {
  const halves = splitSlot(slot, 106, 600);
  assert.ok(halves);
  const [head, tail] = halves;

  assert.equal(head.duration + tail.duration, slot.duration);
  assert.equal(head.at_seconds, 100);
  assert.equal(tail.at_seconds, 106);
  assert.notEqual(tail.key, head.key);
  // A split is one break becoming two, not a new empty slot.
  assert.equal(tail.ad, slot.ad);
  assert.equal(tail.state, slot.state);
  assert.equal(tail.score, slot.score);
});

test("a cut that would leave a stub is refused", () => {
  const tooEarly = slot.at_seconds + MIN_SLOT_DURATION / 2;
  const tooLate = slot.at_seconds + slot.duration - MIN_SLOT_DURATION / 2;

  assert.equal(splitSlot(slot, tooEarly, 600), null);
  assert.equal(splitSlot(slot, tooLate, 600), null);
  assert.equal(splitSlot(slot, 50, 600), null); // playhead outside the slot entirely
  assert.equal(canSplitAt(slot, tooEarly), false);
  assert.equal(canSplitAt(null, 106), false);
  assert.equal(canSplitAt(slot, 106), true);
});

test("the tail re-derives its placement from where it lands", () => {
  const atEnd: Slot = { ...slot, at_seconds: 580, duration: 20 };
  const halves = splitSlot(atEnd, 595, 600);
  assert.ok(halves);
  assert.equal(halves[0].placement, "mid_roll");
  assert.equal(halves[1].placement, "post_roll");
});

test("trimming the end moves only the duration", () => {
  assert.deepEqual(trimSlot([], slot, "end", 120, 600), { at_seconds: 100, duration: 20 });
});

test("trimming the start holds the end still", () => {
  const trimmed = trimSlot([], slot, "start", 105, 600);
  assert.equal(trimmed.at_seconds, 105);
  // 100 + 15 = 115, and it stays there.
  assert.equal(trimmed.at_seconds + trimmed.duration, 115);
});

test("neither edge may cross the other", () => {
  assert.equal(trimSlot([], slot, "end", 100.2, 600).duration, MIN_SLOT_DURATION);
  const start = trimSlot([], slot, "start", 999, 600);
  assert.equal(start.duration, MIN_SLOT_DURATION);
  assert.equal(start.at_seconds, 115 - MIN_SLOT_DURATION);
});

test("trimming stops at the ceiling, the video end and zero", () => {
  assert.equal(trimSlot([], slot, "end", 9999, 600).duration, MAX_SLOT_DURATION);
  // 8s of video left after this one starts, so that is all the room there is.
  const short: Slot = { ...slot, duration: 5 };
  assert.equal(trimSlot([], short, "end", 9999, 108).duration, 8);
  // One that already overhangs the end keeps its length rather than being cut down
  // to fit the instant a handle is touched.
  assert.equal(trimSlot([], slot, "end", 9999, 108).duration, 15);
  assert.equal(trimSlot([], slot, "start", -50, 600).at_seconds, 115 - MAX_SLOT_DURATION);

  const nearZero: Slot = { ...slot, at_seconds: 2, duration: 10 };
  assert.equal(trimSlot([], nearZero, "start", -50, 600).at_seconds, 0);
});

/* ---- no two slots on a lane may overlap ---- */

const before: Slot = { ...slot, key: "id-0", at_seconds: 80, duration: 10 }; // 80–90
const after: Slot = { ...slot, key: "id-2", at_seconds: 130, duration: 10 }; // 130–140
const lane = [before, slot, after]; // the middle one is 100–115

test("a slot slides until it touches its neighbour, and no further", () => {
  assert.equal(placeSlot(lane, slot, 95, 600).at_seconds, 95);
  // Dragged hard left, it stops on the end of the one before it.
  assert.equal(placeSlot(lane, slot, 10, 600).at_seconds, 90);
  // Hard right, its own end stops on the start of the one after.
  assert.equal(placeSlot(lane, slot, 500, 600).at_seconds, 130 - slot.duration);
  // Sliding never resizes.
  assert.equal(placeSlot(lane, slot, 10, 600).duration, slot.duration);
});

test("trimming stops on the neighbours too", () => {
  assert.equal(trimSlot(lane, slot, "end", 500, 600).duration, 30); // 100 -> 130
  assert.equal(trimSlot(lane, slot, "start", 0, 600).at_seconds, 90);
});

test("the other lane is not a neighbour", () => {
  // An overlay and a video break at the same second is the whole point of two lanes.
  const overlay: Slot = { ...before, key: "ov", is_overlay: true };
  assert.equal(placeSlot([overlay, slot], slot, 10, 600).at_seconds, 10);
});

test("a new slot is shortened to the gap, or refused when there is none", () => {
  const fresh: Slot = { ...slot, key: "new", at_seconds: 118, duration: 15 };
  // 115–130 is free, so 15s won't fit but 12 will.
  assert.deepEqual(
    fitNewSlot(lane, fresh, 600),
    { ...fresh, at_seconds: 118, duration: 12 },
  );
  // Dropped inside an existing slot: refused, rather than landing somewhere the
  // operator didn't point at.
  assert.equal(fitNewSlot(lane, { ...fresh, at_seconds: 105 }, 600), null);
  // A sliver of a gap is no gap.
  assert.equal(fitNewSlot(lane, { ...fresh, at_seconds: 129.5 }, 600), null);
});

test("the add buttons know when the playhead has nowhere to put a slot", () => {
  assert.equal(canAddAt(lane, 95, false, 600), true); // in the gap between 90 and 100
  assert.equal(canAddAt(lane, 105, false, 600), false); // inside the middle slot
  assert.equal(canAddAt(lane, 129.5, false, 600), false); // a sliver is not a gap
  // The lanes are independent: an overlay may start over an ad break.
  assert.equal(canAddAt(lane, 105, true, 600), true);
});
