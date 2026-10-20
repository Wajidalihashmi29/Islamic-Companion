import assert from "node:assert/strict";
import test from "node:test";
import { getFriendlyErrorMessage } from "../src/utils/friendlyError.ts";

test("offline errors explain what remains available and how to recover", () => {
  assert.equal(getFriendlyErrorMessage(new Error("technical details"), "Fallback", {
    online: false,
    offlineMessage: "This Quran page has not been downloaded yet. Reconnect once to download it.",
  }), "You're offline. This Quran page has not been downloaded yet. Reconnect once to download it.");
});

test("network and server failures do not expose technical error text", () => {
  assert.equal(getFriendlyErrorMessage({ isAxiosError: true, code: "ERR_NETWORK" }, "Fallback", { online: true }),
    "We couldn't connect to the service. Check your internet connection and try again.");
  assert.equal(getFriendlyErrorMessage({ isAxiosError: true, response: { status: 503 } }, "Fallback", { online: true }),
    "The service is temporarily unavailable. Please try again shortly.");
  assert.equal(getFriendlyErrorMessage(new Error("database connection string"), "Please try again.", { online: true }),
    "Please try again.");
});

test("timeouts and browser network failures use actionable messages", () => {
  assert.equal(getFriendlyErrorMessage(
    { isAxiosError: true, code: "ECONNABORTED", response: { status: 400 } },
    "Fallback",
    { online: true },
  ), "The request took too long. Please try again.");
  assert.equal(getFriendlyErrorMessage(
    new TypeError("Failed to fetch"),
    "Fallback",
    { online: true },
  ), "We couldn't connect to the service. Check your internet connection and try again.");
});
