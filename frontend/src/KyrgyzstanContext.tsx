import { useLanguage } from "./i18n";

export default function KyrgyzstanContext() {
  const { t } = useLanguage();
  return <aside className="regional-context" aria-label={t("HH report · Kyrgyzstan · Q3 2026")}>
    <p><strong>{t("HH report · Kyrgyzstan · Q3 2026")}</strong> {t("IT vacancies fell 16.4% year on year across HH’s full IT category.")} <a href="https://bishkek.headhunter.kg/article/34483" target="_blank" rel="noopener noreferrer">{t("Read HH report")} ↗</a></p>
    <p>{t("This quarterly report covers a different period and broader roles than the snapshot above.")}</p>
  </aside>;
}
