import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import HomeAiAssistant from "../components/HomeAiAssistant";
import { useAuth } from "../auth/AuthContext";
import { bookingApi } from "../api/bookingApi";
import { hasValidHotelLatLng } from "../utils/geo";
import { buildSearchCityRows } from "../utils/searchCities";

const HotelsGoogleMap = lazy(() => import("../components/HotelsGoogleMap"));

const WHY_CARDS = [
  { icon: "⚡", titleKey: "home.whyCardFastTitle", bodyKey: "home.whyCardFastBody" },
  { icon: "₪", titleKey: "home.whyCardClearTitle", bodyKey: "home.whyCardClearBody" },
  { icon: "✨", titleKey: "home.whyCardSmartTitle", bodyKey: "home.whyCardSmartBody" },
  { icon: "✓", titleKey: "home.whyCardTrustedTitle", bodyKey: "home.whyCardTrustedBody" },
];

function HomeMapFallback() {
  const { t } = useTranslation();
  return (
    <div className="home-map-fallback map-panel map-panel--placeholder map-panel--home" aria-hidden>
      <p className="muted">{t("home.mapLoadingChunk")}</p>
    </div>
  );
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const isRtl = i18n.language?.startsWith("ar");

  const hotelsQuery = useQuery({
    queryKey: ["home", "hotels-for-map"],
    queryFn: () => bookingApi.listHotels({ page: 0, size: 100 }),
  });

  const citiesQuery = useQuery({
    queryKey: ["cities", "all"],
    queryFn: () => bookingApi.listCities({}),
    staleTime: 120_000,
  });

  const hotels = hotelsQuery.data?.content ?? [];
  const searchCityRows = useMemo(
    () => buildSearchCityRows(citiesQuery.data ?? [], hotels),
    [citiesQuery.data, hotels],
  );
  const pinsOnMap = useMemo(
    () => hotels.filter((h) => hasValidHotelLatLng(h?.latitude, h?.longitude)).length,
    [hotels],
  );

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
              <a className="btn btn-outline" href="#discover-map">
                {t("home.mapCta")}
              </a>
            </div>
          </div>
          <div className="hero-card">
            <HomeAiAssistant cities={searchCityRows} />
          </div>
        </div>
      </section>

      <section className="home-map-section" id="discover-map" aria-labelledby="home-map-heading">
        <div className="container">
          <div className="home-map-intro">
            <div className="section-heading home-map-heading">
              <p className="eyebrow">{t("home.mapEyebrow")}</p>
              <h2 id="home-map-heading">{t("home.mapTitle")}</h2>
              <p className="home-map-lead muted">{t("home.mapLead")}</p>
            </div>
            <div className="home-map-intro__aside">
              <div className="home-map-stat" role="status">
                <span className="home-map-stat__value">{pinsOnMap}</span>
                <span className="home-map-stat__label">{t("home.mapStatLabel")}</span>
              </div>
            </div>
          </div>

          <div className="home-map-frame">
            <div className="home-map-frame__glow" aria-hidden />
            {hotelsQuery.isLoading ? (
              <div className="home-map-fallback map-panel map-panel--placeholder map-panel--home">
                <p className="muted">{t("hotels.loading")}</p>
              </div>
            ) : (
              <Suspense fallback={<HomeMapFallback />}>
                <HotelsGoogleMap hotels={hotels} variant="home" />
              </Suspense>
            )}
            {hotelsQuery.error ? (
              <p className="home-map-error muted" role="alert">
                {hotelsQuery.error.message}
              </p>
            ) : null}
          </div>
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
