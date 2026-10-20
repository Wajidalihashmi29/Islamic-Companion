import assert from "node:assert/strict";
import test from "node:test";
import { getRotatedSessionToken, getTokenExpiryMs } from "../src/utils/tokenUtils.ts";

const token = (claims: object) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

test("session scheduling accepts numeric JWT expiry and rejects malformed or missing expiry", () => {
  assert.equal(getTokenExpiryMs(token({ exp: 1800000000 })), 1800000000000);
  for (const value of ["invalid", token({}), token({ exp: "1800000000" }), token({ exp: null })])
    assert.equal(getTokenExpiryMs(value), null);
});

test("a refresh race keeps a valid token rotated by another request", () => {
  const validToken = token({ exp: 1800000000 });
  assert.equal(getRotatedSessionToken("old", "new", validToken, 1700000000000), validToken);
  assert.equal(getRotatedSessionToken("old", "old", validToken, 1700000000000), null);
  assert.equal(getRotatedSessionToken("old", "new", token({ exp: 1600000000 }), 1700000000000), null);
});
