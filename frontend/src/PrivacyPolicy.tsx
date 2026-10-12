import { useEffect, useState } from "react";
import { LanguageSwitch, useLanguage } from "./i18n";

export default function PrivacyPolicy() {
  const { language, t } = useLanguage();
  const [cleared, setCleared] = useState(false);

  useEffect(() => { document.title = `${t("Privacy & storage")} — SkillScope`; }, [language]);

  function clearPreferences() {
    try {
      window.localStorage.removeItem("skillscope-theme");
      window.localStorage.removeItem("skillscope-known-skills");
      window.localStorage.removeItem("skillscope-language");
      setCleared(true);
    } catch {
      setCleared(false);
    }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#privacy-content">{t("Skip to privacy information")}</a>
    <header className="site-header legal-header">
      <a className="brand" href="/" aria-label={t("SkillScope home")}><span className="brand-mark">S</span><span>SkillScope<span className="brand-period">.</span></span></a>
      <div className="header-actions"><LanguageSwitch /><a className="legal-back" href="/">← {t("Back to the dashboard")}</a></div>
    </header>
    <main className="page-wrap legal-page" id="privacy-content">
      <p className="legal-kicker">{t("SkillScope / Site information")}</p>
      <h1>{t("Privacy & storage")}</h1>
      <p className="legal-lead">{t("SkillScope is a personal project by Arsen. For privacy questions or requests, email")} <a href="mailto:arsenbektemirov01@gmail.com">arsenbektemirov01@gmail.com</a>.</p>
      <p className="legal-date">{t("Last updated: 11 October 2026")}</p>
      <div className="legal-content">
        <section>
          <h2>{t("What reaches the server")}</h2>
          <p>{t("When you visit, your browser sends your IP address, browser details and requested URLs to the server. Market and role choices may appear in API request URLs. Render hosts SkillScope and may keep request logs. SkillScope has no accounts or sign-up forms.")}</p>
          <p>{t("When you ask Mr. Scope a question, it is sent to Groq to write an answer. Market questions also send a summary of vacancy statistics. SkillScope does not save questions or answers. Groq may retain request data in limited cases for service reliability or abuse monitoring.")} <a href="https://console.groq.com/docs/your-data">{t("Groq's data information")}</a> {t("explains its controls.")}</p>
        </section>
        <section>
          <h2>{t("What stays in your browser")}</h2>
          <p>{t("SkillScope does not set cookies or use analytics or advertising scripts. Your theme, language and skills marked in My route are saved in this browser. Marked skills are not sent to the server.")}</p>
          <button className="legal-clear" type="button" onClick={clearPreferences}>{t("Clear saved preferences")}</button>
          <p className="legal-feedback" role="status">{cleared ? t("Saved SkillScope preferences cleared. Reload to reset the theme and language.") : ""}</p>
        </section>
      </div>
        <footer className="page-footer"><a className="footer-brand" href="/">SkillScope.</a><span>{t("Selected IT markets, in focus.")}</span><a className="footer-privacy" href="/">{t("Back to dashboard")}</a></footer>
    </main>
  </div>;
}
