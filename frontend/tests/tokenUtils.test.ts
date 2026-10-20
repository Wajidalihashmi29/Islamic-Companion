import assert from "node:assert/strict";
import test from "node:test";
import { getTokenExpiryMs } from "../src/utils/tokenUtils.ts";

const token = (claims: object) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

test("session scheduling accepts numeric JWT expiry and rejects malformed or missing expiry", () => {
  assert.equal(getTokenExpiryMs(token({ exp: 1800000000 })), 1800000000000);
  for (const value of ["invalid", token({}), token({ exp: "1800000000" }), token({ exp: null })])
    assert.equal(getTokenExpiryMs(value), null);
});
