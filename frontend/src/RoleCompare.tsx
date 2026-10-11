import { useEffect, useState } from "react";
import { getRoles, getSkills } from "./api";
import { useLanguage } from "./i18n";
import type { MarketCode, RoleCode, RoleDemandItem, SkillsResponse } from "./types";

interface RoleCompareProps {
  market: MarketCode | "all";
  marketLabel: string;
  observedDate: string;
  onChooseRole: (role: RoleCode) => void;
}

export default function RoleCompare({ market, marketLabel, observedDate, onChooseRole }: RoleCompareProps) {
  const { t } = useLanguage();
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

  if (error) return <div className="route-empty" role="alert"><h3>{t("Comparison unavailable.")}</h3><p>{t("Could not load this market’s role evidence. Try another market or reload the page.")}</p></div>;
  const marketContext = market === "all" ? t("across all markets") : t("in {market}", { market: marketLabel });
  if (roles === null) return <div className="route-empty" role="status"><h3>{t("Reading the snapshot…")}</h3><p>{t("Checking which roles appear {market}.", { market: marketContext })}</p></div>;
  if (roles.length === 0) return <div className="route-empty"><h3>{t("No roles to compare in this sample.")}</h3><p>{t("No configured IT roles matched {market} on HeadHunter. This does not mean no one is hiring.", { market: marketContext })}</p></div>;
  if (roles.length === 1) return <div className="route-empty"><h3>{t("Only one role has observations.")}</h3><p>{t("The sample has {count} {role} vacancies {market}. A second sampled role is needed for comparison.", { count: roles[0].vacancies, role: t(roles[0].label), market: marketContext })}</p><button type="button" className="route-compare-action" onClick={() => onChooseRole(roles[0].code)}>{t("Build this route")} →</button></div>;

  return <div className="role-compare" aria-label={t("Compare two roles")}>
    <div className="role-compare-heading"><h3>{t("Compare two roles")}</h3><p>{t("Choose a direction using vacancy evidence {market}. Then open its route to mark your skills.", { market: marketContext })}</p></div>
    <div className="role-compare-grid">
      {([firstRole, secondRole] as const).map((code, index) => {
        const role = roles.find((item) => item.code === code);
        const profile = profiles?.[index];
        return <div className="role-compare-card" key={index}>
          <label><span>{t("Role {number}", { number: index + 1 })}</span><select aria-label={t("Compare role {number}", { number: index + 1 })} value={code} onChange={(event) => index === 0 ? setFirstRole(event.target.value) : setSecondRole(event.target.value)}>
            {roles.map((item) => <option key={item.code} value={item.code} disabled={item.code === (index === 0 ? secondRole : firstRole)}>{t(item.label)}</option>)}
          </select></label>
          <p className="role-compare-count"><strong>{role?.vacancies ?? 0}</strong> {t("observed vacancies")}</p>
          {role && role.vacancies < 20 && <p className="role-compare-caution">{t("Small sample: rankings may shift with one vacancy.")}</p>}
          <h4>{t("Frequently mentioned skills")}</h4>
          {!profile ? <p className="role-compare-loading" role="status">{t("Loading skills…")}</p>
            : profile.items.length === 0 ? <p className="role-compare-loading">{t("No classified skill mentions.")}</p>
              : <ol className="role-compare-skills">{profile.items.map((item) => <li key={item.skill}><span>{item.skill}</span><strong>{Math.round(item.share * 100)}%</strong><small>{t("{count} of {total}", { count: item.vacancies_with_skill, total: profile.vacancy_denominator })}</small></li>)}</ol>}
          <button type="button" className="route-compare-action" onClick={() => onChooseRole(code)}>{t("Build this route")} <span aria-hidden="true">→</span></button>
        </div>;
      })}
    </div>
    <p className="route-method">{t("Counts come from configured HeadHunter searches observed {date}; they do not cover all hiring.", { date: observedDate })} {market === "all" && t("The combined sample mixes countries unevenly. ")}{t("Skill mentions do not measure job fit.")}</p>
  </div>;
}
