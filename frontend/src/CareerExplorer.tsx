import { useEffect, useState } from "react";
import BeginnerTask from "./BeginnerTask";
import CareerEvidence from "./CareerEvidence";
import { careerGuides, careerStorageKey, readCareerProgress } from "./careerGuides";
import type { ActivityDraft, CareerProgress, CareerTrial, GuideId, LocalizedText, RouteView } from "./careerGuides";
import { useLanguage } from "./i18n";
import type { MarketCode } from "./types";

interface Props {
  markets: Array<{ value: MarketCode; label: string }>;
  market: MarketCode | "all";
  onMarketChange: (market: MarketCode | "all") => void;
  onExploreRole: (role: GuideId) => void;
}
function initialProgress() {
  try { return readCareerProgress(window.localStorage.getItem(careerStorageKey)); }
  catch { return readCareerProgress(null); }
}
function focusHeading() {
  requestAnimationFrame(() => {
    const target = document.getElementById("route-heading");
    target?.focus({ preventScroll: true });
    document.querySelector(".career-explorer")?.scrollIntoView({ block: "start", behavior: "instant" });
  });
}
const emptyTrial: CareerTrial = { note: "", decision: "", saved: false, completed: false, draft: {} };

export default function CareerExplorer({ markets, market, onMarketChange, onExploreRole }: Props) {
  const { language, t } = useLanguage();
  const say = (value: LocalizedText) => value[language];
  const [progress, setProgress] = useState<CareerProgress>(initialProgress);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showEvidence, setShowEvidence] = useState(false);
  const chosen = careerGuides.find((guide) => guide.id === progress.selected);
  const trial = chosen ? progress.trials[chosen.id] ?? emptyTrial : emptyTrial;
  const view = chosen ? progress.view : "fields";

  useEffect(() => {
    try { window.localStorage.setItem(careerStorageKey, JSON.stringify(progress)); }
    catch { setStorageAvailable(false); }
  }, [progress]);

  function go(next: RouteView, id = progress.selected) {
    setShowEvidence(false);
    setProgress((current) => ({ ...current, view: next, selected: id }));
    focusHeading();
  }
  function updateTrial(patch: Partial<CareerTrial>) {
    if (!chosen) return;
    setProgress((current) => ({ ...current, trials: { ...current.trials, [chosen.id]: { ...emptyTrial, ...current.trials[chosen.id], ...patch } } }));
  }
  function updateDraft(patch: Partial<ActivityDraft>) { updateTrial({ draft: { ...trial.draft, ...patch }, completed: false }); }
  function finishTask() {
    if (!chosen) return;
    setProgress((current) => ({ ...current, view: "next", trials: { ...current.trials, [chosen.id]: { ...emptyTrial, ...current.trials[chosen.id], completed: true } } }));
    focusHeading();
  }
  function downloadPlan() {
    if (!chosen) return;
    const body = ["SkillScope · " + say(chosen.field), "", t("My reflection"), trial.note || "—", "", t("My next step"), say(chosen.next), "", chosen.resource.label, chosen.resource.url].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `skillscope-${chosen.id}-plan.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="career-explorer" data-stage={view}>
    {view === "fields" ? <>
      <header className="career-intro"><h1 id="route-heading" tabIndex={-1}>{t("Find an IT field you want to try.")}</h1><p>{t("Start with what the work involves. Then try a small task here, with instructions and no setup.")}</p></header>
      <div className="career-field-list">{careerGuides.map((guide) => <button type="button" className="career-field-choice" key={guide.id} onClick={() => go("learn", guide.id)} aria-label={t("Explore {field}", { field: say(guide.field) })}><span><strong>{say(guide.field)}</strong><span>{say(guide.summary)}</span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>)}</div>
      <p className="career-note">{t("Choose out of curiosity. You can come back and try another field at any time.")}</p>
    </> : chosen && <>
      <button type="button" className="career-link career-back" onClick={() => go(view === "practice" ? "learn" : "fields", view === "practice" ? chosen.id : null)}>{t(view === "practice" ? "Back to field explanation" : "See all three fields")}</button>
      <ol className="career-steps" aria-label={t("Route steps")}>{["Understand the field", "Try a short task", "Your next step"].map((label, index) => <li key={label} aria-current={index === (view === "learn" ? 0 : view === "practice" ? 1 : 2) ? "step" : undefined}><span>{index + 1}</span>{t(label)}</li>)}</ol>
      {view === "learn" ? <>
        <header className="career-intro"><h1 id="route-heading" tabIndex={-1}>{say(chosen.field)}</h1><p>{say(chosen.description)}</p></header>
        <div className="career-explanation"><section><h2>{t("What you actually do")}</h2><ul>{chosen.daily.map((item) => <li key={item.en}>{say(item)}</li>)}</ul></section><section className="career-example"><h2>{t("For example")}</h2><p>{say(chosen.example)}</p></section></div>
        <div className="career-start-task"><div><h2>{say(chosen.trial)}</h2><p>{say(chosen.outcome)}</p><span>{t("About 10 minutes · all tools are on this page")}</span></div><button className="career-primary" type="button" onClick={() => go("practice")}>{t(trial.completed ? "Try the task again" : "Try this task")}</button>{trial.completed && <button className="career-link" type="button" onClick={() => go("next")}>{t("Return to my next step")}</button>}</div>
        <div className="career-extra"><details><summary>{t("What would I learn first?")}</summary><p>{say(chosen.basics)}</p></details><details><summary>{t("How does AI fit into this work?")}</summary><p>{say(chosen.ai)}</p><p>{t("This explains how to practise with AI; it does not predict which jobs will disappear.")}</p></details><details open={showEvidence} onToggle={(event) => setShowEvidence(event.currentTarget.open)}><summary>{t("What do current vacancies say?")}</summary>{showEvidence && <CareerEvidence guide={chosen.id} markets={markets} market={market} onMarketChange={onMarketChange} onExploreRole={() => { go("fields", null); onExploreRole(chosen.id); }} />}</details></div>
      </> : view === "practice" ? <>
        <header className="career-intro"><h1 id="route-heading" tabIndex={-1}>{say(chosen.trial)}</h1><p>{say(chosen.outcome)}</p></header>
        <BeginnerTask key={chosen.id} guide={chosen.id} draft={trial.draft} onChange={updateDraft} onComplete={finishTask} />
      </> : <>
        <header className="career-intro"><h1 id="route-heading" tabIndex={-1}>{t("What would you like to try next?")}</h1><p>{t("You have tried a small part of {field}. You do not have to choose a career today.", { field: say(chosen.field).toLocaleLowerCase(language) })}</p></header>
        <div className="career-reflection"><label htmlFor="career-reflection">{t("What felt interesting or difficult? (optional)")}</label><textarea id="career-reflection" maxLength={400} rows={3} value={trial.note} onChange={(event) => updateTrial({ note: event.target.value })} /><div className="career-actions">{!trial.saved && <button type="button" className="career-primary" onClick={() => updateTrial({ decision: "continue", saved: true })}>{t("Make my next learning plan")}</button>}<button className="career-link" type="button" onClick={() => go("fields", null)}>{t("Try a different field")}</button></div></div>
        {trial.saved && <section className="career-next" aria-label={t("My next step")}><h2>{t("One small step to keep learning")}</h2><p>{say(chosen.next)}</p><a className="career-resource" href={chosen.resource.url} target="_blank" rel="noopener noreferrer">{chosen.resource.label} <span aria-hidden="true">↗</span></a><div className="career-actions"><button type="button" className="career-primary" onClick={downloadPlan}>{t("Download my plan")}</button><button className="career-link" type="button" onClick={() => { updateTrial({ draft: {}, completed: false }); go("practice"); }}>{t("Start this task over")}</button></div></section>}
        <p className="career-note">{t(storageAvailable ? "Your practice and notes stay in this browser." : "Browser storage is unavailable. Keep this page open or download your plan.")}</p>
      </>}
    </>}
  </div>;
}
