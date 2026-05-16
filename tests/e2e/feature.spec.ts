import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("start as it → tag passes via QR scan", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.getByRole("button", { name: /start — I'm it/ }).click();

    await expect(b.locator(".tag-banner").first()).toContainText("alice is it");

    await b.locator(".mesh-qrx-payload summary").click();
    const bp = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await a.getByPlaceholder("or paste a mesh:// payload").fill(bp);
    await a.getByRole("button", { name: "use", exact: true }).click();

    await expect(b.locator(".tag-banner.is-it")).toBeVisible();
  } finally {
    await cleanup();
  }
});
