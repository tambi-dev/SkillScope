import { useEffect, useState } from "react";
import { getRoles, getSkills } from "./api";
import type { MarketCode, RoleCode, RoleDemandItem, SkillsResponse } from "./types";

interface RoleCompareProps {
  market: MarketCode | "all";
  marketLabel: string;
  observedDate: string;
  onChooseRole: (role: RoleCode) => void;
}

export default function RoleCompare({ market, marketLabel, observedDate, onChooseRole }: RoleCompareProps) {
  const [roles, setRoles] = useState<RoleDemandItem[] | null>(null);
  const [firstRole, setFirstRole] = useState<RoleCode>("");
  const [secondRole, setSecondRole] = useState<RoleCode>("");
  const [profiles, setProfiles] = useState<[SkillsResponse, SkillsResponse] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getRoles(market, "all", controller.signal).then((response) => {
      const available = response.items.filter((item) => item.vacancies > 0)
        .sort((a, b) => b.vacancies - a.vacancies || a.label.localeCompare(b.label));
      setRoles(available);
      setFirstRole(available[0]?.code ?? "");
      setSecondRole(available[1]?.code ?? "");
      setProfiles(null);
      setError(false);
    }).catch(() => {
      if (!controller.signal.aborted) { setError(true); setRoles([]); }
    });
    return () => controller.abort();
  }, [market]);

  useEffect(() => {
    if (!firstRole || !secondRole) return;
    const controller = new AbortController();
    setProfiles(null);
    Promise.all([
      getSkills(market, firstRole, "all", controller.signal, 5),
      getSkills(market, secondRole, "all", controller.signal, 5),
    ]).then(([first, second]) => { setProfiles([first, second]); setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [market, firstRole, secondRole]);

  if (error) return <div className="route-empty" role="alert"><h3>Comparison unavailable.</h3><p>Could not load this market’s role evidence. Try another market or reload the page.</p></div>;
  const marketContext = market === "all" ? "across all markets" : `in ${marketLabel}`;
  if (roles === null) return <div className="route-empty" role="status"><h3>Reading the snapshot…</h3><p>Checking which roles appear {marketContext}.</p></div>;
  if (roles.length === 0) return <div className="route-empty"><h3>No roles to compare in this sample.</h3><p>No configured IT roles matched {marketContext} on HeadHunter. This does not mean no one is hiring.</p></div>;
  if (roles.length === 1) return <div className="route-empty"><h3>Only one role has observations.</h3><p>The sample has {roles[0].vacancies} {roles[0].label} vacancies {marketContext}. A second sampled role is needed for comparison.</p><button type="button" className="route-compare-action" onClick={() => onChooseRole(roles[0].code)}>Build this route →</button></div>;

  return <div className="role-compare" aria-label="Compare two roles">
    <div className="role-compare-heading"><h3>Compare two roles</h3><p>Choose a direction using vacancy evidence {marketContext}. Then open its route to mark your skills.</p></div>
    <div className="role-compare-grid">
      {([firstRole, secondRole] as const).map((code, index) => {
        const role = roles.find((item) => item.code === code);
        const profile = profiles?.[index];
        return <div className="role-compare-card" key={index}>
          <label><span>Role {index + 1}</span><select aria-label={`Compare role ${index + 1}`} value={code} onChange={(event) => index === 0 ? setFirstRole(event.target.value) : setSecondRole(event.target.value)}>
            {roles.map((item) => <option key={item.code} value={item.code} disabled={item.code === (index === 0 ? secondRole : firstRole)}>{item.label}</option>)}
          </select></label>
          <p className="role-compare-count"><strong>{role?.vacancies ?? 0}</strong> observed vacancies</p>
          {role && role.vacancies < 20 && <p className="role-compare-caution">Small sample: rankings may shift with one vacancy.</p>}
          <h4>Frequently mentioned skills</h4>
          {!profile ? <p className="role-compare-loading" role="status">Loading skills…</p>
            : profile.items.length === 0 ? <p className="role-compare-loading">No classified skill mentions.</p>
              : <ol className="role-compare-skills">{profile.items.map((item) => <li key={item.skill}><span>{item.skill}</span><strong>{Math.round(item.share * 100)}%</strong><small>{item.vacancies_with_skill} of {profile.vacancy_denominator}</small></li>)}</ol>}
          <button type="button" className="route-compare-action" onClick={() => onChooseRole(code)}>Build this route <span aria-hidden="true">→</span></button>
        </div>;
      })}
    </div>
    <p className="route-method">Counts come from configured HeadHunter searches observed {observedDate}; they do not cover all hiring. {market === "all" && "The combined sample mixes countries unevenly. "}Skill mentions do not measure job fit.</p>
  </div>;
}
