import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MarketRadar from "./MarketRadar";
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

const marketOptions: Array<{ value: MarketCode | "all"; label: string }> = [
  { value: "all", label: "All markets" },
  { value: "kg", label: "Kyrgyzstan" },
  { value: "kz", label: "Kazakhstan" },
  { value: "uz", label: "Uzbekistan" },
];

const dashboardTabs = [
  { id: "overview", label: "Overview" },
  { id: "roles", label: "Roles & experience" },
  { id: "skills", label: "Skills" },
  { id: "salary", label: "Salaries" },
] as const;
type DashboardTab = typeof dashboardTabs[number]["id"];

function tabFromHash(): DashboardTab {
  const hash = window.location.hash.slice(1);
  if (hash === "seniority") return "roles";
  return dashboardTabs.find((tab) => tab.id === hash)?.id ?? "overview";
}

function scrollToWorkspace() {
  requestAnimationFrame(() => {
    const anchor = document.getElementById("workspace-start");
    if (anchor) window.scrollTo({ top: anchor.getBoundingClientRect().top + window.scrollY, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });
}

const levelColors: Record<SeniorityLevel, string> = {
  Junior: "#829744",
  Middle: "#456b3e",
  Senior: "#9eae72",
  Unknown: "#c2c9b4",
};

interface DashboardData {
  selection: { market: MarketCode | "all"; role: RoleCode | "all"; category: CategoryCode | "all" };
  taxonomy: TaxonomyCategory[];
  overview: Overview;
  roles: RoleDemandResponse;
  skills: SkillsResponse;
  categorySkills: Array<{ category: TaxonomyCategory; response: SkillsResponse }>;
  salaries: SalaryGroup[];
  seniority: SeniorityResponse;
  model: ModelInsights;
}

function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>(tabFromHash);
  const [showMethodology, setShowMethodology] = useState(window.location.hash === "#methodology");
  const [market, setMarket] = useState<MarketCode | "all">("all");
  const [role, setRole] = useState<RoleCode | "all">("all");
  const [category, setCategory] = useState<CategoryCode | "all">("all");
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const previousWorkspaceTop = useRef<number | null>(null);

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

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const onNavigation = () => {
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

  function selectTab(tab: DashboardTab) {
    if (tab === activeTab) return;
    rememberWorkspacePosition();
    window.history.pushState(null, "", `#${tab}`);
    setActiveTab(tab);
    scrollToWorkspace();
  }

  function openMethodology() {
    setShowMethodology(true);
    scrollToWorkspace();
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
        const [roles, skills, salaries, seniority, model, categorySkills] = await Promise.all([
          getRoles(market, category, controller.signal),
          getSkills(market, role, category, controller.signal),
          getSalaries(market, role, category, controller.signal),
          getSeniority(market, role, category, controller.signal),
          getModelInsights(controller.signal),
          Promise.all(comparedCategories.map(async (item) => ({
            category: item,
            response: await getSkills(market, role, item.code, controller.signal, 100),
          }))),
        ]);
        if (current) {
          setData({ selection: { market, role, category }, taxonomy, overview, roles, skills, categorySkills, salaries, seniority, model });
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

  const categories = taxonomy;
  const rolesInCategory = taxonomy
    .filter((item) => category === "all" || item.code === category)
    .flatMap((item) => item.roles);
  const roleLabels = new Map(
    taxonomy.flatMap((item) => item.roles.map((entry) => [entry.code, entry.label] as const)),
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
  const matrixSkills = buildSkillMatrix(data?.categorySkills ?? []);
  const sampleSize = data?.skills.vacancy_denominator ?? 0;
  const sampledCategories = data?.categorySkills.filter(({ response }) => response.vacancy_denominator > 0) ?? [];
  const unsampledCategories = data?.categorySkills.filter(({ response }) => response.vacancy_denominator === 0) ?? [];
  const leadingSkills = data?.skills.items.filter((item) => item.vacancies_with_skill === topSkill?.vacancies_with_skill) ?? [];
  const leadingSkillNames = leadingSkills.length > 2 ? `${leadingSkills.length} skills` : leadingSkills.map((item) => item.skill).join(" and ");
  const sampledRoleItems = roleDemandItems.filter((item) => item.vacancies > 0 || sampledCategories.some(({ category: itemCategory }) => itemCategory.code === item.category));
  const unsampledRoleItems = roleDemandItems.filter((item) => !sampledRoleItems.includes(item));
  const leadingRole = sampledRoleItems[0];
  const roleLeaders = sampledRoleItems.filter((item) => item.vacancies === leadingRole?.vacancies);
  const largestSeniority = [...data?.seniority.items ?? []].sort((a, b) => b.vacancies - a.vacancies)[0];
  const unknownSeniority = data?.seniority.items.find((item) => item.seniority === "Unknown");
  const salaryCoverage = salaryStats.denominator ? salaryStats.complete / salaryStats.denominator : 0;
  const countryMix = marketOptions.filter((option) => option.value !== "all").map((option) => ({
    ...option,
    vacancies: (data?.salaries ?? []).filter((row) => row.market === option.value).reduce((sum, row) => sum + row.included_vacancies, 0),
  }));
  const sharedSkill = matrixSkills[0];
  const sharedFieldCount = sampledCategories.filter(({ response }) => response.items.some((item) => item.skill === sharedSkill)).length;

  function renderRoleRow(item: RoleDemandItem) {
    const sampled = sampledRoleItems.includes(item);
    const share = sampleSize ? Math.round(item.vacancies / sampleSize * 100) : 0;
    return <button type="button" className={`role-demand-row${item.vacancies > 0 && item.vacancies === leadingRole?.vacancies ? " leading-role" : ""}`} key={item.code} onClick={() => { setCategory(item.category); setRole(item.code); }} aria-label={`Explore ${item.label}`} aria-describedby={`role-evidence-${item.code}`} aria-pressed={role === item.code}>
      <span className="role-demand-name">{item.label}<svg className="row-explore" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13L13 3M4 3H13V12" /></svg></span>
      {sampled ? <>
        <span className="role-demand-track" data-empty={!item.vacancies} aria-hidden="true"><span style={{ width: `${sampleSize ? item.vacancies / sampleSize * 100 : 0}%` }} /></span>
        <span className="role-demand-count" id={`role-evidence-${item.code}`}><strong>{share}%</strong><small>{item.vacancies} vacancies</small></span>
      </> : <span className="role-not-sampled" id={`role-evidence-${item.code}`}>Not sampled</span>}
    </button>;
  }

  return (
    <div className="app-shell" onClick={(event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const destination = link.hash.slice(1);
      if (!["explore", "methodology", "seniority", ...dashboardTabs.map((tab) => tab.id)].includes(destination)) return;
      event.preventDefault();
      if (destination === "explore") {
        scrollToWorkspace();
        document.querySelector<HTMLSelectElement>('[aria-label="Market"]')?.focus({ preventScroll: true });
      } else if (destination === "methodology") openMethodology();
      else {
        const tab = destination === "seniority" ? "roles" : destination as DashboardTab;
        if (tab === activeTab) scrollToWorkspace();
        else selectTab(tab);
        requestAnimationFrame(() => document.getElementById(`tab-${tab}`)?.focus({ preventScroll: true }));
      }
    }}>
      <a className="skip-link" href="#explore">Skip to market filters</a>
      <header className="site-header">
        <a className="brand" href="#overview" aria-label="SkillScope home"><span className="brand-mark">S</span><span>SkillScope<span className="brand-period">.</span></span></a>
        <span className="header-region">Central Asia</span>
      </header>

      <main id="overview" className="page-wrap">
        <section className={`page-heading${activeTab !== "overview" ? " compact-heading" : ""}`}>
          {activeTab === "overview" ? <>
          <h1>The IT market.<br /><span>On your radar.</span></h1>
          <div className="heading-intro">
            <p>Explore the skills, roles and salary signals across Central Asia. Find a direction worth learning for.</p>
            <a href="#explore" className="text-link">Explore the market <span aria-hidden="true">↘</span></a>
          </div>
          </> : <><h1>{dashboardTabs.find((tab) => tab.id === activeTab)?.label}</h1><p className="tab-intro">{activeTab === "roles" ? "Find the roles and experience levels in your market." : activeTab === "skills" ? "Compare the skills connecting different IT fields." : "Explore advertised salary ranges and their coverage."}</p></>}
        </section>

        <div id="workspace-start" />
        <div className="workspace-controls">
          <div className="dashboard-tabs" role="tablist" aria-label="Market analysis">
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
            >{tab.label}</button>)}
          </div>
        <section className="explore-section" id="explore" aria-label="Dashboard filters">
          <div className="filter-row">
            <label className="filter-control"><span>Market</span>
              <select aria-label="Market" value={market} onChange={(event) => setMarket(event.target.value as MarketCode | "all")}>
                {marketOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="filter-control"><span>Field</span>
              <select aria-label="Field" value={category} onChange={(event) => { setCategory(event.target.value); setRole("all"); }}>
                <option value="all">All fields</option>
                {categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <label className="filter-control role-filter"><span>Role</span>
              <select aria-label="Role family" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="all">All {category === "all" ? "IT" : "field"} roles</option>
                {rolesInCategory.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <button className="reset-button" disabled={market === "all" && category === "all" && role === "all"} onClick={() => { setMarket("all"); setCategory("all"); setRole("all"); }}>Reset filters</button>
          </div>
          <div className="snapshot-line">
            <span className="snapshot-status" role="status"><span className="status-dot" />{error ? "Snapshot unavailable" : loading ? data ? "Updating · previous snapshot shown" : "Reading snapshot…" : data?.overview.data_mode === "demo" ? "Demo snapshot" : "Local snapshot"}</span>
            <div className="snapshot-meta"><span>{data ? `Observed ${formatDate(data.overview.last_seen_at)} · HeadHunter` : "HeadHunter vacancy snapshots"}</span><button className="methodology-button" aria-expanded={showMethodology} aria-controls="methodology" onClick={() => { setShowMethodology((value) => !value); scrollToWorkspace(); }}>About the data</button></div>
          </div>
        </section>
        </div>

          <section className="methodology-panel" id="methodology" aria-labelledby="methodology-heading" hidden={!showMethodology}>
            <button className="methodology-close" onClick={() => { setShowMethodology(false); document.querySelector<HTMLButtonElement>(".methodology-button")?.focus({ preventScroll: true }); }}>Close methodology</button>
            <div className="methodology-intro"><h2 id="methodology-heading">A snapshot.<br />With perspective.</h2><p>Good decisions start with knowing what the data can tell you, and where it stops.</p><span>Source: HeadHunter public API</span></div>
            <div className="methodology-details">
              <details><summary>Scope & coverage</summary><p>Ten roles across Data & AI, Software Engineering, DevOps & Cloud, Cybersecurity and QA in Kyrgyzstan, Kazakhstan and Uzbekistan. HeadHunter search results are filtered by title and description. This sample does not cover every hiring channel; fields without reviewed vacancies are marked as not sampled.</p></details>
              <details><summary>Skills & seniority</summary><p>Dictionary rules normalize skill aliases. Seniority is inferred from explicit title markers, then description markers, then HeadHunter experience bands. Vacancies requiring no experience are also tracked as an access signal; they are not treated as a confirmed Junior label.</p></details>
              <details><summary>Salary uncertainty</summary><p>Missing salaries stay unknown. A midpoint summarizes an advertised two-sided range; it is not an observed employee salary. Currencies stay separate, no exchange-rate conversion is applied, and gross/net amounts are not harmonized. Small groups and undisclosed salaries limit comparisons.</p></details>
              <details><summary>Reading the signals</summary><p>Skill frequencies reflect explicit mentions in this HeadHunter snapshot, not the full labour market. Group counts expose small samples. Country mix and salary disclosure create selection bias. Skill associations cannot establish salary effects. No salary model has been trained.</p></details>
            </div>
          </section>

        {error && <div className="error-banner" role="alert">
          <div><h2>We couldn’t load this snapshot.</h2><p>The data service is unavailable. Your filters are saved; try again when it’s ready.</p></div>
          <button className="action-button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>}
        {loading && !data ? <div className="loading-panel"><span className="loader" /><h2>Bringing the market into focus.</h2><p>Loading the snapshot for your selection.</p></div> : data && !error ? <div className="snapshot-content" aria-busy={loading} inert={loading}>
          {(sampleSize === 0 || sampleSize < 20) && <div className="sample-notice">
            <strong>{sampleSize === 0 ? "No reviewed vacancies for this selection." : `Small snapshot: ${sampleSize} vacancies.`}</strong>
            <p>{sampleSize === 0 ? "Try a broader field, role or market. Missing data does not mean there is no hiring." : `One vacancy represents about ${Math.round(100 / sampleSize)}% of this view. Read counts alongside percentages.`}</p>
            {sampleSize === 0 && <button onClick={() => { setMarket("all"); setCategory("all"); setRole("all"); }}>View all sampled roles</button>}
          </div>}
          <div className="tab-panel" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={activeTab !== "overview"} tabIndex={0}>
          <div className="overview-insight">
            <h2>{topSkill ? <>{leadingSkillNames} {leadingSkills.length === 1 ? "appears" : "each appear"} in <strong>{Math.round(topSkill.share * 100)}%</strong> of this snapshot.</> : sampleSize ? "No skill mentions were classified." : "No skill signals are available yet."}</h2>
            <p>{topSkill ? `${topSkill.vacancies_with_skill} of ${sampleSize} vacancies mention ${leadingSkills.length === 1 ? "this skill" : "each leading skill"}.` : "Broaden the filters or explore the sample methodology."} {sampledCategories.length === 1 && unsampledCategories.length > 0 ? `Current field coverage: ${sampledCategories[0].category.label} only.` : `${sampledCategories.length} sampled ${sampledCategories.length === 1 ? "field" : "fields"}.`}</p>
          </div>
          <MarketRadar skills={data.skills} onOpenMethodology={openMethodology} scope={`${marketOptions.find((item) => item.value === shownSelection.market)?.label} / ${shownSelection.category === "all" ? "All fields" : categories.find((item) => item.code === shownSelection.category)?.label} / ${shownSelection.role === "all" ? "All roles" : roleLabels.get(shownSelection.role)}`} />

          <section className="kpi-grid" aria-label="Snapshot summary">
            <article className="kpi-card kpi-primary"><h3>Observed vacancies</h3><div className="kpi-value">{data.skills.vacancy_denominator}<small> vacancies</small></div><p>In this view · {data.overview.included_vacancies} overall</p></article>
            <article className="kpi-card"><h3>Most mentioned {leadingSkills.length > 1 ? "skills" : "skill"}</h3><div className="kpi-value kpi-word">{leadingSkills.length > 2 ? `${leadingSkills.length} tied skills` : leadingSkills.map((item) => item.skill).join(" + ") || "—"}</div><p>{topSkill ? `${topSkill.vacancies_with_skill} of ${sampleSize} vacancies${leadingSkills.length > 1 ? " each" : ""}` : sampleSize ? "No skills classified in this sample" : "No reviewed sample for these filters"}</p></article>
            <article className="kpi-card"><h3>Salary disclosure</h3><div className="kpi-value">{salaryStats.denominator ? `${Math.round(salaryStats.reported / salaryStats.denominator * 100)}%` : "—"}</div><p>{salaryStats.reported} of {salaryStats.denominator} disclose salary · {salaryStats.complete} complete ranges</p></article>
            <article className="kpi-card"><h3>No experience required</h3><div className="kpi-value">{experienceKnown ? `${Math.round((noExperienceRequired / experienceKnown) * 100)}%` : "—"}</div><p>{experienceKnown ? `${noExperienceRequired} of ${experienceKnown} with known experience` : "No experience data in this sample"}</p></article>
          </section>

          {shownSelection.market === "all" && <section className="market-composition" aria-labelledby="composition-heading">
            <div className="composition-heading"><h3 id="composition-heading">Three markets. One snapshot.</h3><p>Country mix shapes the combined results. Select a market to explore.</p></div>
            <div className="country-mix">{countryMix.map((item) => <button key={item.value} onClick={() => setMarket(item.value)} aria-label={`Explore ${item.label}: ${item.vacancies} vacancies`}>
              <span className="country-identity"><span>{item.value.toUpperCase()}</span>{item.label}</span><strong>{item.vacancies}<small>vacancies</small></strong>
              <span className="country-meter" aria-hidden="true"><span style={{ width: `${sampleSize ? item.vacancies / sampleSize * 100 : 0}%` }} /></span>
              <span className="country-share">{sampleSize ? `${Math.round(item.vacancies / sampleSize * 100)}% of this view` : "No reviewed sample"}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8H13M8 3L13 8L8 13" /></svg></span>
            </button>)}</div>
          </section>}
          </div>

          <div className="tab-panel analysis-grid" role="tabpanel" id="panel-roles" aria-labelledby="tab-roles" hidden={activeTab !== "roles"} tabIndex={0}>
            <section className="role-panel" id="roles" aria-labelledby="roles-heading">
              <div className="section-heading"><div><h2 id="roles-heading">Role demand</h2><p>Share of the {sampleSize} vacancies in this filtered snapshot.</p></div></div>
              <h3 className="section-insight">{leadingRole?.vacancies && sampleSize ? roleLeaders.length > 1 ? `${roleLeaders.length} roles tie at ${leadingRole.vacancies} vacancies each.` : <>{leadingRole.label} leads with <strong>{Math.round(leadingRole.vacancies / sampleSize * 100)}%</strong> of this sample.</> : "No role sample for these filters."}</h3>
              {sampledCategories.length === 1 && unsampledCategories.length > 0 && <p className="comparison-note">{sampledCategories[0].category.label} is the only sampled field. This is not a ranking of the whole IT market.</p>}
              {!!sampledRoleItems.length && <div className="role-chart"><div className="role-axis" aria-hidden="true"><span>Role</span><span><i>0%</i><i>50%</i><i>100%</i></span><span>Share / count</span></div><div className="role-demand-list">{sampledRoleItems.map(renderRoleRow)}</div></div>}
              {!!unsampledRoleItems.length && <details className="unsampled-roles" open={!sampledRoleItems.length}><summary>{unsampledRoleItems.length} {unsampledRoleItems.length === 1 ? "role has" : "roles have"} no reviewed sample</summary><p>These roles are in scope but cannot be compared yet.</p>{unsampledRoleItems.map(renderRoleRow)}</details>}
              <p className="section-foot">Select a role to explore it. Counts reflect configured searches, not the entire job market.</p>
            </section>

            <section className="seniority-panel" id="seniority" aria-labelledby="seniority-heading">
              <div className="section-heading"><div><h2 id="seniority-heading">Experience & entry routes</h2><p>Direct experience requirements and inferred seniority.</p></div></div>
              <div className="experience-profile">
              <h3 className="list-heading">{largestSeniority?.vacancies ? largestSeniority.seniority === "Unknown" ? <><strong>{Math.round(largestSeniority.share * 100)}%</strong> have unclassified seniority</> : <>{largestSeniority.seniority}: <strong>{Math.round(largestSeniority.share * 100)}%</strong> of this snapshot</> : "Seniority has not been sampled"}</h3>
              {!!data.seniority.vacancy_denominator && <div className="experience-axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>}
              {!!data.seniority.vacancy_denominator && <div className="experience-composition" role="img" aria-label={data.seniority.items.map((item) => `${item.seniority}: ${item.vacancies} of ${data.seniority.vacancy_denominator}`).join(", ")}>
                {data.seniority.items.map((item) => <span key={item.seniority} data-level={item.seniority} title={`${item.seniority}: ${Math.round(item.share * 100)}%`} style={{ width: `${item.share * 100}%`, backgroundColor: levelColors[item.seniority] }} />)}
              </div>}
              <div className="seniority-list">
                {data.seniority.vacancy_denominator ? data.seniority.items.map((item) => <div className="level-row" key={item.seniority} data-level={item.seniority} data-dominant={item.vacancies > 0 && item.vacancies === largestSeniority?.vacancies}>
                  <div className="level-name"><span className="level-dot" style={{ backgroundColor: levelColors[item.seniority] }} />{item.seniority}</div>
                  <div className="level-count"><strong>{Math.round(item.share * 100)}%</strong><small>{item.vacancies} vacancies</small></div>
                </div>) : <p className="empty-state">No seniority sample for these filters.</p>}
              </div>
              <p className="section-foot">{unknownSeniority?.vacancies ? <><strong>{unknownSeniority.vacancies} of {data.seniority.vacancy_denominator} remain unclassified.</strong> </> : null}Levels are inferred from titles, descriptions and experience bands.</p>
              </div>
              <div className="entry-signal"><div><span>No experience required</span><strong>{experienceKnown ? `${Math.round(noExperienceRequired / experienceKnown * 100)}%` : "—"}<small>{experienceKnown ? `${noExperienceRequired} of ${experienceKnown} vacancies` : "No experience data"}</small></strong></div><p>A stated requirement, separate from a Junior classification.</p></div>
            </section>
          </div>

          <div className="tab-panel" role="tabpanel" id="panel-skills" aria-labelledby="tab-skills" hidden={activeTab !== "skills"} tabIndex={0}>
          <section className="skills-section" id="skills" aria-labelledby="skills-heading">
            <div className="section-heading"><div><h2 id="skills-heading">Skill demand by field</h2><p>Percentage of vacancies that mention a skill, using each field’s own sample.</p></div><span className="sample-label">{sampledCategories.length} sampled {sampledCategories.length === 1 ? "field" : "fields"}</span></div>
            <h3 className="section-insight">{sampledCategories.length > 1 && sharedSkill ? <>{sharedSkill} appears in <strong>{sharedFieldCount} of {sampledCategories.length}</strong> sampled fields.</> : topSkill && sampledCategories.length === 1 ? <>{leadingSkillNames} {leadingSkills.length === 1 ? "leads" : "lead"} skill mentions in {sampledCategories[0].category.label}.</> : "No skill comparison is available yet."}</h3>
            {sampledCategories.length === 1 && <p className="comparison-note"><strong>{sampledCategories[0].category.label} · {sampledCategories[0].response.vacancy_denominator} vacancies.</strong> {data.categorySkills.length > 1 ? "Cross-field comparison needs a sample from another field." : "Choose All fields to compare available field samples."}</p>}
            {!!unsampledCategories.length && <div className="field-coverage"><span>Not sampled</span><ul>{unsampledCategories.map(({ category: item }) => <li key={item.code}>{item.label}</li>)}</ul></div>}
            <div className="matrix-wrap">
              {!!matrixSkills.length && <table className={`skill-matrix${sampledCategories.length === 1 ? " single-field" : ""}`}>
                <caption className="sr-only">Skill frequency by IT field</caption>
                <thead><tr><th scope="col">Skill</th>{sampledCategories.map(({ category: item, response }) => <th scope="col" key={item.code}>{item.label}<small>{response.vacancy_denominator} vacancies · 0–100% scale</small></th>)}</tr></thead>
                <tbody>{matrixSkills.map((skill) => <tr key={skill} data-leading={leadingSkills.some((item) => item.skill === skill)}>
                  <th scope="row">{skill}</th>
                  {sampledCategories.map(({ category: item, response }) => {
                    const signal = response.items.find((entry) => entry.skill === skill);
                    const share = signal?.share ?? 0;
                    return <td key={item.code} data-label={item.label} className="matrix-value" aria-label={`${item.label}: ${Math.round(share * 100)}%, ${signal?.vacancies_with_skill ?? 0} of ${response.vacancy_denominator} vacancies`} style={sampledCategories.length > 1 ? { backgroundColor: `rgba(57, 100, 70, ${0.04 + share * 0.22})` } : undefined}>
                      <span className="matrix-stat"><strong>{Math.round(share * 100)}%</strong><small>{signal?.vacancies_with_skill ?? 0} / {response.vacancy_denominator}</small></span>
                      <span className="matrix-meter" data-empty={!share} aria-hidden="true"><span style={{ width: `${share * 100}%` }} /></span>
                    </td>;
                  })}
                </tr>)}</tbody>
              </table>}
              {!matrixSkills.length && <p className="empty-state">{sampledCategories.length ? "No skills matched the dictionary in these reviewed vacancies." : "No reviewed skill sample for these fields yet."}</p>}
            </div>
            {!!matrixSkills.length && <div className="section-foot matrix-legend"><span><i /> Bar length = share of vacancies · 0–100%</span><span>Counts stay visible. A 0% match is different from a field with no sample.</span></div>}
          </section>
          </div>

          <div className="tab-panel" role="tabpanel" id="panel-salary" aria-labelledby="tab-salary" hidden={activeTab !== "salary"} tabIndex={0}>
          <section className="salary-panel" id="salary" aria-labelledby="salary-heading">
            <div className="section-heading"><div><h2 id="salary-heading">Advertised salary evidence</h2><p>Coverage comes first. Salary values only describe the ranges that were published.</p></div><span className="currency-note">Local currencies · No conversion</span></div>
            <div className="salary-evidence">
              <h3 className="section-insight">{salaryStats.denominator ? <><strong className="coverage-total">{salaryStats.complete}<small>of {salaryStats.denominator}</small></strong><span>vacancies have a complete salary range.</span></> : "No salary sample for these filters."}</h3>
              <p>{salaryStats.complete === 0 ? "Salary comparisons are unavailable without complete ranges." : salaryStats.complete < 10 ? "Limited evidence: treat these values as individual salary signals, not typical market pay." : "Compare within the same currency and check the number of ranges behind each value."}</p>
              {salaryStats.denominator > 0 && <div className="coverage-breakdown"><div className="coverage-meter" role="img" aria-label={`${salaryStats.complete} complete ranges, ${salaryStats.reported - salaryStats.complete} incomplete ranges, ${salaryStats.denominator - salaryStats.reported} undisclosed out of ${salaryStats.denominator} vacancies`}><span style={{ width: `${salaryCoverage * 100}%` }} /><span className="coverage-partial" style={{ width: `${(salaryStats.reported - salaryStats.complete) / salaryStats.denominator * 100}%` }} /></div>
                <div className="coverage-labels"><span><i className="coverage-key complete" /><strong>{salaryStats.complete}</strong> complete <small>{Math.round(salaryCoverage * 100)}% of this view</small></span><span><i className="coverage-key partial" /><strong>{salaryStats.reported - salaryStats.complete}</strong> incomplete</span><span><i className="coverage-key absent" /><strong>{salaryStats.denominator - salaryStats.reported}</strong> not disclosed</span></div>
              </div>}
            </div>
            <p className="comparison-note">Values below are medians of advertised range midpoints. They are not measured employee salaries.</p>
            <div className="table-wrap">
              <table className="salary-table">
                <caption className="sr-only">Salary summaries for the selected market, field and role</caption>
                <thead><tr><th scope="col">Market</th><th scope="col">Role</th><th scope="col">Currency</th><th scope="col">With salary / all</th><th scope="col">Complete ranges</th><th scope="col">Median range midpoint</th></tr></thead>
                <tbody>{data.salaries.map((row, index) => <tr key={`${row.market}-${row.role_family}-${row.currency}`} data-market-start={index > 0 && data.salaries[index - 1].market !== row.market} className={row.median_midpoint_local === null ? "salary-missing" : "salary-observed"}>
                  <td data-label="Market"><span className={`market-code market-${row.market}`}>{row.market.toUpperCase()}</span><span className="market-name">{marketOptions.find((item) => item.value === row.market)?.label ?? row.market}</span></td>
                  <th scope="row" className="salary-role">{roleLabels.get(row.role_family) ?? row.role_family}</th>
                  <td data-label="Currency">{row.currency}</td><td data-label="With salary / all">{row.vacancies_with_reported_salary} / {row.included_vacancies}</td><td data-label="Complete ranges">{row.complete_salary_ranges}</td>
                  <td data-label="Median range midpoint" className={row.median_midpoint_local === null ? "table-muted" : "salary-value"}>{row.median_midpoint_local === null ? row.vacancies_with_reported_salary ? "No complete range" : "Not disclosed" : <><strong>{formatCurrency(row.median_midpoint_local, row.currency)}</strong><small className="range-confidence">{row.complete_salary_ranges === 1 ? "Single range only" : `${row.complete_salary_ranges} ranges${row.complete_salary_ranges < 10 ? " · limited sample" : ""}`}</small></>}</td>
                </tr>)}</tbody>
              </table>
              {!data.salaries.length && <p className="empty-state">No salary records for these filters.</p>}
            </div>
            <details className="model-note"><summary>Why there is no salary prediction yet</summary><p>{data.model.explanation}</p></details>
          </section>
          </div>


          <footer className="page-footer"><a className="footer-brand" href="#overview">SkillScope.</a><span>Central Asia’s IT markets, in focus.</span><span>Last observed {formatDate(data.overview.last_seen_at)}</span></footer>
        </div> : null}
      </main>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildSkillMatrix(
  categories: Array<{ category: TaxonomyCategory; response: SkillsResponse }>,
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
  return [...totals]
    .sort((first, second) => second[1].fields - first[1].fields || second[1].share - first[1].share)
    .slice(0, 8)
    .map(([skill]) => skill);
}

function formatDate(value: string | null) {
  if (!value) return "date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "date unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(parsed);
}

export default App;
