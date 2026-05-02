import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import Alert from "../components/Alert";
import SearchPanel from "../components/SearchPanel";

const HotelsGoogleMap = lazy(() => import("../components/HotelsGoogleMap"));

const DEFAULT_COUNTRY_FILTERS = ["Palestine"];

export default function HotelsMap() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || 0) || 0;
  const country = searchParams.get("country") || "";

  if (auth.isAuthenticated && !auth.isCustomer) {
    return <Navigate to={auth.isAdmin ? "/admin/roles" : "/dashboard"} replace />;
  }

  const filters = useMemo(
    () => ({
      page,
      size: 50,
      city: searchParams.get("city") || "",
      country,
      name: searchParams.get("name") || "",
    }),
    [country, page, searchParams],
  );

  const hotelsQuery = useQuery({
    queryKey: ["hotels-map", filters],
    queryFn: () => bookingApi.listHotels(filters),
  });

  const hotels = hotelsQuery.data?.content || [];
  const queryString = searchParams.toString();

  const cityOptions = useMemo(() => {
    const unique = new Set();
    hotels.forEach((hotel) => {
      if (hotel?.city) unique.add(hotel.city);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [hotels]);

  const countryOptions = useMemo(() => {
    const unique = new Set(DEFAULT_COUNTRY_FILTERS);
    hotels.forEach((hotel) => {
      const c = hotel?.country?.trim();
      if (c) unique.add(c);
    });
    if (country) unique.add(country.trim());
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [hotels, country]);

  function changePage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  function setCountryFilter(value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("country", value);
    else next.delete("country");
    next.set("page", "0");
    setSearchParams(next);
  }

  const listHref = queryString ? `/hotels?${queryString}` : "/hotels";

  return (
    <section className="container results-page hotels-map-page">
      <div className="section-heading map-page-heading">
        <p className="eyebrow">{t("hotels.mapPageEyebrow")}</p>
        <h1>{t("hotels.mapPageTitle")}</h1>
        <p className="muted">{t("hotels.mapPageHint")}</p>
      </div>

      <SearchPanel
        compact
        navigateTo="/hotels/map"
        initialValues={{
          city: searchParams.get("city") || "",
          from: searchParams.get("from") || undefined,
          to: searchParams.get("to") || undefined,
          adults: searchParams.get("adults") || 2,
          children: searchParams.get("children") || 0,
          rooms: searchParams.get("rooms") || 1,
          work: searchParams.get("work") === "1",
        }}
        cityOptions={cityOptions}
      />

      <div className="results-toolbar">
        <button className="filter-button" type="button">
          {t("hotels.filterBy")}
        </button>
        <select
          className="filter-button"
          aria-label={t("hotels.countryFilter")}
          value={country}
          onChange={(event) => setCountryFilter(event.target.value)}
        >
          <option value="">{t("hotels.allCountries")}</option>
          {countryOptions.map((c) => (
            <option value={c} key={c}>
              {c}
            </option>
          ))}
        </select>
        <Link className="filter-button" to={listHref}>
          {t("hotels.listView")}
        </Link>
      </div>

      <Alert type="error">{hotelsQuery.error?.message}</Alert>

      {hotelsQuery.isLoading ? (
        <div className="empty-state">{t("hotels.loading")}</div>
      ) : hotels.length ? (
        <Suspense
          fallback={
            <div className="map-panel map-panel--placeholder">
              <p className="muted">{t("hotels.mapsLoading")}</p>
            </div>
          }
        >
          <HotelsGoogleMap hotels={hotels} variant="page" />
        </Suspense>
      ) : (
        <div className="empty-state">
          <h2>{t("hotels.noResultsTitle")}</h2>
          <p>{t("hotels.noResultsBody")}</p>
          <Link className="btn btn-teal" to="/hotels">
            {t("hotels.goToList")}
          </Link>
        </div>
      )}

      {hotelsQuery.data && hotelsQuery.data.totalPages > 1 ? (
        <div className="pagination">
          <button disabled={hotelsQuery.data.first} onClick={() => changePage(page - 1)}>
            {t("hotels.previous")}
          </button>
          <span>
            {t("hotels.pageOf", {
              page: hotelsQuery.data.page + 1,
              total: Math.max(hotelsQuery.data.totalPages, 1),
            })}
          </span>
          <button disabled={hotelsQuery.data.last} onClick={() => changePage(page + 1)}>
            {t("hotels.next")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
