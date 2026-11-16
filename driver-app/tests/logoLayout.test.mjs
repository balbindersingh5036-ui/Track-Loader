import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLogoDimensions,
  HEADER_LOGO_WIDTH,
  HEADER_LOGO_HEIGHT
} from "../src/utils/logoHelper.mjs";

test("calculateLogoDimensions provides exact 95px width and 90px height for header logo", () => {
  assert.equal(HEADER_LOGO_WIDTH, 95);
  assert.equal(HEADER_LOGO_HEIGHT, 90);

  const dims = calculateLogoDimensions();
  assert.equal(dims.width, 95);
  assert.equal(dims.height, 90);
});

test("calculateLogoDimensions maintains exact 95px by 90px dimensions across viewports", () => {
  const breakpoints = [320, 360, 390, 412, 768, 1024, 1440];
  for (const bp of breakpoints) {
    const { width, height } = calculateLogoDimensions(bp);
    assert.equal(width, 95, `Expected width 95 at breakpoint ${bp}`);
    assert.equal(height, 90, `Expected height 90 at breakpoint ${bp}`);
  }
});

test("calculateLogoDimensions preserves aspect ratio (~1.05) without distortion", () => {
  const { width, height } = calculateLogoDimensions();
  const ratio = width / height;
  assert.ok(ratio >= 1.0 && ratio <= 1.1, `Ratio ${ratio} outside expected bounds`);
});
