import { useEffect, useState } from "react";
import RoleCompare from "./RoleCompare";
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
  onMarketChange: (market: MarketCode | "all") => void;
  onRoleChange: (role: RoleCode | "all") => void;
  onCompareSkill: (skill: string) => void;
}

export default function MyRoute({ markets, taxonomy, market, role, skills, observedDate, loading, onMarketChange, onRoleChange, onCompareSkill }: MyRouteProps) {
  const [knownSkills, setKnownSkills] = useState<string[]>(readKnownSkills);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const chosenMarket = market === "all" ? "all markets" : markets.find((item) => item.value === market)?.label ?? market;
  const marketContext = market === "all" ? "across all markets" : `in ${chosenMarket}`;
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
    <div className="route-heading">
      <div><h2 id="route-heading">My route</h2><p>Compare roles across all markets or choose a country. Then mark skills you know and explore frequent mentions for your role.</p></div>
      <span>Observed {observedDate} · HeadHunter</span>
    </div>

    <div className="route-layout">
      <div className="route-inputs">
        <h3>Your direction</h3>
        <div className="route-selects">
          <label><span>Market</span><select aria-label="Route market" value={market} onChange={(event) => onMarketChange(event.target.value as MarketCode | "all")}>
            <option value="all">All markets</option>
            {markets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          <label><span>Role</span><select aria-label="Route role" value={role} onChange={(event) => onRoleChange(event.target.value)}>
            <option value="all">Choose a role</option>
            {taxonomy.map((group) => <optgroup key={group.code} label={group.label}>{group.roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</optgroup>)}
          </select></label>
        </div>

        {ready && skills && skills.vacancy_denominator > 0 && items.length > 0 && <div className="route-known">
          <div className="route-known-heading"><div><h3>What you already know</h3><p>Select any familiar skills from this role’s vacancy sample.</p></div><span>{markedHere} marked</span></div>
          <div className="route-skill-list" aria-label="Known skills">
            {listedSkills.map((item) => <button type="button" key={item.skill} aria-pressed={knownSkills.includes(item.skill)} onClick={() => toggleSkill(item.skill)}>{item.skill}</button>)}
          </div>
          <div className="route-skill-actions">
            {items.length > 12 && <button type="button" onClick={() => setShowAllSkills((value) => !value)}>{showAllSkills ? "Show fewer skills" : `Show all ${items.length} skills`}</button>}
            {markedHere > 0 && <button type="button" onClick={() => setKnownSkills((current) => current.filter((skill) => !items.some((item) => item.skill === skill)))}>Clear these skills</button>}
          </div>
          <p className="route-privacy">Your selections stay in this browser.</p>
        </div>}
      </div>

      <div className="route-output">
        {role === "all" ? <RoleCompare key={market} market={market} marketLabel={chosenMarket} observedDate={observedDate} onChooseRole={onRoleChange} />
          : loading || !skills ? <div className="route-empty" role="status"><h3>Reading the snapshot…</h3><p>Checking {chosenRole} vacancies {marketContext}.</p></div>
            : skills.vacancy_denominator === 0 ? <div className="route-empty"><h3>No route from this sample yet.</h3><p>No reviewed {chosenRole} vacancies matched {marketContext} on HeadHunter. Try another market or role; this is not evidence that no one is hiring.</p></div>
              : items.length === 0 ? <div className="route-empty"><h3>No classified skill signals.</h3><p>There are {skills.vacancy_denominator} matching vacancies, but none mention a skill in the current dictionary.</p></div>
                : <>
                  <div className="route-result-heading"><h3>{markedHere ? "Skills to explore next" : "A starting point for this role"}</h3><p>{chosenRole} {marketContext} · {skills.vacancy_denominator} observed {skills.vacancy_denominator === 1 ? "vacancy" : "vacancies"}</p><button type="button" className="route-back-to-compare" onClick={() => onRoleChange("all")}>Compare roles {marketContext} →</button></div>
                  <p className="sr-only" role="status">{nextSkills.length} skills to explore in this sample. {markedHere} skills marked as known.</p>
                  {skills.vacancy_denominator < 20 && <p className="route-caution"><strong>Small sample: {skills.vacancy_denominator}.</strong> One vacancy changes this view by about {Math.round(100 / skills.vacancy_denominator)}%. Treat the order as a prompt to investigate.</p>}
                  {nextSkills.length ? <ol className="route-recommendations">{nextSkills.map((item) => <li key={item.skill}>
                    <div className="route-skill-main"><strong>{item.skill}</strong><span>{Math.round(item.share * 100)}%</span></div>
                    <p>{item.vacancies_with_skill} of {skills.vacancy_denominator} vacancies mention this skill</p>
                    <span className="route-meter" aria-hidden="true"><span style={{ width: `${item.share * 100}%` }} /></span>
                    <a href="#skills" data-compare-skill onClick={() => onCompareSkill(item.skill)} aria-label={`Compare ${item.skill} across fields`}>Compare across fields <span aria-hidden="true">↗</span></a>
                  </li>)}</ol> : <div className="route-empty"><h3>You marked every listed skill.</h3><p>This does not measure job readiness. Explore the role’s vacancy evidence and keep checking new snapshots.</p></div>}
                  <p className="route-method">Ranked by explicit mentions in this snapshot. A mention is not a job requirement or a measure of your fit. {market === "all" && "The combined sample mixes countries unevenly. "}The snapshot was observed {observedDate}.</p>
                </>}
      </div>
    </div>
  </section>;
}
