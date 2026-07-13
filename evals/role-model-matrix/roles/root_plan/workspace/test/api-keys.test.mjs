import test from "node:test";
import assert from "node:assert/strict";
import { hashKey, verifyKey } from "../src/auth/api-keys.mjs";
test("verifies a stored hash", () => assert.equal(verifyKey("demo", hashKey("demo")), true));
