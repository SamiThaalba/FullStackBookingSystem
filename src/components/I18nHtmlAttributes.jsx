import { useEffect } from "react";
import { useTranslation } from "react-i18next";

function applyDocumentLanguage(lng) {
  const code = String(lng || "en").split("-")[0];
  document.documentElement.lang = code === "ar" ? "ar" : "en";
  document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
}

export default function I18nHtmlAttributes() {
  const { i18n } = useTranslation();

  useEffect(() => {
    applyDocumentLanguage(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    const handler = (lng) => applyDocumentLanguage(lng);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, [i18n]);

  return null;
}
