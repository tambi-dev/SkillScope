import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getModelInsights,
  getOverview,
  getSalaries,
  getSeniority,
  getSkills,
} from "./api";
import type {
  MarketCode,
  ModelInsights,
  Overview,
  RoleCode,
  SalaryGroup,
  SeniorityLevel,
  SeniorityResponse,
  SkillsResponse,
} from "./types";

const roleOptions: Array<{ value: RoleCode | "all"; label: string }> = [
  { value: "all", label: "All data roles" },
  { value: "data_analyst", label: "Data Analyst" },
  { value: "bi_analyst", label: "BI Analyst" },
  { value: "data_scientist", label: "Data Scientist" },
  { value: "ml_engineer", label: "ML Engineer" },
];

const marketOptions: Array<{ value: MarketCode | "all"; label: string }> = [
  { value: "all", label: "All markets" },
  { value: "kg", label: "Kyrgyzstan" },
  { value: "kz", label: "Kazakhstan" },
  { value: "uz", label: "Uzbekistan" },
];

const levelColors: Record<SeniorityLevel, string> = {
  Junior: "#a8f07a",
  Middle: "#54c6c2",
  Senior: "#85a9ff",
  Unknown: "#62747d",
};

interface DashboardData {
  overview: Overview;
  skills: SkillsResponse;
  salaries: SalaryGroup[];
  seniority: SeniorityResponse;
  model: ModelInsights;
}

function App() {
  const [market, setMarket] = useState<MarketCode | "all">("all");
  const [role, setRole] = useState<RoleCode | "all">("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    Promise.all([
      getOverview(controller.signal),
      getSkills(market, role, controller.signal),
      getSalaries(market, role, controller.signal),
      getSeniority(market, role, controller.signal),
      getModelInsights(controller.signal),
    ])
      .then(([overview, skills, salaries, seniority, model]) => {
        if (current) setData({ overview, skills, salaries, seniority, model });
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
  }, [market, role, retry]);

  const salaryStats = { reported: 0, denominator: 0, complete: 0 };
  for (const row of data?.salaries ?? []) {
    salaryStats.reported += row.vacancies_with_reported_salary;
    salaryStats.denominator += row.included_vacancies;
    salaryStats.complete += row.complete_salary_ranges;
  }

  const topSkill = data?.skills.items[0];
  const unknownCount =
    data?.seniority.items.find((item) => item.seniority === "Unknown")?.vacancies ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="SkillScope home">
          <span className="brand-mark">S</span>
          <span className="brand-name">SkillScope</span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Dashboard sections">
          <a className="nav-link" href="#overview"><span>◫</span> Overview</a>
          <a className="nav-link" href="#skills"><span>◈</span> Skills map</a>
          <a className="nav-link" href="#salary"><span>⌁</span> Salary signals</a>
          <a className="nav-link" href="#seniority"><span>↗</span> Seniority</a>
          <a className="nav-link" href="#methodology"><span>◎</span> Methodology</a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="source-card">
          <div className="source-icon">↗</div>
          <div>
            <div className="source-title">
              {data?.overview.data_mode === "demo"
                ? "Demo data snapshot"
                : data
                  ? "Latest data snapshot"
                  : "Data source status"}
            </div>
            <div className="source-copy">HeadHunter public API</div>
          </div>
          {data && !loading && !error && <span className="live-dot" aria-label="Snapshot loaded" />}
        </div>
        <div className="sidebar-foot">CENTRAL ASIA · 3 MARKETS</div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><i>/</i> Market overview</div>
          <div className="topbar-right">
            <span className="snapshot-status">{data && !loading && !error && <span className="live-dot" />}
              {error ? "Data unavailable" : loading ? "Loading snapshot" : data?.overview.data_mode === "demo"
                ? "Demo snapshot"
                : data
                  ? "Latest snapshot"
                  : "Connecting"}
            </span>
            <span className="avatar">SS</span>
          </div>
        </header>

        <div className="page-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> MARKET INTELLIGENCE</div>
              <h1>Data talent,<br /><em>in focus.</em></h1>
              <p className="lede">
                A transparent look at the skills and roles shaping Central Asia’s data workforce.
              </p>
            </div>
            <div className="heading-note">
              <span className="note-index">01 / 04</span>
              <span>Evidence first.<br />Assumptions visible.</span>
              <span className="note-line" />
            </div>
          </section>

          <section className="filter-row" aria-label="Dashboard filters">
            <div className="filter-caption"><span className="filter-icon">⌄</span> Explore by</div>
            <label className="select-wrap">
              <span className="sr-only">Market</span>
              <select aria-label="Market" value={market} onChange={(event) => setMarket(event.target.value as MarketCode | "all")}>
                {marketOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="select-wrap">
              <span className="sr-only">Role family</span>
              <select aria-label="Role family" value={role} onChange={(event) => setRole(event.target.value as RoleCode | "all")}>
                {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <span className="filter-hint">All indicators follow these filters</span>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <strong>Couldn’t reach the data service.</strong>
              <span>The snapshot could not be loaded. Please try again.</span>
              <button className="retry-button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="loading-panel" role="status"><span className="loader" /> Loading market snapshot…</div>
          ) : data && !error ? (
            <>
              <section className="kpi-grid" aria-label="Snapshot summary">
                <article className="kpi-card kpi-primary">
                  <div className="kpi-top"><span>CORE VACANCIES</span><span className="kpi-mark">01</span></div>
                  <div className="kpi-value">{data.skills.vacancy_denominator}<small> vacancies</small></div>
                  <div className="kpi-foot"><span className="tiny-dash" />In this view · {data.overview.included_vacancies} in the full snapshot</div>
                </article>
                <article className="kpi-card">
                  <div className="kpi-top"><span>TOP SKILL IN VIEW</span><span className="kpi-mark">02</span></div>
                  <div className="kpi-value kpi-word">{topSkill?.skill ?? "—"}</div>
                  <div className="kpi-foot"><span className="tiny-dash mint" />
                    {topSkill ? `${topSkill.vacancies_with_skill} of ${data.skills.vacancy_denominator} vacancies` : "No skill mentions in this view"}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="kpi-top"><span>SALARY DISCLOSURE</span><span className="kpi-mark">03</span></div>
                  <div className="kpi-value">{salaryStats.reported}<small> / {salaryStats.denominator}</small></div>
                  <div className="kpi-foot"><span className="tiny-dash blue" />{salaryStats.complete} complete ranges · never imputed</div>
                </article>
                <article className="kpi-card">
                  <div className="kpi-top"><span>LEVEL UNKNOWN</span><span className="kpi-mark">04</span></div>
                  <div className="kpi-value">{unknownCount}<small> vacancies</small></div>
                  <div className="kpi-foot"><span className="tiny-dash amber" />Kept as unknown, not guessed</div>
                </article>
              </section>

              {market === "all" && (
                <p className="sample-context">
                  Country mix in this view: {marketOptions.filter((option) => option.value !== "all").map((option) =>
                    `${option.label} ${data.salaries.filter((row) => row.market === option.value).reduce((sum, row) => sum + row.included_vacancies, 0)}`,
                  ).join(" · ")}. Combined results reflect this mix.
                </p>
              )}

              <section className="chart-grid" id="skills">
                <article className="panel skill-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow small">DEMAND SIGNALS</div>
                      <h2>Skills employers<br />keep asking for</h2>
                    </div>
                    <span className="panel-tag">TOP 8</span>
                  </div>
                  <p className="panel-description">Share of vacancies in the selected view mentioning each skill.</p>
                  <div className="chart-area skill-chart">
                    {data.skills.items.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.skills.items} layout="vertical" margin={{ top: 2, right: 18, left: 2, bottom: 2 }}>
                          <CartesianGrid horizontal={false} stroke="#20343d" />
                          <XAxis type="number" domain={[0, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tick={{ fill: "#a4b4bc", fontSize: 13 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="skill" width={108} tick={{ fill: "#d7e0e3", fontSize: 14 }} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: "#20343d", opacity: 0.6 }} contentStyle={{ background: "#12242c", border: "1px solid #2b424b", borderRadius: 10, color: "#f4f7f5" }} formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Vacancies"]} />
                          <Bar dataKey="share" radius={[0, 5, 5, 0]} maxBarSize={18} animationDuration={650} isAnimationActive={!reducedMotion}>
                            {data.skills.items.map((item, index) => <Cell key={item.skill} fill={index === 0 ? "#b6f28c" : index === 1 ? "#54c6c2" : "#7894f5"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="empty-state">No skill signals for these filters yet.</div>}
                  </div>
                  <div className="chart-foot"><span>n = {data.skills.vacancy_denominator}</span><span>Text mentions, not causal effects</span></div>
                </article>

                <article className="panel seniority-panel" id="seniority">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow small">EXPERIENCE PROFILE</div>
                      <h2>Seniority,<br />with evidence</h2>
                    </div>
                    <span className="panel-tag muted-tag">4 LEVELS</span>
                  </div>
                  <p className="panel-description">Labels use title, description and experience bands. Ambiguous evidence stays unknown.</p>
                  <div className="seniority-list">
                    {data.seniority.items.map((item) => (
                      <div className="level-row" key={item.seniority}>
                        <div className="level-name"><span className="level-dot" style={{ backgroundColor: levelColors[item.seniority] }} />{item.seniority}</div>
                        <div className="level-track"><span style={{ width: `${item.share * 100}%`, backgroundColor: levelColors[item.seniority] }} /></div>
                        <div className="level-count">{item.vacancies}<small> · {Math.round(item.share * 100)}%</small></div>
                      </div>
                    ))}
                  </div>
                  <div className="seniority-callout">
                    <span className="callout-icon">i</span>
                    <span>HH provides experience bands, not official Junior / Middle / Senior labels.</span>
                  </div>
                </article>
              </section>

              <section className="panel salary-panel" id="salary">
                <div className="panel-heading salary-heading">
                  <div>
                    <div className="eyebrow small">SALARY SIGNALS</div>
                    <h2>What the data can — and can’t — say</h2>
                  </div>
                  <div className="salary-badge"><span className="badge-dot" /> Local currencies kept separate</div>
                </div>
                <p className="panel-description">Medians use only vacancies with both salary bounds. Missing values remain unknown.</p>
                <div className="table-wrap" tabIndex={0} role="region" aria-label="Salary summaries; scroll horizontally to see all columns">
                  <table>
                    <thead><tr><th>MARKET</th><th>ROLE</th><th>CURRENCY</th><th>REPORTED</th><th>COMPLETE RANGES</th><th>MEDIAN MIDPOINT</th></tr></thead>
                    <tbody>
                      {data.salaries.map((row) => (
                        <tr key={`${row.market}-${row.role_family}-${row.currency}`}>
                          <td><span className={`market-code market-${row.market}`}>{row.market.toUpperCase()}</span></td>
                          <td>{roleOptions.find((option) => option.value === row.role_family)?.label ?? row.role_family}</td>
                          <td>{row.currency}</td>
                          <td>{row.vacancies_with_reported_salary} / {row.included_vacancies}</td>
                          <td>{row.complete_salary_ranges}</td>
                          <td className={row.median_midpoint_local === null ? "table-muted" : "salary-value"}>
                            {row.median_midpoint_local === null ? "Unknown" : formatCurrency(row.median_midpoint_local, row.currency)}
                          </td>
                        </tr>
                      ))}
                      {!data.salaries.length && <tr><td colSpan={6} className="table-empty">No salary records for these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="model-note">
                  <div className="model-status"><span className="status-pulse" /> SALARY MODEL · NOT READY</div>
                  <p>{data.model.explanation}</p>
                </div>
              </section>

              <section className="method-strip">
                <div className="method-number">METHOD<br />NOTE</div>
                <div><strong>Association is not causation.</strong> Skill frequencies reflect explicit mentions in this HeadHunter snapshot, not the full labour market. Country mix and salary disclosure create selection bias.</div>
                <a href="#methodology">Read methodology <span>↗</span></a>
              </section>

              <section className="panel methodology-panel" id="methodology">
                <div className="eyebrow small">HOW TO READ THIS SNAPSHOT</div>
                <h2>Methodology & limitations</h2>
                <div className="methodology-grid">
                  <div><h3>Scope & coverage</h3><p>Four core roles across Kyrgyzstan, Kazakhstan and Uzbekistan. HeadHunter search results are filtered by title and description. This sample does not cover every hiring channel.</p></div>
                  <div><h3>Skills & seniority</h3><p>Dictionary rules normalize skill aliases. Seniority uses explicit title markers, then description markers, then experience: none → Junior, 1–3 years → Middle, 3–6 → Unknown, 6+ → Senior. These are inferred labels.</p></div>
                  <div><h3>Salary uncertainty</h3><p>Missing salaries stay unknown. A midpoint summarizes an advertised two-sided range; it is not an observed employee salary. Currencies stay separate, no exchange-rate conversion is applied, and gross/net amounts are not harmonized. Small groups and undisclosed salaries limit comparisons.</p></div>
                  <div><h3>Interpretation</h3><p>Group counts are shown to expose small samples. Skill associations cannot establish salary effects. No salary model has been trained.</p></div>
                </div>
              </section>

              <footer className="page-footer">
                <span>SKILLSCOPE <i>·</i> EVIDENCE-LED MARKET INTELLIGENCE</span>
                <span>Last observed {formatDate(data.overview.last_seen_at)}</span>
              </footer>
            </>
          ) : null}
        </div>
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

function formatDate(value: string | null) {
  if (!value) return "date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "date unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(parsed);
}

export default App;
