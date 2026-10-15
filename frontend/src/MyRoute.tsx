import { useEffect, useState } from "react";
import RoleCompare from "./RoleCompare";
import CareerExplorer from "./CareerExplorer";
import { useLanguage } from "./i18n";
import type { MarketCode, RoleCode, SkillsResponse, TaxonomyCategory } from "./types";

const storageKey = "skillscope-known-skills";

function readKnownSkills(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

interface MyRouteProps {
  markets: Array<{ value: MarketCode; label: string }>;
  taxonomy: TaxonomyCategory[];
  market: MarketCode | "all";
  role: RoleCode | "all";
  skills: SkillsResponse | null;
  observedDate: string;
  loading: boolean;
  dataError: boolean;
  onRetry: () => void;
  onAsk: () => void;
  onMarketChange: (market: MarketCode | "all") => void;
  onRoleChange: (role: RoleCode | "all") => void;
  onCompareSkill: (skill: string) => void;
}

export default function MyRoute({ markets, taxonomy, market, role, skills, observedDate, loading, dataError, onRetry, onAsk, onMarketChange, onRoleChange, onCompareSkill }: MyRouteProps) {
  const { t } = useLanguage();
  const [knownSkills, setKnownSkills] = useState<string[]>(readKnownSkills);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const chosenMarket = market === "all" ? t("all markets") : markets.find((item) => item.value === market)?.label ?? market;
  const marketContext = market === "all" ? t("across all markets") : t("in {market}", { market: chosenMarket });
  const chosenRole = taxonomy.flatMap((item) => item.roles).find((item) => item.code === role)?.label;
  const items = skills?.items ?? [];
  const listedSkills = showAllSkills ? items : items.slice(0, 12);
  const markedHere = items.filter((item) => knownSkills.includes(item.skill)).length;
  const nextSkills = items.filter((item) => !knownSkills.includes(item.skill)).slice(0, 5);
  const ready = role !== "all";

  useEffect(() => {
    try {
      if (knownSkills.length) window.localStorage.setItem(storageKey, JSON.stringify(knownSkills));
      else window.localStorage.removeItem(storageKey);
    } catch { /* Route remains usable without storage. */ }
  }, [knownSkills]);

  function toggleSkill(skill: string) {
    setKnownSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]);
  }

  return <section className="my-route" id="route" aria-labelledby="route-heading">
    <CareerExplorer markets={markets} market={market} onMarketChange={onMarketChange} onExploreRole={(code) => {
      setShowAdvanced(true);
      onRoleChange(code);
      requestAnimationFrame(() => document.getElementById("advanced-route-title")?.focus());
    }} />

    <details className="route-advanced" open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)}>
    <summary id="advanced-route-title">{t("Already know a role? Explore all ten")}</summary>
    <button type="button" className="career-link" id="route-ask" onClick={onAsk}>{t("Ask Mr. Scope about vacancies")}</button>
    <p className="career-note">{t("Compare roles across all markets or choose a country. Then mark skills you know and explore frequent mentions for your role.")} {t("Observed {date} · HeadHunter", { date: observedDate })}</p>
    {showAdvanced && <div className="route-layout">
      <div className="route-inputs">
        <h3>{t("Your direction")}</h3>
        <div className="route-selects">
          <label><span>{t("Market")}</span><select aria-label={t("Route market")} value={market} onChange={(event) => onMarketChange(event.target.value as MarketCode | "all")}>
            <option value="all">{t("All markets")}</option>
            {markets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          <label><span>{t("Role")}</span><select aria-label={t("Route role")} value={role} onChange={(event) => onRoleChange(event.target.value)}>
            <option value="all">{t("Choose a role")}</option>
            {taxonomy.map((group) => <optgroup key={group.code} label={group.label}>{group.roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</optgroup>)}
          </select></label>
        </div>

        {ready && skills && skills.vacancy_denominator > 0 && items.length > 0 && <div className="route-known">
          <div className="route-known-heading"><div><h3>{t("What you already know")}</h3><p>{t("Select any familiar skills from this role’s vacancy sample.")}</p></div><span>{t("{count} marked", { count: markedHere })}</span></div>
          <div className="route-skill-list" aria-label={t("Known skills")}>
            {listedSkills.map((item) => <button type="button" key={item.skill} aria-pressed={knownSkills.includes(item.skill)} onClick={() => toggleSkill(item.skill)}>{item.skill}</button>)}
          </div>
          <div className="route-skill-actions">
            {items.length > 12 && <button type="button" onClick={() => setShowAllSkills((value) => !value)}>{showAllSkills ? t("Show fewer skills") : t("Show all {count} skills", { count: items.length })}</button>}
            {markedHere > 0 && <button type="button" onClick={() => setKnownSkills((current) => current.filter((skill) => !items.some((item) => item.skill === skill)))}>{t("Clear these skills")}</button>}
          </div>
          <p className="route-privacy">{t("Your selections stay in this browser.")}</p>
        </div>}
      </div>

      <div className="route-output">
        {role === "all" ? <RoleCompare key={market} market={market} marketLabel={chosenMarket} observedDate={observedDate} onChooseRole={onRoleChange} />
          : dataError ? <div className="route-empty" role="alert"><h3>{t("Skill evidence unavailable")}</h3><p>{t("The exercises are still available. Retry the snapshot to explore skill mentions.")}</p><button className="career-link" type="button" onClick={onRetry}>{t("Retry evidence")}</button></div>
            : loading || !skills ? <div className="route-empty" role="status"><h3>{t("Reading the snapshot…")}</h3><p>{t("Checking {role} vacancies {market}.", { role: chosenRole ?? "", market: marketContext })}</p></div>
            : skills.vacancy_denominator === 0 ? <div className="route-empty"><h3>{t("No route from this sample yet.")}</h3><p>{t("No reviewed {role} vacancies matched {market} on HeadHunter. Try another market or role; this is not evidence that no one is hiring.", { role: chosenRole ?? "", market: marketContext })}</p></div>
              : items.length === 0 ? <div className="route-empty"><h3>{t("No classified skill signals.")}</h3><p>{t("There are {count} matching vacancies, but none mention a skill in the current dictionary.", { count: skills.vacancy_denominator })}</p></div>
                : <>
                  <div className="route-result-heading"><h3>{t(markedHere ? "Skills to explore next" : "A starting point for this role")}</h3><p>{t("{role} {market} · {count} observed vacancies", { role: chosenRole ?? "", market: marketContext, count: skills.vacancy_denominator })}</p><button type="button" className="route-back-to-compare" onClick={() => onRoleChange("all")}>{t("Compare roles {market}", { market: marketContext })} →</button></div>
                  <p className="sr-only" role="status">{t("{next} skills to explore in this sample. {marked} skills marked as known.", { next: nextSkills.length, marked: markedHere })}</p>
                  {skills.vacancy_denominator < 20 && <p className="route-caution"><strong>{t("Small sample: {count}.", { count: skills.vacancy_denominator })}</strong> {t("One vacancy changes this view by about {share}%. Treat the order as a prompt to investigate.", { share: Math.round(100 / skills.vacancy_denominator) })}</p>}
                  {nextSkills.length ? <ol className="route-recommendations">{nextSkills.map((item) => <li key={item.skill}>
                    <div className="route-skill-main"><strong>{item.skill}</strong><span>{Math.round(item.share * 100)}%</span></div>
                    <p>{t("{count} of {total} vacancies mention this skill", { count: item.vacancies_with_skill, total: skills.vacancy_denominator })}</p>
                    <span className="route-meter" aria-hidden="true"><span style={{ width: `${item.share * 100}%` }} /></span>
                    <a href="#skills" data-compare-skill onClick={() => onCompareSkill(item.skill)} aria-label={t("Compare {skill} across fields", { skill: item.skill })}>{t("Compare across fields")} <span aria-hidden="true">↗</span></a>
                  </li>)}</ol> : <div className="route-empty"><h3>{t("You marked every listed skill.")}</h3><p>{t("This does not measure job readiness. Explore the role’s vacancy evidence and keep checking new snapshots.")}</p></div>}
                  <p className="route-method">{t("Ranked by explicit mentions in this snapshot. A mention is not a job requirement or a measure of your fit.")} {market === "all" && t("The combined sample mixes countries unevenly. ")}{t("The snapshot was observed {date}.", { date: observedDate })}</p>
                </>}
      </div>
    </div>}
    </details>
  </section>;
}
