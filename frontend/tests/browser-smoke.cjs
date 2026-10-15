// Start SkillScope first. Optional SKILLSCOPE_URL defaults to the local app.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const base = process.env.SKILLSCOPE_URL || "http://127.0.0.1:8000";
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, timeout: 20000 });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const ready = () => page.locator('.snapshot-content[aria-busy="false"] .tab-panel:not([hidden])').waitFor();
    const tabs = [
      { id: "overview", label: "Overview" }, { id: "route", label: "My route" }, { id: "roles", label: "Roles & skills" },
      { id: "salary", label: "Salaries" },
    ];
    const selectTab = async (label) => {
      await page.getByRole("tab", { name: label, exact: true }).click();
      await page.getByRole("tab", { name: label, exact: true, selected: true }).waitFor();
      if (label === "Salaries") await page.getByRole("combobox", { name: "Experience requirements", exact: true }).selectOption("all");
    };
    let apiRequests = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      const salaryDetail = url.pathname === "/api/salaries" && url.searchParams.has("experience");
      if (url.pathname.startsWith("/api/") && !salaryDetail && url.pathname !== "/api/exchange-rates") apiRequests++;
    });
    const expectedCount = async (market, role = "all", category = "all") => {
      const query = new URLSearchParams();
      if (market !== "all") query.set("market", market);
      if (role !== "all") query.set("role", role);
      if (category !== "all") query.set("category", category);
      return (await (await page.request.get(`${base}/api/skills?${query}`)).json()).vacancy_denominator;
    };
    const assertCount = async (expected) => {
      await page.waitForFunction((count) => document.querySelector('.snapshot-content[aria-busy="false"] .kpi-primary .kpi-value')?.textContent.trim() === `${count} vacancies`, expected);
      await ready();
      assert.equal((await page.locator(".kpi-primary .kpi-value").textContent()).trim(), `${expected} vacancies`);
    };

    await page.goto(`${base}/`);
    await ready();
    await page.getByRole("tab", { name: "Overview", exact: true, selected: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "SkillScope home", exact: true }).getAttribute("href"), "#overview");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    const baselineSkills = await (await page.request.get(`${base}/api/skills?limit=8`)).json();
    const russianSkills = await (await page.request.get(`${base}/api/skills?market=ru&limit=100`)).json();
    assert.match(await page.locator(".combined-scope").innerText(), new RegExp(`Russia: ${russianSkills.vacancy_denominator} of ${baselineSkills.vacancy_denominator}`));
    const russianComparison = page.locator(".market-skill-country").filter({ has: page.getByText("Russia", { exact: true }) });
    assert.match(await russianComparison.innerText(), new RegExp(`${russianSkills.vacancy_denominator} vacancies`));
    const firstMarketSkill = baselineSkills.items[0];
    const firstRussianSkill = russianSkills.items.find((item) => item.skill === firstMarketSkill.skill);
    assert.match(await russianComparison.innerText(), new RegExp(`${firstRussianSkill?.vacancies_with_skill ?? 0} / ${russianSkills.vacancy_denominator}`));
    const leaders = baselineSkills.items.filter((item) => item.vacancies_with_skill === baselineSkills.items[0]?.vacancies_with_skill);
    if (leaders.length === 2) {
      const headline = await page.locator(".overview-insight h2").textContent();
      for (const item of leaders) assert.ok(headline.includes(item.skill), "Tied leading skills must both be visible");
      assert.ok(headline.includes("each appear"), "A shared headline must not imply skill co-occurrence");
    }
    assert.equal(await page.locator(".signal-frequency").count(), baselineSkills.items.length, "Every radar signal must expose its frequency");
    await page.getByRole("button", { name: /^Explore Kazakhstan:/ }).click();
    await assertCount(await expectedCount("kz"));
    assert.equal(await page.locator(".combined-scope, .market-skill-comparison").count(), 0, "Country view must not present combined-sample results");
    assert.equal(await page.getByRole("combobox", { name: "Market", exact: true }).inputValue(), "kz");
    await page.getByRole("button", { name: "Reset filters" }).click();
    await assertCount(await expectedCount("all"));
    for (const market of ["tj", "tm"]) {
      await page.getByRole("combobox", { name: "Market", exact: true }).selectOption(market);
      await assertCount(0);
      assert.match(await page.locator(".sample-notice").innerText(), /No reviewed vacancies/);
    }
    await page.getByRole("button", { name: "Reset filters" }).click();
    await assertCount(await expectedCount("all"));
    await page.getByRole("button", { name: "List", exact: true }).click();
    assert.equal(await page.locator(".radar-list").count(), 1);
    await page.getByRole("button", { name: /^SQL:/ }).click();
    assert.equal(await page.locator(".radar-inspector h3").innerText(), "SQL");
    await page.getByRole("button", { name: "Radar", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /^SQL:/ }).getAttribute("aria-pressed"), "true");
    await page.getByRole("link", { name: "Compare across fields" }).click();
    await page.getByRole("tab", { name: "Roles & skills", selected: true }).waitFor();
    assert.equal(new URL(page.url()).hash, "#roles");
    const comparedRow = page.locator('.skill-matrix tr[data-skill="SQL"]');
    await comparedRow.waitFor();
    assert.equal(await comparedRow.getAttribute("data-spotlight"), "true", "Radar comparison must point to the selected matrix row");
    assert.match(await comparedRow.locator(".matrix-row-context").innerText(), /From Radar.*Observed/);
    assert.equal(await comparedRow.evaluate((row) => document.activeElement === row), true, "Keyboard focus must follow the selected skill");
    await page.goBack();
    await page.getByRole("tab", { name: "Overview", selected: true }).waitFor();
    assert.equal(await page.locator(".radar-inspector h3").innerText(), "SQL");
    await selectTab("My route");
    await page.locator(".route-advanced > summary").click();
    assert.equal(await page.getByRole("combobox", { name: "Route market" }).inputValue(), "all");
    await page.getByRole("heading", { name: "Compare two roles" }).waitFor();
    const globalRole = await page.getByRole("combobox", { name: "Compare role 1" }).inputValue();
    await page.getByRole("button", { name: "Build this route" }).first().click();
    await page.getByRole("heading", { name: "A starting point for this role" }).waitFor();
    assert.match(await page.locator(".route-result-heading").innerText(), new RegExp(`${await expectedCount("all", globalRole)} observed vacancies`));
    assert.match(await page.locator(".route-result-heading").innerText(), /across all markets/);
    await page.getByRole("combobox", { name: "Route role" }).selectOption("all");
    await page.getByRole("combobox", { name: "Route market" }).selectOption("kz");
    await page.getByRole("combobox", { name: "Route role" }).selectOption("data_analyst");
    await page.getByRole("heading", { name: "A starting point for this role" }).waitFor();
    const routeCount = await expectedCount("kz", "data_analyst", "data_ai");
    assert.match(await page.locator(".route-result-heading").innerText(), new RegExp(`${routeCount} observed vacancies`));
    await page.getByRole("button", { name: "SQL", exact: true, pressed: false }).click();
    assert.equal(await page.locator(".route-recommendations li").count(), 5);
    assert.equal(await page.locator(".route-recommendations li").filter({ hasText: "SQL" }).count(), 0, "Known skills must not be proposed");
    await page.getByRole("link", { name: "Compare Python across fields" }).click();
    await page.getByRole("tab", { name: "Roles & skills", selected: true }).waitFor();
    await page.locator('.snapshot-content[aria-busy="false"] .skill-matrix tr[data-skill="Python"]').waitFor();
    assert.match(await page.locator('.skill-matrix tr[data-skill="Python"] .matrix-row-context').innerText(), /From My route/);
    assert.equal(await page.getByRole("combobox", { name: "Market", exact: true }).inputValue(), "kz");
    assert.equal(await page.getByRole("combobox", { name: "Field" }).inputValue(), "all");
    assert.equal(await page.getByRole("combobox", { name: "Role family" }).inputValue(), "all");
    assert.ok(await page.locator(".skill-matrix thead th").count() > 2, "Route comparison must show multiple fields");
    await page.goBack();
    await page.getByRole("tab", { name: "My route", selected: true }).waitFor();
    await page.getByRole("combobox", { name: "Route role" }).waitFor();
    assert.equal(await page.getByRole("combobox", { name: "Route role" }).inputValue(), "data_analyst");
    await page.getByRole("combobox", { name: "Route market" }).selectOption("kg");
    await page.locator(".route-caution").waitFor();
    await page.getByRole("combobox", { name: "Route market" }).selectOption("tj");
    await page.getByRole("heading", { name: "No route from this sample yet." }).waitFor();
    assert.equal(await page.locator(".route-recommendations li").count(), 0);
    await page.getByRole("combobox", { name: "Route market" }).selectOption("kz");
    await page.getByRole("button", { name: "SQL", exact: true, pressed: true }).waitFor();
    await selectTab("Overview");
    await page.getByRole("button", { name: "Reset filters" }).click();
    await assertCount(await expectedCount("all"));
    await selectTab("Roles & skills");
    await page.getByRole("navigation", { name: "Jump to section" }).getByRole("button", { name: "Skills" }).click();
    await page.waitForFunction(() => { const top = document.getElementById("skills")?.getBoundingClientRect().top; return top !== undefined && top >= 0 && top < innerHeight; });
    const rolesResponse = await (await page.request.get(`${base}/api/roles`)).json();
    const leadingRole = [...rolesResponse.items].sort((a, b) => b.vacancies - a.vacancies)[0];
    const leadingWidth = await page.getByRole("button", { name: `Explore ${leadingRole.label}`, exact: true }).locator(".role-demand-track > span").evaluate((element) => parseFloat(element.style.width));
    assert.ok(Math.abs(leadingWidth - leadingRole.share * 100) < 0.02, "Role bars must use a full 0–100% sample scale");
    await page.getByRole("button", { name: "Explore Data Analyst", exact: true }).click();
    await assertCount(await expectedCount("all", "data_analyst", "data_ai"));
    const analystRussia = await (await page.request.get(`${base}/api/skills?market=ru&role=data_analyst&category=data_ai`)).json();
    assert.match(await page.locator(".combined-scope").innerText(), new RegExp(`Russia: ${analystRussia.vacancy_denominator} of ${await expectedCount("all", "data_analyst", "data_ai")}`));
    assert.equal(await page.getByRole("combobox", { name: "Role family" }).inputValue(), "data_analyst");
    await page.getByRole("button", { name: "Reset filters" }).click();
    await assertCount(await expectedCount("all"));
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kg");
    await assertCount(await expectedCount("kg"));
    if (await expectedCount("kg") < 20) await page.locator(".sample-notice").waitFor();
    const requestsBeforeTabs = apiRequests;
    await page.getByRole("tab", { name: "Roles & skills" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("tab", { name: "Salaries", selected: true }).waitFor();
    await page.keyboard.press("End");
    await page.getByRole("tab", { name: "Salaries", selected: true }).waitFor();
    await page.keyboard.press("Home");
    await page.getByRole("tab", { name: "Overview", selected: true }).waitFor();
    await page.goBack();
    await page.getByRole("tab", { name: "Salaries", selected: true }).waitFor();
    assert.equal(await page.getByRole("combobox", { name: "Market", exact: true }).inputValue(), "kg");
    assert.equal(apiRequests, requestsBeforeTabs, "Tab switches must reuse the loaded snapshot");
    await selectTab("Overview");

    // Keep the preceding snapshot labelled and inert until the next selection arrives.
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/api/skills?**", async (route) => { await gate; await route.continue(); });
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kz");
    await page.locator('.snapshot-content[aria-busy="true"]').waitFor();
    assert.equal(await page.locator(".snapshot-content").evaluate((element) => element.inert), true);
    assert.match(await page.locator(".snapshot-status").innerText(), /previous snapshot/);
    assert.match(await page.locator(".radar-heading p").innerText(), /Kyrgyzstan/);
    assert.ok(await page.getByRole("combobox", { name: "Field" }).locator("option").count() > 1);
    release();
    await assertCount(await expectedCount("kz"));
    await page.unroute("**/api/skills?**");

    // Failure after a successful view must hide stale results and support retry.
    await page.route("**/api/skills?**", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("uz");
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".kpi-grid").count(), 0);
    await page.unroute("**/api/skills?**");
    await page.getByRole("button", { name: "Try again" }).click();
    await assertCount(await expectedCount("uz"));

    await page.route("**/api/skills?**", (route) => route.fulfill({ json: { vacancy_denominator: 0, items: [] } }));
    await page.route("**/api/salaries?**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/seniority?**", (route) => route.fulfill({ json: { vacancy_denominator: 0, items: [] } }));
    await page.getByRole("combobox", { name: "Role family" }).selectOption("bi_analyst");
    await assertCount(0);
    await selectTab("Roles & skills");
    await page.getByText("No reviewed skill sample for these fields yet.").waitFor();
    await selectTab("Salaries");
    await page.getByText("No published salary amounts for these filters.").waitFor();
    await page.unrouteAll({ behavior: "wait" });

    await page.getByRole("combobox", { name: "Role family" }).selectOption("all");
    await ready();
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("all");
    await ready();
    await page.getByRole("combobox", { name: "Field" }).selectOption("software_engineering");
    await assertCount(await expectedCount("all", "all", "software_engineering"));
    await page.getByRole("combobox", { name: "Role family" }).selectOption("backend_developer");
    await assertCount(await expectedCount("all", "backend_developer", "software_engineering"));
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("tj");
    await assertCount(0);
    await selectTab("Roles & skills");
    assert.equal(await page.locator(".role-not-sampled").innerText(), "Not sampled");
    await selectTab("Overview");
    assert.equal(await page.locator(".radar-signal").count(), 0);
    assert.match(await page.locator(".sample-notice").textContent(), /Missing data does not mean there is no hiring/);
    await page.getByRole("button", { name: "About the sample" }).click();
    await page.locator("#methodology:not([hidden])").waitFor();
    await page.getByRole("button", { name: "Close methodology" }).click();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await assertCount(await expectedCount("all"));
    await page.getByRole("combobox", { name: "Field" }).selectOption("all");
    await page.getByRole("combobox", { name: "Role family" }).selectOption("all");
    await ready();
    await page.goto(`${base}/#seniority`);
    await ready();
    await page.getByRole("tab", { name: "Roles & skills", selected: true }).waitFor();
    await selectTab("Overview");
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Exercise a future comparison with two sampled fields and an explicit zero match.
    await page.route("**/api/skills?**", (route) => {
      const field = new URL(route.request().url()).searchParams.get("category");
      if (field === "software_engineering") return route.fulfill({ json: { vacancy_denominator: 4, items: [{ skill: "Python", vacancies_with_skill: 2, share: 0.5 }, { skill: "JavaScript", vacancies_with_skill: 3, share: 0.75 }] } });
      if (field && field !== "data_ai") return route.fulfill({ json: { vacancy_denominator: 0, items: [] } });
      return route.continue();
    });
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kz");
    await ready();
    await selectTab("Roles & skills");
    assert.equal(await page.locator(".skill-matrix thead th").count(), 3);
    const zeroMatch = page.locator(".skill-matrix tbody tr").filter({ has: page.getByRole("rowheader", { name: "SQL", exact: true }) }).locator('td[data-label="Software Engineering"]');
    assert.match(await zeroMatch.getAttribute("aria-label"), /0%, 0 of 4 vacancies/);
    assert.equal(await page.locator('.skill-matrix td[data-label="Cybersecurity"]').count(), 0, "Unreviewed fields must not look like zero-frequency matches");
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("all");
    await ready();
    await selectTab("Salaries");
    assert.equal(await page.locator(".salary-figure").count(), await page.locator(".salary-sample").count(), "Every salary summary must carry its own sample size");
    const salaryGroups = await (await page.request.get(`${base}/api/salaries`)).json();
    const salaryTotals = salaryGroups.reduce((total, row) => ({
      reported: total.reported + row.vacancies_with_reported_salary,
      included: total.included + row.included_vacancies,
      complete: total.complete + row.complete_salary_ranges,
    }), { reported: 0, included: 0, complete: 0 });
    assert.equal(await page.locator(".salary-summary-table tbody tr").count(), salaryGroups.filter((row) => row.vacancies_with_reported_salary > 0).length);
    assert.equal(await page.locator('.salary-summary-table tbody tr').evaluateAll((rows) => rows.every((row) => Number(row.querySelector(".salary-sample").textContent.match(/\d+/)[0]) > 0)), true);
    assert.equal(await page.locator('.salary-summary-table').allTextContents().then((texts) => texts.join(" ").includes('NaN')), false);
    assert.equal(await page.locator(".coverage-meter").getAttribute("aria-label"), `${salaryTotals.complete} complete ranges, ${salaryTotals.reported - salaryTotals.complete} incomplete ranges, ${salaryTotals.included - salaryTotals.reported} undisclosed out of ${salaryTotals.included} vacancies`);
    const screenshots = path.resolve(__dirname, "../../docs/screenshots");
    fs.mkdirSync(screenshots, { recursive: true });
    for (const width of [1366, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of tabs) {
      await selectTab(tab.label);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      if (dimensions.content > dimensions.viewport) {
        console.error(await page.evaluate(() => [...document.querySelectorAll("body *")]
          .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth)
          .map((element) => ({ element: `${element.tagName}.${element.className}`, right: element.getBoundingClientRect().right }))));
      }
      assert.ok(dimensions.content <= dimensions.viewport, `Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
      assert.equal(await page.getByRole("tabpanel").count(), 1, "Only one analysis panel should be visible");
      if (tab.id === "roles" && width <= 700) {
        const roleBounds = await page.locator(".role-panel").boundingBox();
        const experienceBounds = await page.locator(".seniority-panel").boundingBox();
        assert.ok(experienceBounds.y >= roleBounds.y + roleBounds.height, "Role and experience sections must stack on phones");
      }
      if (width === 1366 || width === 390) {
        const capture = tab.id === "overview" ? path.join(screenshots, `dashboard-${width}.png`) : path.resolve(__dirname, `../../artifacts/tabs-${tab.id}-${width}.png`);
        await page.screenshot({ path: capture, fullPage: true });
        // Capture the actual first content viewport without locator auto-scroll hiding its heading.
        await page.evaluate(() => { const anchor = document.getElementById("workspace-start"); window.scrollTo(0, anchor.getBoundingClientRect().top + window.scrollY); });
        await page.screenshot({ path: path.resolve(__dirname, `../../artifacts/clarity-${tab.id}-${width}.png`) });
      }
      const clippedCells = await page.locator(".tab-panel:not([hidden]) .skill-matrix td, .tab-panel:not([hidden]) .salary-summary-table td, .tab-panel:not([hidden]) .radar-signal .signal-name").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).length);
      assert.equal(clippedCells, 0, `Clipped values or signals at ${width}px`);
      if (tab.id === "overview") {
        const escapedLabels = await page.locator(".radar-signal .signal-name").evaluateAll((elements) => elements.filter((element) => {
          const label = element.getBoundingClientRect();
          const surface = element.closest(".market-radar").getBoundingClientRect();
          return label.left < surface.left || label.right > surface.right || label.bottom > surface.bottom;
        }).length);
        assert.equal(escapedLabels, 0, `Radar labels must remain inside the instrument at ${width}px`);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      if (width <= 767) {
        const tabs = await page.locator(".dashboard-tabs").boundingBox();
        if (tab.id === "overview") {
          assert.ok(tabs.y + tabs.height <= 0, "Overview tabs must scroll out of view on phones");
        } else {
          assert.ok(tabs.y >= -1 && tabs.y < 900, "Tabs must stay reachable while scrolling on phones");
        }
        if (tab.id !== "route") {
          const filters = await page.locator(".explore-section").boundingBox();
          assert.ok(filters.y + filters.height <= 0, "Mobile filters must scroll out of view");
        }
      } else {
        const controls = await page.locator(".workspace-controls").boundingBox();
        if (tab.id === "overview") {
          assert.ok(controls.y + controls.height <= 0, "Overview controls must scroll out of view");
        } else {
          assert.ok(controls.y >= -1 && controls.y < 900, "Tabs and filters must stay reachable while scrolling");
        }
      }
      }
    }
    await selectTab("Overview");
    await page.getByRole("button", { name: "About the data" }).click();
    await page.getByText("Scope & coverage", { exact: true }).click();
    await page.locator(".methodology-details details[open] p").waitFor();
    assert.equal(await page.locator(".radar-sweep").evaluate((element) => getComputedStyle(element).display), "none");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).backgroundColor === "rgb(17, 28, 25)");
    assert.equal(await page.evaluate(() => localStorage.getItem("skillscope-theme")), "dark");
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"), "#111c19");
    await page.reload();
    await ready();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "Saved theme must survive reload");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("skillscope-theme")), "light");
    const preferredDark = await browser.newContext({ colorScheme: "light" });
    const freshPage = await preferredDark.newPage();
    await freshPage.goto(base);
    assert.equal(await freshPage.locator("html").getAttribute("data-theme"), "dark", "Fresh visits default to dark even with a light OS preference");
    await preferredDark.close();
    await page.getByRole("link", { name: "Privacy & storage" }).click();
    await page.getByRole("heading", { name: "Privacy & storage" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "arsenbektemirov01@gmail.com" }).getAttribute("href"), "mailto:arsenbektemirov01@gmail.com");
    assert.equal(new URL(page.url()).pathname, "/privacy");
    await page.getByRole("button", { name: "Clear saved preferences" }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("skillscope-theme")), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("skillscope-known-skills")), null);
    await page.reload();
    await page.getByRole("heading", { name: "Privacy & storage" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: four tabs, personal route with counts/empty/small samples, keyboard navigation, URL/back, preserved filters/radar selection, theme persistence, desktop and mobile layouts; no browser exceptions.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
