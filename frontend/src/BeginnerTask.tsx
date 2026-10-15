import { useEffect, useRef, useState } from "react";
import { checkSales, previewDocument, salesRows, starterHtml } from "./careerActivities";
import type { ActivityDraft, GuideId } from "./careerGuides";
import { useLanguage } from "./i18n";
import { playCompletionSound, TaskSuccess } from "./TaskSuccess";

interface Props { draft: ActivityDraft; onChange: (patch: Partial<ActivityDraft>) => void; onComplete: () => void }
interface TaskProps extends Props { onSuccess: () => void; celebrating: boolean }

function SalesTask({ draft, onChange, onComplete, onSuccess, celebrating }: TaskProps) {
  const { t } = useLanguage();
  const [checked, setChecked] = useState(false);
  const included = draft.included ?? salesRows.map((_, index) => index);
  const result = checkSales(included, draft.coffee ?? "", draft.tea ?? "");
  function change(patch: Partial<ActivityDraft>) { setChecked(false); onChange(patch); }
  return <div className="starter-task">
    <div className="starter-instructions"><h2>{t("Your task")}</h2><p>{t("These are fictional sales from one café. Each order should appear once. All amounts are in dollars.")}</p>
      <ol><li>{t("Find the order number that appears twice. Untick one copy. Keep every other order ticked.")}</li><li>{t("Add the amounts for the remaining Coffee rows. Do the same for Tea. A calculator is fine.")}</li><li>{t("Enter both totals below, then check your answer.")}</li></ol>
      <details className="starter-help"><summary>{t("Show a worked example")}</summary><p>{t("If two Coffee orders earned $4 and $3, Coffee earned $7 in total. A repeated copy of the same order must not be added again.")}</p></details>
    </div>
    <div className="starter-workspace"><div className="starter-table-wrap"><table className="starter-table"><caption>{t("Café sales · practice data")}</caption><thead><tr><th scope="col">{t("Keep")}</th><th scope="col">{t("Order")}</th><th scope="col">{t("Drink")}</th><th scope="col">{t("Amount")}</th></tr></thead><tbody>{salesRows.map((row, index) => <tr key={index} data-excluded={!included.includes(index)}><td><input type="checkbox" aria-label={t("Keep row {row}, order {order}", { row: index + 1, order: row.order })} checked={included.includes(index)} onChange={() => change({ included: included.includes(index) ? included.filter((item) => item !== index) : [...included, index] })} /></td><th scope="row">{row.order}</th><td>{t(row.product)}</td><td>${row.amount}</td></tr>)}</tbody></table></div>
      <form className="starter-answer" onSubmit={(event) => { event.preventDefault(); setChecked(true); if (result.clean && result.totals) onSuccess(); }}>
        <div className="starter-totals"><label>{t("Coffee total ($)")}<input type="number" inputMode="decimal" min="0" step="any" value={draft.coffee ?? ""} onChange={(event) => change({ coffee: event.target.value })} /></label><label>{t("Tea total ($)")}<input type="number" inputMode="decimal" min="0" step="any" value={draft.tea ?? ""} onChange={(event) => change({ tea: event.target.value })} /></label></div>
        <button className="career-primary" type="submit">{t("Check my totals")}</button>
      </form>
      {checked && (!result.clean || !result.totals) && <div className="starter-feedback" role="status"><p>{t(!result.clean ? "Check the order numbers: keep one A04 and every other order. You should have five orders left." : "The repeated order is removed. Now add the three Coffee amounts and the two Tea amounts again.")}</p></div>}
      {checked && result.clean && result.totals && <TaskSuccess active={celebrating}><h3>{t("You found the answer.")}</h3><p>{t("Coffee earned $15 and Tea earned $10. Coffee earned $5 more. Removing the repeated order stopped Tea from being counted twice.")}</p><p>{t("That is a small example of an analyst’s work: check the data before explaining the result.")}</p><button className="career-primary" type="button" onClick={onComplete}>{t("Choose my next step")}</button></TaskSuccess>}
    </div>
  </div>;
}

function WebTask({ draft, onChange, onComplete, onSuccess, celebrating }: TaskProps) {
  const { t } = useLanguage();
  const code = draft.code ?? starterHtml;
  const [preview, setPreview] = useState(code);
  const [checked, setChecked] = useState(false);
  const parsed = new DOMParser().parseFromString(code, "text/html");
  const headingCorrect = parsed.querySelector("h1")?.textContent?.trim() === "Build your first web page";
  const buttonCorrect = parsed.querySelector("button")?.textContent?.trim() === "Save my place";
  const current = preview === code;
  return <div className="starter-task">
    <div className="starter-instructions"><h2>{t("Your task")}</h2><p>{t("HTML uses tags to describe a page. The text between <h1> and </h1> is its main heading. The text inside <button> is its button label.")}</p>
      <ol><li>{t("Replace Workshop with Build your first web page. Keep the <h1> tags.")}</li><li>{t("Replace Click here with Save my place. Keep the <button> tags.")}</li><li>{t("Select Update preview and check that both texts changed. This practice button does not make a real booking.")}</li></ol>
      <details className="starter-help"><summary>{t("Show an example of a tag")}</summary><p>{t("<h1>Hello</h1> displays Hello as a heading. Change only Hello to change the words; the tags describe their purpose.")}</p></details>
    </div>
    <div className="starter-workspace"><label className="starter-code-label" htmlFor="starter-html">{t("Your HTML · edit the words between the tags")}</label><textarea id="starter-html" className="starter-code" value={code} maxLength={3000} rows={7} spellCheck={false} autoCapitalize="off" onChange={(event) => { setChecked(false); onChange({ code: event.target.value }); }} />
      <div className="career-actions"><button className="career-primary" type="button" onClick={() => { setPreview(code); setChecked(true); if (headingCorrect && buttonCorrect) onSuccess(); }}>{t("Update preview")}</button><button className="career-link" type="button" onClick={() => { onChange({ code: starterHtml }); setPreview(starterHtml); setChecked(false); }}>{t("Reset sample")}</button></div>
      <p className="starter-preview-label">{t("This is what a visitor sees")}</p><iframe className="starter-preview" title={t("Your page preview")} sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument(preview)} />
      {checked && current && (!headingCorrect || !buttonCorrect) && <div className="starter-feedback" role="status"><p>{t(!headingCorrect ? "Find the <h1> line and put Build your first web page between its opening and closing tags." : "The heading is correct. Now put Save my place between the <button> tags.")}</p></div>}
      {checked && current && headingCorrect && buttonCorrect && <TaskSuccess active={celebrating}><h3>{t("Your changes are visible.")}</h3><p>{t("You changed the page’s heading and button by editing HTML. Frontend developers use this same link between code and what a visitor sees.")}</p><button className="career-primary" type="button" onClick={onComplete}>{t("Choose my next step")}</button></TaskSuccess>}
    </div>
  </div>;
}

function TestingTask({ draft, onChange, onComplete, onSuccess, celebrating }: TaskProps) {
  const { t } = useLanguage();
  const [lastAge, setLastAge] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const runs = draft.runs ?? [];
  const tested = runs.includes(15) && runs.includes(16);
  return <div className="starter-task">
    <div className="starter-instructions"><h2>{t("Your task")}</h2><p><strong>{t("The rule: only people aged 16 or older can book.")}</strong> {t("This is a practice form with an intentional bug.")}</p>
      <ol><li>{t("Enter 15, then select Test booking. This should be rejected.")}</li><li>{t("Enter 16 and test again. This should be accepted.")}</li><li>{t("Use the two boxes below to explain the age-15 problem.")}</li></ol>
      <details className="starter-help"><summary>{t("What is a bug report?")}</summary><p>{t("A bug report explains how to repeat a problem, what should happen and what happened instead. Here the steps are: enter age 15, then select Test booking.")}</p></details>
    </div>
    <div className="starter-workspace"><form className="starter-booking" aria-label={t("Practice booking form")} onSubmit={(event) => { event.preventDefault(); const age = Number(draft.age); setLastAge(age); setChecked(false); if (age === 15 || age === 16) onChange({ runs: [...new Set([...runs, age])] }); }}>
      <h3>{t("Workshop booking · practice form")}</h3><label>{t("Age in years")}<input type="number" min="0" max="120" step="1" required value={draft.age ?? ""} onChange={(event) => onChange({ age: event.target.value })} /></label><button type="submit" className="career-primary">{t("Test booking")}</button>
      {lastAge !== null && <p className="starter-booking-result" role="status">{t("Age {age}: {result}", { age: lastAge, result: t(lastAge >= 15 ? "Booking accepted" : "Booking rejected") })}</p>}
      </form>
      {runs.length > 0 && <table className="starter-table starter-test-results"><caption>{t("Your two checks")}</caption><thead><tr><th scope="col">{t("Age")}</th><th scope="col">{t("The rule says")}</th><th scope="col">{t("The form did")}</th></tr></thead><tbody>{[15, 16].filter((age) => runs.includes(age)).map((age) => <tr key={age}><th scope="row">{age}</th><td>{t(age === 15 ? "Reject" : "Accept")}</td><td>{t("Accept")}</td></tr>)}</tbody></table>}
      {tested && <form className="starter-answer" onSubmit={(event) => { event.preventDefault(); setChecked(true); if (draft.expected?.trim() && draft.actual?.trim()) onSuccess(); }}><h3>{t("Describe the age-15 problem")}</h3><label>{t("What should happen when someone enters 15?")}<textarea rows={2} maxLength={400} required value={draft.expected ?? ""} onChange={(event) => { setChecked(false); onChange({ expected: event.target.value }); }} /></label><label>{t("What actually happened when you tested 15?")}<textarea rows={2} maxLength={400} required value={draft.actual ?? ""} onChange={(event) => { setChecked(false); onChange({ actual: event.target.value }); }} /></label><button className="career-primary" type="submit">{t("Save my observation")}</button></form>}
      {checked && tested && (!draft.expected?.trim() || !draft.actual?.trim()) && <p className="starter-feedback" role="alert">{t("Write a short sentence in both boxes before saving.")}</p>}
      {checked && tested && draft.expected?.trim() && draft.actual?.trim() && <TaskSuccess active={celebrating}><h3>{t("Your observation is saved.")}</h3><p>{t("Compare your wording with this example: ‘Enter age 15 and test the booking. Expected: rejected because the minimum age is 16. Actual: the form accepts the booking.’ Your wording can be different.")}</p><p>{t("You tested a rule and recorded a difference. That is the starting point of a useful bug report.")}</p><button className="career-primary" type="button" onClick={onComplete}>{t("Choose my next step")}</button></TaskSuccess>}
    </div>
  </div>;
}

export default function BeginnerTask({ guide, ...props }: Props & { guide: GuideId }) {
  const { t } = useLanguage();
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("skillscope-sound") !== "off"; } catch { return true; } });
  const [celebrating, setCelebrating] = useState(false);
  const celebrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function onSuccess() {
    if (celebrated.current) return;
    celebrated.current = true;
    setCelebrating(true);
    requestAnimationFrame(() => document.querySelector(".starter-feedback-success")?.scrollIntoView({ block: "nearest", behavior: "instant" }));
    if (sound) playCompletionSound();
    timer.current = setTimeout(() => setCelebrating(false), 950);
  }
  const taskProps = { ...props, onSuccess, celebrating };
  return <>
    <div className="starter-tools"><button type="button" className="task-sound-toggle" aria-label={t("Completion sound")} aria-pressed={sound} onClick={() => { const next = !sound; setSound(next); try { localStorage.setItem("skillscope-sound", next ? "on" : "off"); } catch { /* The preference still works for this visit. */ } }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" />{sound ? <path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14" /> : <path d="m16 9 6 6m0-6-6 6" />}</svg>{t(sound ? "Sound on" : "Sound off")}
    </button></div>
    {guide === "data_analyst" ? <SalesTask {...taskProps} /> : guide === "frontend_developer" ? <WebTask {...taskProps} /> : <TestingTask {...taskProps} />}
  </>;
}
