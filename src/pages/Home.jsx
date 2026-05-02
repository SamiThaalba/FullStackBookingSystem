import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SearchPanel from "../components/SearchPanel";
import { useAuth } from "../auth/AuthContext";

const WHY_CARDS = [
  { icon: "⚡", titleKey: "home.whyCardFastTitle", bodyKey: "home.whyCardFastBody" },
  { icon: "₪", titleKey: "home.whyCardClearTitle", bodyKey: "home.whyCardClearBody" },
  { icon: "✨", titleKey: "home.whyCardSmartTitle", bodyKey: "home.whyCardSmartBody" },
  { icon: "✓", titleKey: "home.whyCardTrustedTitle", bodyKey: "home.whyCardTrustedBody" },
];

export default function Home() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const isRtl = i18n.language?.startsWith("ar");

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{t("home.eyebrow")}</p>
            <h1>{t("home.title")}</h1>
            <p>{t("home.lead")}</p>
            <div className="hero-actions">
              {auth.isAuthenticated ? (
                <Link className="btn btn-teal" to="/hotels">
                  {t("home.startSearching")}
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/login">
                  {t("home.login")}
                </Link>
              )}
              <a className="btn btn-outline" href="#about">
                {t("home.aboutProject")}
              </a>
            </div>
          </div>
          <div className="hero-card">
            <SearchPanel />
          </div>
        </div>
      </section>

      <section className="container section" id="about">
        <div className="section-heading">
          <p className="eyebrow">{t("home.sectionEyebrow")}</p>
          <h2>{t("home.sectionTitle")}</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <h3>{t("home.featureSearchTitle")}</h3>
            <p>{t("home.featureSearchBody")}</p>
          </article>
          <article className="feature-card">
            <h3>{t("home.featureBookingTitle")}</h3>
            <p>{t("home.featureBookingBody")}</p>
          </article>
          <article className="feature-card">
            <h3>{t("home.featureManagerTitle")}</h3>
            <p>{t("home.featureManagerBody")}</p>
          </article>
        </div>
      </section>

      <section className="why-section" dir={isRtl ? "rtl" : "ltr"}>
        <div className="container why-grid">
          <div className="why-copy">
            <h2>{t("home.promoTitle")}</h2>
            <p>{t("home.promoBody")}</p>
            <div className="why-stats">
              <div className="why-stat">
                <strong>{t("home.whyStat247")}</strong>
                <span>{t("home.whyStat247Sub")}</span>
              </div>
              <div className="why-stat">
                <strong>{t("home.whyStat50")}</strong>
                <span>{t("home.whyStat50Sub")}</span>
              </div>
            </div>
          </div>

          <div className="why-cards">
            {WHY_CARDS.map((card) => (
              <div className="why-card" key={card.titleKey}>
                <div className="why-icon" aria-hidden>
                  {card.icon}
                </div>
                <h3>{t(card.titleKey)}</h3>
                <p>{t(card.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
