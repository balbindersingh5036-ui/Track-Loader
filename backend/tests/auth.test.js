import assert from "node:assert/strict";
import test from "node:test";

import { comparePassword, hashPassword } from "../src/utils/password.js";

test("password utility hashes passwords and verifies the original", async () => {
  const password = "valid-password";
  const hashedPassword = await hashPassword(password);

  assert.notEqual(hashedPassword, password);
  assert.equal(await comparePassword(password, hashedPassword), true);
  assert.equal(await comparePassword("incorrect-password", hashedPassword), false);
});
