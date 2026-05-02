import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SearchPanel from "../components/SearchPanel";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const { t } = useTranslation();
  const auth = useAuth();

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
                <Link className="btn btn-teal" to="/login">
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

      <section className="promo-band">
        <div className="container promo-grid">
          <div>
            <h2>{t("home.promoTitle")}</h2>
            <p>{t("home.promoBody")}</p>
          </div>
          <div className="stat-card">
            <strong>{t("home.statFast")}</strong>
            <span>{t("home.statFastSub")}</span>
          </div>
          <div className="stat-card">
            <strong>{t("home.statSmart")}</strong>
            <span>{t("home.statSmartSub")}</span>
          </div>
        </div>
      </section>
    </>
  );
}
