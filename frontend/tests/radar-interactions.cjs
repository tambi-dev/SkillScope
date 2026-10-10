const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const base = process.env.SKILLSCOPE_URL || "http://127.0.0.1:8000";
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const ready = () => page.locator('.snapshot-content[aria-busy="false"]').waitFor();
    await page.goto(base);
    await ready();
    await page.getByRole("link", { name: "Explore the market" }).click();
    await page.waitForFunction(() => Math.abs(document.getElementById("workspace-start").getBoundingClientRect().top) < 2);

    const assertStableWorkspace = async (navigate) => {
      await page.evaluate(() => {
        window.workspacePositions = [];
        let remaining = 32;
        const capture = () => {
          window.workspacePositions.push(document.getElementById("workspace-start").getBoundingClientRect().top);
          if (--remaining) requestAnimationFrame(capture);
        };
        capture();
      });
      await navigate();
      await page.waitForFunction(() => window.workspacePositions.length === 32);
      const positions = await page.evaluate(() => window.workspacePositions);
      assert.ok(Math.max(...positions) - Math.min(...positions) < 2, `Changing header height must preserve the visible workspace: ${JSON.stringify(positions)}`);
    };
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole("tab", { name: "Roles & experience", exact: true }).click();
      await page.waitForFunction(() => Math.abs(document.getElementById("workspace-start").getBoundingClientRect().top) < 2);
      await assertStableWorkspace(() => page.getByRole("tab", { name: "Overview", exact: true }).click());
      await assertStableWorkspace(() => page.goBack());
      await assertStableWorkspace(() => page.goForward());
      await page.getByRole("tab", { name: "Skills", exact: true }).click();
      await page.waitForFunction(() => Math.abs(document.getElementById("workspace-start").getBoundingClientRect().top) < 2);
      await assertStableWorkspace(() => page.keyboard.press("Home"));
    }
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: document.getElementById("workspace-start").offsetTop, behavior: "instant" }));

    const data = await (await page.request.get(`${base}/api/skills?limit=8`)).json();
    await page.locator('.market-radar[data-scanning="true"]').waitFor();
    const scanTime = () => page.locator(".radar-sweep").evaluate((element) => element.getAnimations()[0].currentTime);
    const assertScanning = async () => {
      const before = await scanTime();
      await page.waitForFunction((time) => document.querySelector(".radar-sweep").getAnimations()[0].currentTime > time + 100, before, { timeout: 2000 });
      assert.equal(await page.locator(".signal-echo").evaluateAll((elements) => elements.every((element) => element.getAnimations()[0].playState === "running")), true, "Signal echoes must keep running with the sweep");
    };
    const beforeScan = await scanTime();
    await page.waitForFunction((before) => document.querySelector(".radar-sweep").getAnimations()[0].currentTime > before + 100, beforeScan);
    await page.getByRole("button", { name: "Pause scan", exact: true }).click();
    await page.locator('.market-radar[data-scanning="false"]').waitFor();
    await page.locator(".radar-signal").first().hover();
    assert.equal(await page.locator(".radar-sweep").evaluate((element) => element.getAnimations()[0].playState), "paused");
    await page.getByRole("button", { name: "Resume scan", exact: true }).click();
    await page.setViewportSize({ width: 1366, height: 400 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.locator('.market-radar[data-scanning="false"]').waitFor();
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: document.getElementById("workspace-start").offsetTop, behavior: "instant" }));
    await page.locator('.market-radar[data-scanning="true"]').waitFor();
    const [first, second, third] = data.items;
    const signal = (skill) => page.getByRole("button", { name: new RegExp(`^${skill}:`) });
    await signal(first.skill).click();
    await assertScanning();
    for (const item of data.items) {
      await signal(item.skill).hover();
      await assertScanning();
    }
    await signal(third.skill).hover();
    assert.equal(await page.locator(".radar-inspector h3").innerText(), third.skill);
    assert.equal(await signal(first.skill).getAttribute("aria-pressed"), "true");
    const delta = Math.abs(Math.round((third.share - first.share) * 100));
    assert.ok((await page.locator(".inspector-comparison").innerText()).includes(`${delta} percentage points`));
    await page.waitForFunction(() => document.querySelector(".market-radar").getAnimations({ subtree: true }).filter((animation) => animation.effect.getTiming().iterations !== Infinity).every((animation) => animation.playState === "finished"));
    await page.screenshot({ path: path.resolve(__dirname, "../../artifacts/radar-hover-desktop.png") });
    await page.locator(".radar-heading h2").hover();
    assert.equal(await page.locator(".radar-inspector h3").innerText(), first.skill);

    await signal(first.skill).focus();
    await page.keyboard.press("ArrowRight");
    await assertScanning();
    assert.equal(await signal(second.skill).evaluate((element) => element === document.activeElement), true);
    assert.equal(await signal(first.skill).getAttribute("aria-pressed"), "true");
    await page.keyboard.press("Enter");
    assert.equal(await signal(second.skill).getAttribute("aria-pressed"), "true");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(".radar-inspector h3").innerText(), third.skill);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".radar-inspector h3").innerText(), second.skill);

    const radarNode = await page.locator(".market-radar").elementHandle();
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kz");
    await ready();
    assert.equal(await radarNode.evaluate((element) => element === document.querySelector(".market-radar")), true, "Filtering must preserve the radar instance");
    assert.equal(await signal(second.skill).getAttribute("aria-pressed"), "true", "Pin should survive when its skill remains available");
    assert.match(await page.locator(".radar-heading p").innerText(), /Kazakhstan/);
    await assertScanning();
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("uz");
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kg");
    await ready();
    assert.match(await page.locator(".radar-heading p").innerText(), /Kyrgyzstan/);

    await page.getByRole("button", { name: "Reset filters" }).click();
    await ready();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.evaluate(() => {
      window.scrollSamples = [];
      let remaining = 45;
      const collect = () => { window.scrollSamples.push(window.scrollY); if (--remaining) requestAnimationFrame(collect); };
      requestAnimationFrame(collect);
    });
    await page.getByRole("link", { name: "Explore the market" }).click();
    await page.waitForFunction(() => window.scrollSamples.length === 45);
    const samples = await page.evaluate(() => window.scrollSamples);
    assert.ok(new Set(samples.map(Math.round)).size > 3, "Shortcut should scroll through intermediate positions, without an instant jump");
    await page.getByRole("link", { name: "Compare across fields" }).click();
    await page.getByRole("tab", { name: "Skills", selected: true }).waitFor();
    await page.locator('.market-radar[data-scanning="false"]').waitFor({ state: "attached" });
    await page.goBack();
    await page.getByRole("tab", { name: "Overview", selected: true }).waitFor();
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("button", { name: "Radar", exact: true }).click();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await signal(first.skill).click();
    await signal(third.skill).hover();
    assert.equal(await page.locator(".radar-inspector h3").innerText(), third.skill);
    const motion = await page.locator(".radar-signal").first().evaluate((element) => ({
      transition: getComputedStyle(element).transitionDuration,
      pulse: getComputedStyle(element.querySelector(".signal-dot"), "::after").display,
      sweep: getComputedStyle(document.querySelector(".radar-sweep")).display,
      scrolling: getComputedStyle(document.documentElement).scrollBehavior,
    }));
    assert.deepEqual(motion, { transition: "0s", pulse: "none", sweep: "none", scrolling: "auto" });
    assert.deepEqual(errors, []);

    const touch = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
    await touch.goto(base);
    await touch.locator('.snapshot-content[aria-busy="false"]').waitFor();
    await touch.getByRole("button", { name: new RegExp(`^${third.skill}:`) }).tap();
    assert.equal(await touch.locator(".radar-inspector h3").innerText(), third.skill);
    assert.equal(await touch.getByRole("button", { name: new RegExp(`^${third.skill}:`) }).getAttribute("aria-pressed"), "true");
    assert.equal(await touch.locator(".radar-guidance .touch-guidance").isVisible(), true);
    assert.equal(await touch.locator(".signal-evidence").isVisible(), true);
    await touch.evaluate(() => window.scrollTo({ top: document.querySelector(".market-radar").getBoundingClientRect().top + scrollY - 260, behavior: "instant" }));
    await touch.waitForFunction(() => document.querySelector(".market-radar").getAnimations({ subtree: true }).filter((animation) => animation.effect.getTiming().iterations !== Infinity).every((animation) => animation.playState === "finished"));
    await touch.screenshot({ path: path.resolve(__dirname, "../../artifacts/radar-touch-mobile.png") });
    assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log("PASS: continuous sweep and echoes over every signal, clicks, keyboard focus and filtering; manual/offscreen pause, hover preview, pin/compare, history, reduced motion and touch exploration.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
