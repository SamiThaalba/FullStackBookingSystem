import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? t("layout.themeUseLight") : t("layout.themeUseDark")}
      title={isDark ? t("layout.themeUseLight") : t("layout.themeUseDark")}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {isDark ? "☀" : "☾"}
      </span>
      <span className="theme-toggle__text">{isDark ? t("layout.themeLight") : t("layout.themeDark")}</span>
    </button>
  );
}
