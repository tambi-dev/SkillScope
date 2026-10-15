import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MarketRadar from "./MarketRadar";
import MyRoute from "./MyRoute";
import SalaryPanel from "./SalaryPanel";
import { configuredMarkets, orderMarkets } from "./markets";
import AskSkillScope from "./AskSkillScope";
import { LanguageSwitch, useLanguage } from "./i18n";
import {
  getModelInsights,
  getOverview,
  getRoles,
  getSalaries,
  getSeniority,
  getSkills,
  getTaxonomy,
} from "./api";
import type {
  CategoryCode,
  MarketCode,
  ModelInsights,
  Overview,
  RoleCode,
  RoleDemandItem,
  RoleDemandResponse,
  SalaryGroup,
  SeniorityLevel,
  SeniorityResponse,
  SkillsResponse,
  TaxonomyCategory,
} from "./types";

const dashboardTabs = [
  { id: "overview", label: "Overview" },
  { id: "route", label: "My route" },
  { id: "roles", label: "Roles & skills" },
  { id: "salary", label: "Salaries" },
] as const;
type DashboardTab = typeof dashboardTabs[number]["id"];
const kyrgyzMobileTabs: Record<DashboardTab, string> = {
  overview: "Жалпы", route: "Багытым", roles: "Ролдор", salary: "Айлык",
};

function tabFromHash(): DashboardTab {
  const hash = window.location.hash.slice(1);
  if (hash === "explore") return "overview";
  if (hash === "seniority" || hash === "skills") return "roles";
  return dashboardTabs.find((tab) => tab.id === hash)?.id ?? "route";
}

function scrollToWorkspace() {
  requestAnimationFrame(() => {
    const anchor = document.getElementById("workspace-start");
    if (anchor) window.scrollTo({ top: anchor.getBoundingClientRect().top + window.scrollY, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });
}

const levelColors: Record<SeniorityLevel, string> = {
  Junior: "var(--level-junior)",
  Middle: "var(--level-middle)",
  Senior: "var(--level-senior)",
  Unknown: "var(--level-unknown)",
};

interface DashboardData {
  selection: { market: MarketCode | "all"; role: RoleCode | "all"; category: CategoryCode | "all" };
  taxonomy: TaxonomyCategory[];
  overview: Overview;
  roles: RoleDemandResponse;
  skills: SkillsResponse;
  categorySkills: Array<{ category: TaxonomyCategory; response: SkillsResponse }>;
  marketSkills: Array<{ market: MarketCode; response: SkillsResponse }>;
  salaries: SalaryGroup[];
  seniority: SeniorityResponse;
  model: ModelInsights;
}

function App() {
  const { language, t, formatDate } = useLanguage();
  const [theme, setTheme] = useState<"light" | "dark">(() => document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const [activeTab, setActiveTab] = useState<DashboardTab>(tabFromHash);
  const [showMethodology, setShowMethodology] = useState(window.location.hash === "#methodology");
  const [askOpen, setAskOpen] = useState(window.location.hash === "#ask-skillscope");
  const [market, setMarket] = useState<MarketCode | "all">("all");
  const [role, setRole] = useState<RoleCode | "all">("all");
  const [category, setCategory] = useState<CategoryCode | "all">("all");
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const orderedMarkets = orderMarkets(data?.overview);
  const marketOptions: Array<{ value: MarketCode | "all"; label: string }> = [{ value: "all", label: "Combined sample" }, ...orderedMarkets];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [comparedSkill, setComparedSkill] = useState<string | null>(null);
  const [comparedSource, setComparedSource] = useState<"Radar" | "My route">("Radar");
  const previousWorkspaceTop = useRef<number | null>(null);
  const routeReturnSelection = useRef<{ market: MarketCode | "all"; category: CategoryCode | "all"; role: RoleCode | "all" } | null>(null);
  const preserveComparison = useRef(false);

  useEffect(() => { document.title = language === "ky" ? "SkillScope — IT багытыңызды табыңыз" : "SkillScope — Find your IT direction"; }, [language]);


  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "dark" ? "#111c19" : "#f6f6ee");
    try { window.localStorage.setItem("skillscope-theme", nextTheme); } catch { /* The toggle still works without storage. */ }
    setTheme(nextTheme);
  }

  function rememberWorkspacePosition() {
    previousWorkspaceTop.current = document.getElementById("workspace-start")?.getBoundingClientRect().top ?? null;
  }

  useLayoutEffect(() => {
    const anchor = document.getElementById("workspace-start");
    if (anchor && previousWorkspaceTop.current !== null) {
      window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top - previousWorkspaceTop.current, behavior: "instant" });
    }
    previousWorkspaceTop.current = null;
  }, [activeTab]);

  useLayoutEffect(() => {
    if (activeTab !== "route" || !routeReturnSelection.current) return;
    const selection = routeReturnSelection.current;
    routeReturnSelection.current = null;
    setMarket(selection.market);
    setCategory(selection.category);
    setRole(selection.role);
  }, [activeTab]);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const onNavigation = () => {
      if (window.location.hash === "#ask-skillscope") { setAskOpen(true); return; }
      if (window.location.hash === "#methodology") setShowMethodology(true);
      else if (window.location.hash !== "#explore") {
        rememberWorkspacePosition();
        setActiveTab(tabFromHash());
      }
      scrollToWorkspace();
    };
    window.addEventListener("hashchange", onNavigation);
    window.addEventListener("popstate", onNavigation);
    return () => {
      window.history.scrollRestoration = previousRestoration;
      window.removeEventListener("hashchange", onNavigation);
      window.removeEventListener("popstate", onNavigation);
    };
  }, []);

  function selectTab(tab: DashboardTab, scroll = true) {
    if (tab === activeTab) return;
    rememberWorkspacePosition();
    window.history.pushState(null, "", `#${tab}`);
    setActiveTab(tab);
    if (scroll) scrollToWorkspace();
  }

  useEffect(() => {
    if (preserveComparison.current) {
      preserveComparison.current = false;
      return;
    }
    setComparedSkill(null);
  }, [market, role, category]);

  useLayoutEffect(() => {
    if (activeTab !== "roles" || !comparedSkill || loading || data?.selection.market !== market || data.selection.role !== role || data.selection.category !== category) return;
    const row = [...document.querySelectorAll<HTMLTableRowElement>(".skill-matrix tbody tr")]
      .find((item) => item.dataset.skill === comparedSkill);
    if (!row) return;
    row.dataset.spotlight = "true";
    row.focus({ preventScroll: true });
    row.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    const timeout = window.setTimeout(() => { delete row.dataset.spotlight; }, 2200);
    return () => { window.clearTimeout(timeout); delete row.dataset.spotlight; };
  }, [activeTab, comparedSkill, loading, data, market, role, category]);

  function openMethodology() {
    setShowMethodology(true);
    scrollToWorkspace();
  }

  function chooseRouteRole(nextRole: RoleCode | "all") {
    const selectedRole = taxonomy.flatMap((item) => item.roles).find((item) => item.code === nextRole);
    setCategory(selectedRole?.category ?? "all");
    setRole(nextRole);
  }

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([getTaxonomy(controller.signal), getOverview(controller.signal)])
      .then(async ([taxonomy, overview]) => {
        if (current) setTaxonomy(taxonomy);
        const comparedCategories = role !== "all"
          ? taxonomy.filter((item) => item.roles.some((itemRole) => itemRole.code === role))
          : category === "all"
            ? taxonomy
            : taxonomy.filter((item) => item.code === category);
        const [roles, skills, salaries, seniority, model, categorySkills, marketSkills] = await Promise.all([
          getRoles(market, category, controller.signal),
          getSkills(market, role, category, controller.signal),
          getSalaries(market, role, category, controller.signal),
          getSeniority(market, role, category, controller.signal),
          getModelInsights(controller.signal),
          Promise.all(comparedCategories.map(async (item) => ({
            category: item,
            response: await getSkills(market, role, item.code, controller.signal, 100),
          }))),
          market === "all" ? Promise.all(configuredMarkets.map(async (item) => ({
            market: item.value,
            response: await getSkills(item.value, role, category, controller.signal, 100),
          }))) : [],
        ]);
        if (current) {
          setData({ selection: { market, role, category }, taxonomy, overview, roles, skills, categorySkills, marketSkills, salaries, seniority, model });
        }
      })
      .catch((reason: unknown) => {
        if (current) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load SkillScope data.",
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [market, role, category, retry]);

  const categories = taxonomy.map((item) => ({ ...item, label: t(item.label), roles: item.roles.map((entry) => ({ ...entry, label: t(entry.label) })) }));
  const rolesInCategory = categories
    .filter((item) => category === "all" || item.code === category)
    .flatMap((item) => item.roles);
  const roleLabels = new Map(
    categories.flatMap((item) => item.roles.map((entry) => [entry.code, entry.label] as const)),
  );

  const salaryStats = { reported: 0, denominator: 0, complete: 0 };
  for (const row of data?.salaries ?? []) {
    salaryStats.reported += row.vacancies_with_reported_salary;
    salaryStats.denominator += row.included_vacancies;
    salaryStats.complete += row.complete_salary_ranges;
  }

  const topSkill = data?.skills.items[0];
  const shownSelection = data?.selection ?? { market, role, category };
  const roleDemandItems = data?.roles.items
    .filter((item) => shownSelection.role === "all" || item.code === shownSelection.role)
    .sort((first, second) => second.vacancies - first.vacancies) ?? [];
  const experienceKnown = roleDemandItems.reduce((sum, item) => sum + item.experience_observed_vacancies, 0);
  const noExperienceRequired = roleDemandItems.reduce((sum, item) => sum + item.no_experience_required, 0);
  const matrixSkills = buildSkillMatrix(data?.categorySkills ?? [], comparedSkill);
  const routeSkills = data?.selection.market === market && data.selection.role === role
    ? data.categorySkills.find(({ category: item }) => item.roles.some((entry) => entry.code === role))?.response ?? null
    : null;
  const sampleSize = data?.skills.vacancy_denominator ?? 0;
  const sampledCategories = data?.categorySkills.filter(({ response }) => response.vacancy_denominator > 0) ?? [];
  const unsampledCategories = data?.categorySkills.filter(({ response }) => response.vacancy_denominator === 0) ?? [];
  const leadingSkills = data?.skills.items.filter((item) => item.vacancies_with_skill === topSkill?.vacancies_with_skill) ?? [];
  const leadingSkillNames = leadingSkills.length > 2 ? t("{count} skills", { count: leadingSkills.length }) : leadingSkills.map((item) => item.skill).join(language === "ky" ? " жана " : " and ");
  const sampledRoleItems = roleDemandItems.filter((item) => item.vacancies > 0 || sampledCategories.some(({ category: itemCategory }) => itemCategory.code === item.category));
  const unsampledRoleItems = roleDemandItems.filter((item) => !sampledRoleItems.includes(item));
  const leadingRole = sampledRoleItems[0];
  const roleLeaders = sampledRoleItems.filter((item) => item.vacancies === leadingRole?.vacancies);
  const largestSeniority = [...data?.seniority.items ?? []].sort((a, b) => b.vacancies - a.vacancies)[0];
  const unknownSeniority = data?.seniority.items.find((item) => item.seniority === "Unknown");
  const countryMix = marketOptions.filter((option) => option.value !== "all").map((option) => ({
    ...option,
    label: t(option.label),
    vacancies: data?.marketSkills.find((item) => item.market === option.value)?.response.vacancy_denominator ?? 0,
  }));
  const dominantMarket = countryMix.find((item) => sampleSize > 0 && item.vacancies / sampleSize > 0.5);
  const comparedMarketSkills = data?.skills.items.slice(0, 3) ?? [];
  const sharedSkill = matrixSkills[0];
  const sharedFieldCount = sampledCategories.filter(({ response }) => response.items.some((item) => item.skill === sharedSkill)).length;

  function renderRoleRow(item: RoleDemandItem) {
    const sampled = sampledRoleItems.includes(item);
    const share = sampleSize ? Math.round(item.vacancies / sampleSize * 100) : 0;
    return <button type="button" className="role-demand-row" key={item.code} onClick={() => { setCategory(item.category); setRole(item.code); }} aria-label={t("Explore {role}", { role: t(item.label) })} aria-describedby={`role-evidence-${item.code}`} aria-pressed={role === item.code}>
      <span className="role-demand-name">{t(item.label)}<svg className="row-explore" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13L13 3M4 3H13V12" /></svg></span>
      {sampled ? <>
        <span className="role-demand-track" data-empty={!item.vacancies} aria-hidden="true"><span style={{ width: `${sampleSize ? item.vacancies / sampleSize * 100 : 0}%` }} /></span>
        <span className="role-demand-count" id={`role-evidence-${item.code}`}><strong>{share}%</strong><small>{item.vacancies} {t("vacancies")}</small></span>
      </> : <span className="role-not-sampled" id={`role-evidence-${item.code}`}>{t("Not sampled")}</span>}
    </button>;
  }

  return (
    <div className="app-shell" onClick={(event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const destination = link.hash.slice(1);
      if (!["explore", "methodology", "seniority", "skills", ...dashboardTabs.map((tab) => tab.id)].includes(destination)) return;
      event.preventDefault();
      if (destination === "explore") {
        scrollToWorkspace();
        document.querySelector<HTMLSelectElement>(".filter-control select")?.focus({ preventScroll: true });
      } else if (destination === "methodology") openMethodology();
      else {
        const tab = destination === "seniority" || destination === "skills" ? "roles" : destination as DashboardTab;
        const fromComparison = destination === "skills" && link.hasAttribute("data-compare-skill");
        if (tab === activeTab && !fromComparison) scrollToWorkspace();
        else selectTab(tab, !fromComparison);
        if (!fromComparison) requestAnimationFrame(() => document.getElementById(`tab-${tab}`)?.focus({ preventScroll: true }));
      }
    }}>
      <a className="skip-link" href={activeTab === "route" ? "#route" : "#explore"}>{t(activeTab === "route" ? "Skip to my route" : "Skip to market filters")}</a>
      <header className="site-header">
        <a className="brand" href="#route" aria-label={t("SkillScope home")}><span className="brand-mark">S</span><span>SkillScope<span className="brand-period">.</span></span></a>
        <div className="header-actions">
          <span className="header-region">{t("Central Asia & beyond")}</span>
          <LanguageSwitch />
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={t(theme === "dark" ? "Switch to light theme" : "Switch to dark theme")}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></> : <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />}
            </svg>
            <span>{t(theme === "dark" ? "Light theme" : "Dark theme")}</span>
          </button>
        </div>
      </header>

      <main id="overview" className="page-wrap">
        <section className={`page-heading${activeTab !== "overview" ? " compact-heading" : ""}`} hidden={activeTab === "route"}>
          {activeTab === "overview" ? <>
          <h1>{t("The IT market.")}<br /><span>{t("On your radar.")}</span></h1>
          <div className="heading-intro">
            <p>{t("Explore skills, roles and salary signals across Central Asia, Georgia and Russia. Find a direction worth learning for.")}</p>
            <div className="heading-actions"><a href="#route" className="text-link">{t("Find my direction")} <span aria-hidden="true">↗</span></a><a href="#explore" className="text-link">{t("Explore the market")} <span aria-hidden="true">↘</span></a><button type="button" className="text-link heading-ask" onClick={() => setAskOpen(true)}>{t("Ask Mr. Scope")} <span aria-hidden="true">↗</span></button></div>
          </div>
          </> : <><h1>{t(activeTab === "route" ? "Find your first direction in IT." : dashboardTabs.find((tab) => tab.id === activeTab)?.label ?? "")}</h1><p className="tab-intro">{t(activeTab === "route" ? "Compare real tasks, try a small exercise and choose what to learn next." : activeTab === "roles" ? "Explore roles, experience requirements and the skills employers mention." : "Explore advertised salary ranges and their coverage.")}</p></>}
        </section>

        <div id="workspace-start" />
        <div className="workspace-controls" data-sticky={activeTab !== "overview"}>
          <div className="dashboard-tabs" role="tablist" aria-label={t("Market analysis")}>
            {dashboardTabs.map((tab, index) => <button
              type="button" role="tab" id={`tab-${tab.id}`} key={tab.id}
              aria-selected={activeTab === tab.id} aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => {
                const next = event.key === "ArrowRight" ? (index + 1) % dashboardTabs.length
                  : event.key === "ArrowLeft" ? (index + dashboardTabs.length - 1) % dashboardTabs.length
                    : event.key === "Home" ? 0 : event.key === "End" ? dashboardTabs.length - 1 : null;
                if (next === null) return;
                event.preventDefault();
                selectTab(dashboardTabs[next].id);
                document.getElementById(`tab-${dashboardTabs[next].id}`)?.focus({ preventScroll: true });
              }}
              aria-label={t(tab.label)}
            ><span className="tab-label-full">{t(tab.label)}</span><span className="tab-label-mobile" aria-hidden="true">{language === "ky" ? kyrgyzMobileTabs[tab.id] : tab.id === "roles" ? "Roles + skills" : tab.label}</span></button>)}
          </div>
        <section className="explore-section" id="explore" aria-label={t("Dashboard filters")} hidden={activeTab === "route"}>
          <div className="filter-row">
            <label className="filter-control"><span>{t("Market")}</span>
              <select aria-label={t("Market")} value={market} onChange={(event) => setMarket(event.target.value as MarketCode | "all")}>
                {marketOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
              </select>
            </label>
            <label className="filter-control"><span>{t("Field")}</span>
              <select aria-label={t("Field")} value={category} onChange={(event) => { setCategory(event.target.value); setRole("all"); }}>
                <option value="all">{t("All fields")}</option>
                {categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <label className="filter-control role-filter"><span>{t("Role")}</span>
              <select aria-label={t("Role family")} value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="all">{t(category === "all" ? "All IT roles" : "All field roles")}</option>
                {rolesInCategory.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <button className="reset-button" disabled={market === "all" && category === "all" && role === "all"} onClick={() => { setMarket("all"); setCategory("all"); setRole("all"); }}>{t("Reset filters")}</button>
          </div>
          <div className="snapshot-line">
            <span className="snapshot-status" role="status"><span className="status-dot" />{t(error ? "Snapshot unavailable" : loading ? data ? "Updating · previous snapshot shown" : "Reading snapshot…" : data?.overview.data_mode === "demo" ? "Demo snapshot" : "Local snapshot")}</span>
            <div className="snapshot-meta"><span>{data ? t("Observed {date} · HeadHunter", { date: formatDate(data.overview.last_seen_at) }) : t("HeadHunter vacancy snapshots")}</span><button className="methodology-button" aria-expanded={showMethodology} aria-controls="methodology" onClick={() => { setShowMethodology((value) => !value); scrollToWorkspace(); }}>{t("About the data")}</button></div>
          </div>
          {data && shownSelection.market === "all" && <div className="combined-scope" role="note"><strong>{t("Combined sample · {count} vacancies", { count: sampleSize })}</strong><span>{dominantMarket ? t("{market}: {count} of {total} ({share}%). Combined percentages mostly reflect this country. Select a country above for its own sample.", { market: dominantMarket.label, count: dominantMarket.vacancies, total: sampleSize, share: Math.round(dominantMarket.vacancies / sampleSize * 100) }) : t("Countries contribute different numbers of vacancies. Select one above to view its own sample.")}</span></div>}
        </section>
        </div>

          <section className="methodology-panel" id="methodology" aria-labelledby="methodology-heading" hidden={!showMethodology}>
            <button className="methodology-close" onClick={() => { setShowMethodology(false); document.querySelector<HTMLButtonElement>(".methodology-button")?.focus({ preventScroll: true }); }}>{t("Close methodology")}</button>
            <div className="methodology-intro"><h2 id="methodology-heading">{t("A snapshot.")}<br />{t("With perspective.")}</h2><p>{t("Good decisions start with knowing what the data can tell you, and where it stops.")}</p><span>{t("Source: HeadHunter public API")}</span></div>
            <div className="methodology-details">
              <details><summary>{t("Scope & coverage")}</summary><p>{t("Ten roles across five IT fields in Kyrgyzstan, Kazakhstan, Uzbekistan, Tajikistan, Turkmenistan, Georgia and Russia. HeadHunter search results are filtered by title and description. This sample does not cover every hiring channel; markets and fields without reviewed vacancies are marked as not sampled.")}</p></details>
              <details><summary>{t("Skills & seniority")}</summary><p>{t("Dictionary rules normalize skill aliases. Seniority is inferred from explicit title markers, then description markers, then HeadHunter experience bands. Vacancies requiring no experience are also tracked as an access signal; they are not treated as a confirmed Junior label.")}</p></details>
              <details><summary>{t("Salary uncertainty")}</summary><p>{t("Missing salaries stay unknown. A midpoint summarizes an advertised two-sided range; it is not an observed employee salary. Salary groups stay separate by currency; optional USD display uses a dated reference rate. Gross/net amounts and living costs are not harmonized. Small groups and undisclosed salaries limit comparisons.")}</p></details>
              <details><summary>{t("Reading the signals")}</summary><p>{t("Skill frequencies reflect explicit mentions in this HeadHunter snapshot, not the full labour market. Group counts expose small samples. Country mix and salary disclosure create selection bias. Skill associations cannot establish salary effects. No salary model has been trained.")}</p></details>
            </div>
          </section>

        <div className="tab-panel" role="tabpanel" id="panel-route" aria-labelledby="tab-route" hidden={activeTab !== "route"} tabIndex={0}>
          <MyRoute markets={orderedMarkets.map((item) => ({ ...item, label: t(item.label) }))} taxonomy={categories} market={market} role={role} skills={routeSkills} observedDate={formatDate(data?.overview.last_seen_at ?? null)} loading={loading} dataError={Boolean(error)} onRetry={() => setRetry((value) => value + 1)} onAsk={() => setAskOpen(true)} onMarketChange={setMarket} onRoleChange={chooseRouteRole} onCompareSkill={(skill) => {
            routeReturnSelection.current = { market, category, role };
            preserveComparison.current = true;
            setCategory("all");
            setRole("all");
            setComparedSkill(skill);
            setComparedSource("My route");
          }} />
        </div>

        {error && activeTab !== "route" && <div className="error-banner" role="alert">
          <div><h2>{t("We couldn’t load this snapshot.")}</h2><p>{t("The data service is unavailable. Your filters are saved; try again when it’s ready.")}</p></div>
          <button className="action-button" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</button>
        </div>}
        {loading && !data ? activeTab !== "route" && <div className="loading-panel"><span className="loader" /><h2>{t("Bringing the market into focus.")}</h2><p>{t("Loading the snapshot for your selection.")}</p></div> : data && !error ? <div className="snapshot-content" aria-busy={loading} inert={loading}>
          {activeTab !== "route" && (sampleSize === 0 || sampleSize < 20) && <div className="sample-notice">
            <strong>{sampleSize === 0 ? t("No reviewed vacancies for this selection.") : t("Small snapshot: {count} vacancies.", { count: sampleSize })}</strong>
            <p>{sampleSize === 0 ? t("Try a broader field, role or market. Missing data does not mean there is no hiring.") : t("One vacancy represents about {share}% of this view. Read counts alongside percentages.", { share: Math.round(100 / sampleSize) })}</p>
            {sampleSize === 0 && <button onClick={() => { setMarket("all"); setCategory("all"); setRole("all"); }}>{t("View all sampled roles")}</button>}
          </div>}
          <div className="tab-panel" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={activeTab !== "overview"} tabIndex={0}>
          <div className="overview-insight">
            <h2>{topSkill ? language === "ky" ? <>{leadingSkillNames} бул тандоонун <strong>{Math.round(topSkill.share * 100)}%</strong> бөлүгүндө кездешет.</> : <>{leadingSkillNames} {leadingSkills.length === 1 ? "appears" : "each appear"} in <strong>{Math.round(topSkill.share * 100)}%</strong> of this snapshot.</> : t(sampleSize ? "No skill mentions were classified." : "No skill signals are available yet.")}</h2>
            <p>{topSkill ? t("{count} of {total} vacancies mention {subject}.", { count: topSkill.vacancies_with_skill, total: sampleSize, subject: t(leadingSkills.length === 1 ? "this skill" : "each leading skill") }) : t("Broaden the filters or explore the sample methodology.")} {sampledCategories.length === 1 && unsampledCategories.length > 0 ? t("Current field coverage: {field} only.", { field: t(sampledCategories[0].category.label) }) : t(sampledCategories.length === 1 ? "{count} sampled field." : "{count} sampled fields.", { count: sampledCategories.length })}</p>
          </div>
          <MarketRadar skills={data.skills} onOpenMethodology={openMethodology} onCompareSkill={(skill) => { setComparedSkill(skill); setComparedSource("Radar"); }} scope={`${t(marketOptions.find((item) => item.value === shownSelection.market)?.label ?? "All markets")} / ${shownSelection.category === "all" ? t("All fields") : categories.find((item) => item.code === shownSelection.category)?.label} / ${shownSelection.role === "all" ? t("All roles") : roleLabels.get(shownSelection.role)}`} />

          <section className="kpi-grid" aria-label={t("Snapshot summary")}>
            <article className="kpi-card kpi-primary"><h3>{t("Observed vacancies")}</h3><div className="kpi-value">{data.skills.vacancy_denominator}<small> {t("vacancies")}</small></div><p>{t("In this view · {count} overall", { count: data.overview.included_vacancies })}</p></article>
            <article className="kpi-card"><h3>{t(leadingSkills.length > 1 ? "Most mentioned skills" : "Most mentioned skill")}</h3><div className="kpi-value kpi-word">{leadingSkills.length > 2 ? t("{count} tied skills", { count: leadingSkills.length }) : leadingSkills.map((item) => item.skill).join(" + ") || "—"}</div><p>{topSkill ? t("{count} of {total} vacancies{each}", { count: topSkill.vacancies_with_skill, total: sampleSize, each: leadingSkills.length > 1 ? t(" each") : "" }) : t(sampleSize ? "No skills classified in this sample" : "No reviewed sample for these filters")}</p></article>
            <article className="kpi-card"><h3>{t("Salary disclosure")}</h3><div className="kpi-value">{salaryStats.denominator ? `${Math.round(salaryStats.reported / salaryStats.denominator * 100)}%` : "—"}</div><p>{t("{count} of {total} disclose salary · {ranges} complete ranges", { count: salaryStats.reported, total: salaryStats.denominator, ranges: salaryStats.complete })}</p></article>
            <article className="kpi-card"><h3>{t("No experience required")}</h3><div className="kpi-value">{experienceKnown ? `${Math.round((noExperienceRequired / experienceKnown) * 100)}%` : "—"}</div><p>{experienceKnown ? t("{count} of {total} with known experience", { count: noExperienceRequired, total: experienceKnown }) : t("No experience data in this sample")}</p></article>
          </section>

          {shownSelection.market === "all" && <section className="market-composition" aria-labelledby="composition-heading">
            <div className="composition-heading"><h3 id="composition-heading">{t("Seven markets in scope. One snapshot.")}</h3><p>{dominantMarket ? t("{market} makes up {share}% of this view. Select a country for a clearer comparison.", { market: dominantMarket.label, share: Math.round(dominantMarket.vacancies / sampleSize * 100) }) : t("Country mix shapes the combined results. Select a market to explore.")}</p></div>
            <div className="country-mix">{countryMix.map((item) => <button key={item.value} onClick={() => setMarket(item.value)} aria-label={t("Explore {market}: {count} vacancies", { market: item.label, count: item.vacancies })}>
              <span className="country-identity"><span>{item.value.toUpperCase()}</span>{item.label}</span><strong>{item.vacancies}<small>{t("vacancies")}</small></strong>
              <span className="country-meter" aria-hidden="true"><span style={{ width: `${sampleSize ? item.vacancies / sampleSize * 100 : 0}%` }} /></span>
              <span className="country-share">{item.vacancies === 0 ? t("No reviewed sample") : item.vacancies < 20 ? t("Small sample") : t("{share}% of this view", { share: Math.round(item.vacancies / sampleSize * 100) })}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8H13M8 3L13 8L8 13" /></svg></span>
            </button>)}</div>
          </section>}
          {shownSelection.market === "all" && comparedMarketSkills.length > 0 && <section className="market-skill-comparison" aria-labelledby="market-skills-heading">
            <div className="section-heading"><div><h3 id="market-skills-heading">{t("Skills within each country")}</h3><p>{t("The three most mentioned skills in the combined sample. Each percentage uses that country's own vacancy count; it is not a ranking of hiring volume.")}</p></div></div>
            <ul className="market-skill-list">{countryMix.map((item) => {
              const response = data.marketSkills.find((entry) => entry.market === item.value)?.response;
              const count = response?.vacancy_denominator ?? 0;
              return <li key={item.value} className="market-skill-country">
                <div className="market-skill-country-name"><strong>{item.label}</strong><span>{t("{count} vacancies", { count })}</span>{count > 0 && count < 20 && <em>{t("Small sample")}</em>}</div>
                {count ? <dl>{comparedMarketSkills.map((skill) => {
                  const signal = response?.items.find((entry) => entry.skill === skill.skill);
                  return <div key={skill.skill}><dt>{skill.skill}</dt><dd><strong>{Math.round((signal?.share ?? 0) * 100)}%</strong><span>{signal?.vacancies_with_skill ?? 0} / {count}</span></dd></div>;
                })}</dl> : <p>{t("No reviewed vacancies for this selection.")}</p>}
              </li>;
            })}</ul>
            <p className="section-foot">{t("Small samples can change sharply from one vacancy. These are HeadHunter search results, not total hiring in each country.")}</p>
          </section>}
          </div>

          <div className="tab-panel analysis-grid" role="tabpanel" id="panel-roles" aria-labelledby="tab-roles" hidden={activeTab !== "roles"} tabIndex={0}>
            <nav className="analysis-jump" aria-label={t("Jump to section")}>
              {[["roles", "Role demand"], ["seniority", "Experience & entry routes"], ["skills", "Skills"]].map(([id, label]) => <button type="button" key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })}>{t(label)} <span aria-hidden="true">↓</span></button>)}
            </nav>
            <section className="role-panel" id="roles" aria-labelledby="roles-heading">
              <div className="section-heading"><div><h2 id="roles-heading">{t("Role demand")}</h2><p>{t("Share of the {count} vacancies in this filtered snapshot.", { count: sampleSize })}</p></div></div>
              <h3 className="section-insight">{leadingRole?.vacancies && sampleSize ? roleLeaders.length > 1 ? t("{count} roles tie at {total} vacancies each.", { count: roleLeaders.length, total: leadingRole.vacancies }) : language === "ky" ? <>{t(leadingRole.label)} алдыңкы орунда: <strong>{Math.round(leadingRole.vacancies / sampleSize * 100)}%</strong>.</> : <>{leadingRole.label} leads with <strong>{Math.round(leadingRole.vacancies / sampleSize * 100)}%</strong> of this sample.</> : t("No role sample for these filters.")}</h3>
              {sampledCategories.length === 1 && unsampledCategories.length > 0 && <p className="comparison-note">{t("{field} is the only sampled field. This is not a ranking of the whole IT market.", { field: t(sampledCategories[0].category.label) })}</p>}
              {!!sampledRoleItems.length && <div className="role-chart"><div className="role-axis" aria-hidden="true"><span>{t("Role")}</span><span><i>0%</i><i>50%</i><i>100%</i></span><span>{t("Share / count")}</span></div><div className="role-demand-list">{sampledRoleItems.map(renderRoleRow)}</div></div>}
              {!!unsampledRoleItems.length && <details className="unsampled-roles" open={!sampledRoleItems.length}><summary>{t(unsampledRoleItems.length === 1 ? "{count} role has no reviewed sample" : "{count} roles have no reviewed sample", { count: unsampledRoleItems.length })}</summary><p>{t("These roles are in scope but cannot be compared yet.")}</p>{unsampledRoleItems.map(renderRoleRow)}</details>}
              <p className="section-foot">{t("Select a role to explore it. Counts reflect configured searches, not the entire job market.")}</p>
            </section>

            <section className="seniority-panel" id="seniority" aria-labelledby="seniority-heading">
              <div className="section-heading"><div><h2 id="seniority-heading">{t("Experience & entry routes")}</h2><p>{t("Direct experience requirements and inferred seniority.")}</p></div></div>
              <div className="experience-profile">
              <h3 className="list-heading">{largestSeniority?.vacancies ? largestSeniority.seniority === "Unknown" ? <><strong>{Math.round(largestSeniority.share * 100)}%</strong> {t("have unclassified seniority")}</> : <>{t(largestSeniority.seniority)}: <strong>{Math.round(largestSeniority.share * 100)}%</strong> {t("of this snapshot")}</> : t("Seniority has not been sampled")}</h3>
              {!!data.seniority.vacancy_denominator && <div className="experience-axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>}
              {!!data.seniority.vacancy_denominator && <div className="experience-composition" role="img" aria-label={data.seniority.items.map((item) => t("{level}: {count} of {total}", { level: t(item.seniority), count: item.vacancies, total: data.seniority.vacancy_denominator })).join(", ")}>
                {data.seniority.items.map((item) => <span key={item.seniority} data-level={item.seniority} title={`${t(item.seniority)}: ${Math.round(item.share * 100)}%`} style={{ width: `${item.share * 100}%`, backgroundColor: levelColors[item.seniority] }} />)}
              </div>}
              <div className="seniority-list">
                {data.seniority.vacancy_denominator ? data.seniority.items.map((item) => <div className="level-row" key={item.seniority} data-level={item.seniority} data-dominant={item.vacancies > 0 && item.vacancies === largestSeniority?.vacancies}>
                  <div className="level-name"><span className="level-dot" style={{ backgroundColor: levelColors[item.seniority] }} />{t(item.seniority)}</div>
                  <div className="level-count"><strong>{Math.round(item.share * 100)}%</strong><small>{item.vacancies} {t("vacancies")}</small></div>
                </div>) : <p className="empty-state">{t("No seniority sample for these filters.")}</p>}
              </div>
              <p className="section-foot">{unknownSeniority?.vacancies ? <><strong>{t("{count} of {total} remain unclassified.", { count: unknownSeniority.vacancies, total: data.seniority.vacancy_denominator })}</strong> </> : null}{t("Levels are inferred from titles, descriptions and experience bands.")}</p>
              </div>
              <div className="entry-signal"><div><span>{t("No experience required")}</span><strong>{experienceKnown ? `${Math.round(noExperienceRequired / experienceKnown * 100)}%` : "—"}<small>{experienceKnown ? t("{count} of {total} vacancies", { count: noExperienceRequired, total: experienceKnown }) : t("No experience data")}</small></strong></div><p>{t("A stated requirement, separate from a Junior classification.")}</p></div>
            </section>

          <section className="skills-section" id="skills" aria-labelledby="skills-heading">
            <div className="section-heading"><div><h2 id="skills-heading">{t("Skill demand by field")}</h2><p>{t("Percentage of vacancies that mention a skill, using each field’s own sample.")}</p></div><span className="sample-label">{t("{count} sampled fields", { count: sampledCategories.length })}</span></div>
            <h3 className="section-insight">{sampledCategories.length > 1 && sharedSkill ? language === "ky" ? <>{sharedSkill} маалыматы бар <strong>{sampledCategories.length} багыттын {sharedFieldCount}</strong> ичинде кездешет.</> : <>{sharedSkill} appears in <strong>{sharedFieldCount} of {sampledCategories.length}</strong> sampled fields.</> : topSkill && sampledCategories.length === 1 ? t(leadingSkills.length === 1 ? "{skills} leads skill mentions in {field}." : "{skills} lead skill mentions in {field}.", { skills: leadingSkillNames, field: t(sampledCategories[0].category.label) }) : t("No skill comparison is available yet.")}</h3>
            {sampledCategories.length === 1 && <p className="comparison-note"><strong>{t("{field} · {count} vacancies.", { field: t(sampledCategories[0].category.label), count: sampledCategories[0].response.vacancy_denominator })}</strong> {t(data.categorySkills.length > 1 ? "Cross-field comparison needs a sample from another field." : "Choose All fields to compare available field samples.")}</p>}
            {!!unsampledCategories.length && <div className="field-coverage"><span>{t("Not sampled")}</span><ul>{unsampledCategories.map(({ category: item }) => <li key={item.code}>{t(item.label)}</li>)}</ul></div>}
            <div className="matrix-wrap">
              {!!matrixSkills.length && <table className={`skill-matrix${sampledCategories.length === 1 ? " single-field" : ""}`}>
                <caption className="sr-only">{t("Skill frequency by IT field")}</caption>
                <thead><tr><th scope="col">{t("Skill")}</th>{sampledCategories.map(({ category: item, response }) => <th scope="col" key={item.code}>{t(item.label)}<small>{t("{count} vacancies · 0–100% scale", { count: response.vacancy_denominator })}</small></th>)}</tr></thead>
                <tbody>{matrixSkills.map((skill) => <tr key={skill} data-skill={skill} tabIndex={skill === comparedSkill ? -1 : undefined}>
                  <th scope="row">{skill}{skill === comparedSkill && <span className="matrix-row-context">{t("From {source} · Observed {date}", { source: t(comparedSource), date: formatDate(data.overview.last_seen_at) })}</span>}</th>
                  {sampledCategories.map(({ category: item, response }) => {
                    const signal = response.items.find((entry) => entry.skill === skill);
                    const share = signal?.share ?? 0;
                    return <td key={item.code} data-label={t(item.label)} className="matrix-value" aria-label={t("{field}: {share}%, {count} of {total} vacancies", { field: t(item.label), share: Math.round(share * 100), count: signal?.vacancies_with_skill ?? 0, total: response.vacancy_denominator })}>
                      <span className="matrix-stat"><strong>{Math.round(share * 100)}%</strong><small>{signal?.vacancies_with_skill ?? 0} / {response.vacancy_denominator}</small></span>
                      <span className="matrix-meter" data-empty={!share} aria-hidden="true"><span style={{ width: `${share * 100}%` }} /></span>
                    </td>;
                  })}
                </tr>)}</tbody>
              </table>}
              {!matrixSkills.length && <p className="empty-state">{t(sampledCategories.length ? "No skills matched the dictionary in these reviewed vacancies." : "No reviewed skill sample for these fields yet.")}</p>}
            </div>
            {!!matrixSkills.length && <div className="section-foot matrix-legend"><span><i /> {t("Bar length = share of vacancies · 0–100%")}</span><span>{t("Counts stay visible. A 0% match is different from a field with no sample.")}</span></div>}
          </section>
          </div>

          <div className="tab-panel" role="tabpanel" id="panel-salary" aria-labelledby="tab-salary" hidden={activeTab !== "salary"} tabIndex={0}>
          <SalaryPanel active={activeTab === "salary"} selection={shownSelection} allRows={data.salaries} snapshotDate={data.overview.last_seen_at} markets={orderedMarkets} roleLabels={roleLabels} modelExplanation={data.model.explanation} />
          </div>


        </div> : null}
        <footer className="page-footer"><a className="footer-brand" href="#overview">SkillScope.</a><span>{t("Selected IT markets, in focus.")}</span><a className="footer-privacy" href="/privacy">{t("Privacy & storage")}</a>{data && <span>{t("Last observed {date}", { date: formatDate(data.overview.last_seen_at) })}</span>}</footer>
      </main>
      <AskSkillScope open={askOpen} onOpenChange={setAskOpen} launcherHidden={activeTab === "route"} />
    </div>
  );
}

function buildSkillMatrix(
  categories: Array<{ category: TaxonomyCategory; response: SkillsResponse }>,
  comparedSkill: string | null = null,
) {
  const totals = new Map<string, { fields: number; share: number }>();
  for (const { response } of categories) {
    for (const item of response.items) {
      const total = totals.get(item.skill) ?? { fields: 0, share: 0 };
      total.fields += 1;
      total.share += item.share;
      totals.set(item.skill, total);
    }
  }
  const leading = [...totals]
    .sort((first, second) => second[1].fields - first[1].fields || second[1].share - first[1].share)
    .slice(0, 8)
    .map(([skill]) => skill);
  if (comparedSkill && totals.has(comparedSkill) && !leading.includes(comparedSkill)) leading.push(comparedSkill);
  return leading;
}


export default App;
