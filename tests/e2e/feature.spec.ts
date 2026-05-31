import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * The advertised core action: "pass 'it' by scanning the next person's QR".
 *
 * The real trigger is a camera QR scan (useQRScanner → parseScanPayload). That
 * cannot be driven headless, so we drive the paste fallback in QRExchange — it
 * flows through the IDENTICAL `onScan` → `tag()` → `room.doc.transact` path, so
 * it proves the cross-mesh "it"-passing logic, not a separate stub.
 *
 * The invariant under test is single-holder consistency: exactly one peer is
 * "it" at any time. After A passes "it" to B, BOTH screens must agree B is it
 * AND A must no longer be it (no two-its, no lost-it).
 */
test("pass 'it' across the mesh: both peers agree, single holder", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.getByRole("button", { name: /start — I'm it/ }).click();

    // Before the pass: A is it, B is not — both agree on A.
    await expect(a.locator(".tag-banner.is-it")).toBeVisible();
    await expect(a.locator(".viral-status")).toContainText("alice is IT");
    await expect(b.locator(".tag-banner").first()).toContainText("alice is it");
    await expect(b.locator(".tag-banner.is-it")).toHaveCount(0);
    await expect(b.locator(".viral-status")).toContainText("alice is IT");

    // A reads B's QR payload and "scans" it (paste fallback == same onScan path).
    await b.locator(".mesh-qrx-payload summary").click();
    const bp = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    expect(bp).toContain("p="); // payload really carries bob's peerId
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(bp);
    await a.getByRole("button", { name: "use", exact: true }).click();

    // After the pass: B is now it, on B's OWN screen.
    await expect(b.locator(".tag-banner.is-it")).toBeVisible();
    await expect(b.locator(".viral-status")).toContainText("bob is IT");

    // Single-holder: A must have LOST it (the pass propagated back over the mesh).
    await expect(a.locator(".tag-banner.is-it")).toHaveCount(0);
    await expect(a.locator(".tag-banner")).toContainText("bob is it");
    await expect(a.locator(".viral-status")).toContainText("bob is IT");

    // And a non-it peer cannot pass "it" — tagging is gated on amIIt.
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(bp);
    await expect(a.getByRole("button", { name: "use", exact: true })).toBeEnabled();
    await a.getByRole("button", { name: "use", exact: true }).click();
    // Still bob — A's stale "tag" was a no-op because A is no longer it.
    await expect(b.locator(".tag-banner.is-it")).toBeVisible();
    await expect(b.locator(".viral-status")).toContainText("bob is IT");
  } finally {
    await cleanup();
  }
});
