import { useEffect, useRef, useState } from "react";
import { askSkillScope, getAskStatus, type AskAnswer } from "./api";
import { useLanguage } from "./i18n";

const examples = [
  "What do SkillScope's vacancies show about IT roles and skills in Kyrgyzstan?",
  "Which roles have the most Junior vacancies across all markets?",
  "Which skills are most mentioned for Backend Developers?",
  "Which markets disclose salaries more often in this snapshot?",
];

function ScopiMark() {
  return <svg className="scopi-mark" viewBox="0 0 72 72" fill="none" aria-hidden="true">
    <path className="scopi-wave scopi-wave-one" d="M51 18c4 2 7 5 9 9" />
    <path className="scopi-wave scopi-wave-two" d="M54 10c7 3 12 8 15 15" />
    <path className="scopi-antenna" d="M36 17V9" />
    <circle className="scopi-tip" cx="36" cy="7" r="3" />
    <path className="scopi-body" d="M36 17c-15 0-25 10-25 24 0 14 10 24 25 24s25-10 25-24c0-14-10-24-25-24Z" />
    <path className="scopi-highlight" d="M19 34c2-5 5-8 9-10" />
    <g className="scopi-eyes"><circle cx="28" cy="40" r="2.5" /><circle cx="44" cy="40" r="2.5" /></g>
    <path className="scopi-smile" d="M31 49c3 3 7 3 10 0" />
  </svg>;
}

interface AskSkillScopeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launcherHidden?: boolean;
}

export default function AskSkillScope({ open, onOpenChange, launcherHidden = false }: AskSkillScopeProps) {
  const { language, t, formatDate } = useLanguage();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllExamples, setShowAllExamples] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    if (open) return;
    pending.current?.abort();
    pending.current = null;
    setQuestion("");
    setAnswer(null);
    setError(null);
    setWorking(false);
    setShowAllExamples(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const controller = new AbortController();
    setAvailable(null);
    getAskStatus(controller.signal)
      .then((status) => setAvailable(status.available))
      .catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        requestAnimationFrame(() => launcherHidden ? document.getElementById("route-ask")?.focus() : launcher.current?.focus());
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onOpenChange, launcherHidden]);

  function close() {
    onOpenChange(false);
    requestAnimationFrame(() => launcherHidden ? document.getElementById("route-ask")?.focus() : launcher.current?.focus());
  }

  async function submit(value = question) {
    const next = value.trim();
    if (next.length < 3 || next.length > 400 || working || !available) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setQuestion("");
    setAnswer(null);
    setError(null);
    setWorking(true);
    try {
      setAnswer(await askSkillScope(next, controller.signal));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Mr. Scope is unavailable right now.");
    } finally {
      if (pending.current === controller) { pending.current = null; setWorking(false); }
    }
  }

  return <div className="scopi-assistant" data-inline-launcher={launcherHidden}>
    <section className="scopi-panel" id="ask-skillscope" aria-labelledby="scopi-heading" hidden={!open}>
      <header className="scopi-panel-head">
        <div className="scopi-portrait"><ScopiMark /></div>
        <div><h2 id="scopi-heading">{language === "ky" ? <><span>Mr.</span> Scope'тон суроо</> : <>Ask <span>Mr.</span> Scope</>}</h2><p>{t("Your guide to SkillScope and its market snapshot")}</p></div>
        <button type="button" className="scopi-close" aria-label={t("Close Mr. Scope")} onClick={close}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg></button>
      </header>
      <div className="scopi-panel-body">
        {!answer && !working && !error && <p className="scopi-greeting">{t("I can help you read the vacancies behind SkillScope. Ask about roles, skills, experience or published salaries.")}</p>}
        {answer && <div className="scopi-answer" aria-live="polite"><div className="scopi-answer-source"><span>{t(answer.source === "project" ? "About SkillScope" : "From the snapshot")}</span>{answer.source === "market" && <span>{t("{count} vacancies · Observed {date}", { count: answer.sample_size, date: formatDate(answer.snapshot_date) })}</span>}</div><p>{answer.answer}</p></div>}
        {working && <p className="scopi-working" role="status">{t("Preparing an answer")}<span aria-hidden="true">…</span></p>}
        {error && <p className="scopi-error" role="alert">{language === "ky" ? t("Mr. Scope is unavailable right now. Try again later.") : error}</p>}
        {!answer && <div className="scopi-prompts"><h3>{t("Try a question")}</h3>{examples.slice(0, showAllExamples ? examples.length : 2).map((item) => <button type="button" key={item} disabled={!available || working} onClick={() => void submit(t(item))}>{t(item)}<span aria-hidden="true">↗</span></button>)}<button type="button" className="scopi-more" aria-expanded={showAllExamples} onClick={() => setShowAllExamples(!showAllExamples)}>{t(showAllExamples ? "Fewer ideas" : "More ideas")}<span aria-hidden="true">{showAllExamples ? "−" : "+"}</span></button></div>}
      </div>
      <div className="scopi-compose">
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label className="sr-only" htmlFor="scopi-question">{t("Your question")}</label>
          <textarea ref={input} id="scopi-question" value={question} maxLength={400} rows={2} placeholder={t("Ask about SkillScope or this snapshot…")} aria-describedby="scopi-keyboard-hint" onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault();
              if (!event.repeat) event.currentTarget.form?.requestSubmit();
            }
          }} disabled={working} />
          <button type="submit" disabled={!available || working || question.trim().length < 3} aria-label={t(working ? "Reading the snapshot" : "Ask Mr. Scope")}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 16 16 4M6 4h10v10" /></svg></button>
        </form>
        <p className="scopi-status" id="scopi-keyboard-hint">{t("Enter to send · Shift+Enter for a new line")}</p>
        <p className="scopi-status">{t(available === null ? "Checking availability…" : available ? "SkillScope facts and reviewed HeadHunter vacancies" : "Mr. Scope is unavailable right now. Try again later.")}</p>
        <p className="scopi-caution">{t("Skill mentions are frequency signals, not a measure of your readiness. Questions are sent to an AI provider.")} <a href="/privacy">{t("Privacy details")}</a></p>
      </div>
    </section>
    <button type="button" className="scopi-launcher" hidden={launcherHidden} ref={launcher} aria-controls="ask-skillscope" aria-expanded={open} aria-label={t(open ? "Close Mr. Scope assistant" : "Open Mr. Scope assistant")} onClick={() => open ? close() : onOpenChange(true)}>
      <span className="scopi-launcher-mark"><ScopiMark /></span>
      <span className="scopi-launcher-copy"><strong><span>Mr.</span> Scope</strong><small>{t("Ask the snapshot")}</small></span>
      <svg className="scopi-launcher-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} /></svg>
    </button>
  </div>;
}
