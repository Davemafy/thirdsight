import { chromium } from "playwright";

const base = process.env.THIRDSIGHT_URL ?? "https://thirdsight-five.vercel.app";
const managedId = "browser:stage5-managed-browser:stage5-managed-proof";
const passiveId = "browser:commerce-lab:passive-browser:stage5-passive-proof";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.goto(base, { waitUntil: "networkidle" });
    const preventedButtons = page.locator("nav button").filter({ hasText: "PREVENTED" });
    if (await preventedButtons.count()) { ready = true; break; }
    await page.waitForTimeout(10_000);
  }
  if (!ready) throw new Error("Deployed console never exposed the persisted PREVENTED event.");

  await page.locator("nav button").filter({ hasText: "PREVENTED" }).first().click();
  await page.waitForFunction(() => document.querySelector(".action h2")?.textContent?.trim() === "PREVENTED");
  const managed = await page.locator("main").innerText();
  for (const token of ["Should?", "Could?", "Did?", "Why?", managedId, "PREVENTED", "SCOPE_DRIFT", "CONSTRAIN", "customer.phone", "Receiver got"]) {
    if (!managed.includes(token)) throw new Error(`Managed console proof missing: ${token}`);
  }
  if (!managed.includes("customer.phone at receiver") || !managed.includes("NO")) throw new Error("Managed console does not prove receiver non-receipt.");
  await page.screenshot({ path: "stage5-managed-console.png", fullPage: true });

  await page.locator("nav button").filter({ hasText: "DETECTED" }).first().click();
  await page.waitForFunction(() => document.querySelector(".action h2")?.textContent?.trim() === "DETECTED");
  const passive = await page.locator("main").innerText();
  for (const token of ["Should?", "Could?", "Did?", "Why?", passiveId, "DETECTED", "TRANSMITTED"]) {
    if (!passive.includes(token)) throw new Error(`Passive console proof missing: ${token}`);
  }
  if ((await page.locator(".action h2").innerText()).trim() === "PREVENTED") throw new Error("Passive event was mislabeled PREVENTED.");
  await page.screenshot({ path: "stage5-passive-console.png", fullPage: true });

  console.log(JSON.stringify({ managed: { recordId: managedId, outcome: "PREVENTED" }, passive: { recordId: passiveId, outcome: "DETECTED" }, verified: true }));
} finally {
  await browser.close();
}
