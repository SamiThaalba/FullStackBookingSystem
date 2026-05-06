import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const OPTIONS = [
  { code: "en", country: "us", labelKey: "layout.langEnglishUS" },
  { code: "ar", country: "sa", labelKey: "layout.langArabicSA" },
];

function FlagRound({ country, px = 36, className = "" }) {
  const [broken, setBroken] = useState(false);
  const h = px;

  if (broken) {
    return <span className={`lang-switcher__flag-round ${className}`} aria-hidden />;
  }

  return (
    <span className={`lang-switcher__flag-round ${className}`}>
      <img
        src={`https://flagcdn.com/h${h}/${country}.png`}
        srcSet={`https://flagcdn.com/h${Math.round(h * 1.5)}/${country}.png 2x`}
        height={h}
        width={Math.round(h * 1.45)}
        alt=""
        decoding="async"
        onError={() => setBroken(true)}
      />
    </span>
  );
}

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const active = OPTIONS.find((o) => i18n.language?.startsWith(o.code)) ?? OPTIONS[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close]);

  return (
    <div className="lang-switcher-root" ref={rootRef}>
      <button
        type="button"
        className="lang-switcher-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("layout.languageTriggerAria", { lang: t(active.labelKey) })}
        onClick={() => setOpen((v) => !v)}
      >
        <FlagRound country={active.country} px={32} />
      </button>

      {open ? (
        <>
          <div className="lang-switcher-backdrop" aria-hidden onClick={close} />
          <div
            className="lang-switcher-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-picker-title"
          >
            <div className="lang-switcher-panel__header">
              <button
                type="button"
                className="lang-switcher-panel__close"
                onClick={close}
                aria-label={t("layout.languagePickerClose")}
              >
                ×
              </button>
              <div className="lang-switcher-panel__titles">
                <h2 id="lang-picker-title" className="lang-switcher-panel__title">
                  {t("layout.chooseYourLanguage")}
                </h2>
                <p className="lang-switcher-panel__subtitle">{t("layout.allLanguages")}</p>
              </div>
            </div>
            <div className="lang-switcher-panel__list" role="listbox" aria-label={t("layout.language")}>
              {OPTIONS.map(({ code, country, labelKey }) => {
                const selected = i18n.language?.startsWith(code);
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    lang={code}
                    className={`lang-switcher-panel__row${selected ? " is-active" : ""}`}
                    onClick={() => {
                      void i18n.changeLanguage(code);
                      close();
                    }}
                  >
                    <span className="lang-switcher-panel__check" aria-hidden>
                      {selected ? "✓" : ""}
                    </span>
                    <span className="lang-switcher-panel__label">{t(labelKey)}</span>
                    <FlagRound country={country} px={32} className="lang-switcher-panel__flag" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
