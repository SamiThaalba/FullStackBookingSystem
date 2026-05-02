import { useTranslation } from "react-i18next";

const OPTIONS = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div className="lang-switcher" role="group" aria-label={t("layout.language")}>
      {OPTIONS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={`lang-switcher__btn${i18n.language?.startsWith(code) ? " is-active" : ""}`}
          onClick={() => i18n.changeLanguage(code)}
          lang={code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
