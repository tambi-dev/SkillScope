import { useEffect, useState } from "react";

export default function PrivacyPolicy() {
  const [cleared, setCleared] = useState(false);

  useEffect(() => { document.title = "Privacy & storage — SkillScope"; }, []);

  function clearPreferences() {
    try {
      window.localStorage.removeItem("skillscope-theme");
      window.localStorage.removeItem("skillscope-known-skills");
      setCleared(true);
    } catch {
      setCleared(false);
    }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#privacy-content">Skip to privacy information</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="SkillScope home"><span className="brand-mark">S</span><span>SkillScope<span className="brand-period">.</span></span></a>
      <a className="legal-back" href="/">← Back to the dashboard</a>
    </header>
    <main className="page-wrap legal-page" id="privacy-content">
      <p className="legal-kicker">SkillScope / Site information</p>
      <h1>Privacy & storage</h1>
      <p className="legal-lead">SkillScope is a personal project by Arsen. For privacy questions or requests, email <a href="mailto:arsenbektemirov01@gmail.com">arsenbektemirov01@gmail.com</a>.</p>
      <p className="legal-date">Last updated: 11 October 2026</p>
      <div className="legal-content">
        <section>
          <h2>What reaches the server</h2>
          <p>When you visit, your browser sends your IP address, browser details and requested URLs to the server. Market and role choices may appear in API request URLs. Render hosts SkillScope and may keep request logs. SkillScope has no accounts or sign-up forms.</p>
          <p>When you ask Mr. Scope a question, it is sent to Groq to write an answer. Market questions also send a summary of vacancy statistics. SkillScope does not save questions or answers. Groq may retain request data in limited cases for service reliability or abuse monitoring. <a href="https://console.groq.com/docs/your-data">Groq's data information</a> explains its controls.</p>
        </section>
        <section>
          <h2>What stays in your browser</h2>
          <p>SkillScope does not set cookies or use analytics or advertising scripts. Your theme choice and skills marked in My route are saved in this browser. Marked skills are not sent to the server.</p>
          <button className="legal-clear" type="button" onClick={clearPreferences}>Clear saved preferences</button>
          <p className="legal-feedback" role="status">{cleared ? "Saved SkillScope preferences cleared. Reload to reset the theme." : ""}</p>
        </section>
      </div>
      <footer className="page-footer"><a className="footer-brand" href="/">SkillScope.</a><span>Central Asia’s IT markets, in focus.</span><a className="footer-privacy" href="/">Back to dashboard</a></footer>
    </main>
  </div>;
}
