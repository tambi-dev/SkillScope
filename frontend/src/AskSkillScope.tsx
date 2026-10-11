import { useEffect, useRef, useState } from "react";
import { askSkillScope, getAskStatus, type AskAnswer } from "./api";

const examples = [
  "Which skills appear most for Data Analysts in Kazakhstan?",
  "Which roles have more no-experience vacancies?",
  "How do Backend and DevOps skill mentions differ?",
  "How does salary disclosure differ between countries?",
];

function displayDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value.slice(0, 10) : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AskSkillScope() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAskStatus(controller.signal).then((status) => setAvailable(status.available)).catch(() => setAvailable(false));
    return () => { controller.abort(); pending.current?.abort(); };
  }, []);

  async function submit(value = question) {
    const next = value.trim();
    if (next.length < 3 || next.length > 400 || working || !available) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setQuestion(next);
    setAnswer(null);
    setError(null);
    setWorking(true);
    try {
      setAnswer(await askSkillScope(next, controller.signal));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ask SkillScope is unavailable.");
    } finally {
      if (pending.current === controller) { pending.current = null; setWorking(false); }
    }
  }

  return <section className="ask-section" id="ask-skillscope" aria-labelledby="ask-heading">
    <div className="ask-intro">
      <div><h2 id="ask-heading">Ask the snapshot.</h2><p>Put a market question into words. SkillScope reads the same vacancy signals shown on this page and writes a short answer with its evidence.</p></div>
      <span className="ask-signature" aria-hidden="true">S<span>.</span></span>
    </div>
    <div className="ask-workspace">
      <form className="ask-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="ask-question">Your question</label>
        <textarea id="ask-question" value={question} maxLength={400} rows={3} placeholder="What can this snapshot tell me about…" onChange={(event) => setQuestion(event.target.value)} disabled={!available || working} />
        <div className="ask-form-foot"><span>{available === null ? "Checking availability…" : available ? "Based on reviewed HeadHunter vacancies" : "AI answers are unavailable until the server key is configured."}</span><button type="submit" disabled={!available || working || question.trim().length < 3}>{working ? "Reading…" : "Read the signals"}<span aria-hidden="true">↗</span></button></div>
      </form>
      <div className="ask-prompts"><h3>Start with a question</h3>{examples.map((item) => <button type="button" key={item} disabled={!available || working} onClick={() => void submit(item)}>{item}<span aria-hidden="true">↗</span></button>)}</div>
    </div>
    <div className="ask-result" aria-live="polite" aria-atomic="true">
      {working && <p className="ask-working">Reading the current snapshot…</p>}
      {error && <p className="ask-error" role="alert">{error}</p>}
      {answer && <div className="ask-answer"><div className="ask-answer-meta"><strong>From the snapshot</strong><span>{answer.sample_size} vacancies in scope · Observed {displayDate(answer.snapshot_date)}</span></div><p>{answer.answer}</p></div>}
    </div>
    <p className="ask-caution">Skill mentions are frequency signals, not a measure of your readiness. Questions are sent to an AI provider when submitted. <a href="/privacy">How questions are handled</a></p>
  </section>;
}
