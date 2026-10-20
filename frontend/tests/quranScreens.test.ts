import assert from "node:assert/strict";
import test from "node:test";
import { getAdjacentQuranPage, getAdjacentQuranReaderPage, getQuranPageScale, getQuranPageWidth, getQuranSwipeDirection, getZoomedQuranSwipeDirection, startsInSystemGestureZone } from "../src/utils/quranScreens.ts";

test("page turns wrap in both directions without changing ordinary navigation", () => {
  assert.equal(getAdjacentQuranPage(604, 1), 1);
  assert.equal(getAdjacentQuranPage(1, -1), 604);
  assert.equal(getAdjacentQuranPage(603, 1), 604);
  assert.equal(getAdjacentQuranPage(2, -1), 1);
});

test("reader navigation places completion duas after page 604 while Quran prefetch stays numeric", () => {
  assert.equal(getAdjacentQuranReaderPage(604, 1), "dua");
  assert.equal(getAdjacentQuranReaderPage("dua", 1), 1);
  assert.equal(getAdjacentQuranReaderPage(1, -1), "dua");
  assert.equal(getAdjacentQuranReaderPage("dua", -1), 604);
  assert.equal(getAdjacentQuranReaderPage(53, 1), 54);
  assert.equal(getAdjacentQuranReaderPage(53, -1), 52);
  assert.equal(getAdjacentQuranPage(604, 1), 1);
});

test("whole-page fitting includes the full paper within portrait and landscape viewports without enlarging it", () => {
  for (const [width, height] of [[720, 1600], [480, 700], [1600, 800]]) {
    for (const [availableWidth, availableHeight] of [[304, 380], [374, 650], [820, 220], [1000, 800]]) {
      const scale = getQuranPageScale(width, height, availableWidth, availableHeight);
      assert(scale > 0 && scale <= 1);
      assert(width * scale <= availableWidth + .001);
      assert(height * scale <= availableHeight + .001);
    }
  }
  assert.equal(getQuranPageScale(480, 700, 1000, 900), 1);
  assert.equal(getQuranPageScale(720, 1600, 374, 0), 0);
});

test("paper reflows to printed portrait proportions rather than the shape of the screen", () => {
  const width = getQuranPageWidth(720, 1800);
  const reflowedHeight = 720 * 1800 / width;
  assert(Math.abs(width / reflowedHeight - 210 / 297) < .02);
  for (const [availableWidth, availableHeight] of [[304, 440], [374, 730], [820, 220]]) {
    const scale = getQuranPageScale(width, reflowedHeight, availableWidth, availableHeight);
    assert(Math.abs(width * scale / (reflowedHeight * scale) - 210 / 297) < .02);
  }
  assert(getQuranPageScale(width, reflowedHeight, 374, 650) > getQuranPageScale(720, 1800, 374, 650));
  assert.equal(getQuranPageWidth(720, 100), 480);
  assert.equal(getQuranPageWidth(3200, 10000), 3200);
});

test("right swipes advance, left swipes go back, and vertical, short and long-press gestures do not turn pages", () => {
  assert.equal(getQuranSwipeDirection(100, 10, 300), 1);
  assert.equal(getQuranSwipeDirection(-100, 10, 300), -1);
  for (const [dx, dy, duration] of [[20, 0, 100], [70, 90, 100], [100, 0, 1000], [0, 100, 100]])
    assert.equal(getQuranSwipeDirection(dx, dy, duration), 0);
});

test("zoomed pages turn only for deliberate fast horizontal swipes", () => {
  assert.equal(getZoomedQuranSwipeDirection(150, 20, 300), 1);
  assert.equal(getZoomedQuranSwipeDirection(-150, 20, 300), -1);
  for (const [dx, dy, duration] of [[90, 0, 200], [150, 70, 200], [150, 0, 600], [0, 150, 200]])
    assert.equal(getZoomedQuranSwipeDirection(dx, dy, duration), 0);
});

test("phone edge and bottom navigation gestures never start Quran page turns", () => {
  const viewport = { left: 0, top: 0, width: 390, height: 844 };
  assert.equal(startsInSystemGestureZone(12, 400, viewport), true);
  assert.equal(startsInSystemGestureZone(378, 400, viewport), true);
  assert.equal(startsInSystemGestureZone(195, 820, viewport), true);
  assert.equal(startsInSystemGestureZone(80, 400, viewport), false);
  assert.equal(startsInSystemGestureZone(310, 760, viewport), false);
});

test("tall mobile paper uses the screen's portrait proportions for larger fitted text", () => {
  const aspectRatio = 386 / 840;
  const width = getQuranPageWidth(720, 1800, aspectRatio);
  const height = 720 * 1800 / width;
  assert(Math.abs(width / height - aspectRatio) < .02);
  const mobileScale = getQuranPageScale(width, height, 386, 840);
  const portraitWidth = getQuranPageWidth(720, 1800);
  const portraitScale = getQuranPageScale(portraitWidth, 720 * 1800 / portraitWidth, 386, 840);
  assert(mobileScale > portraitScale);
  assert(width * mobileScale > 380);
  assert(height * mobileScale > 820);
});
