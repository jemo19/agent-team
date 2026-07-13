import test from "node:test";
import assert from "node:assert/strict";
import { parsePageSize } from "../src/pagination.mjs";
test("uses default", () => assert.equal(parsePageSize(undefined), 25));
test("accepts valid value", () => assert.equal(parsePageSize("50"), 50));
