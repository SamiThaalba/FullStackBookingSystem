import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import Alert from "../components/Alert";
import HotelCard from "../components/HotelCard";
import SearchPanel from "../components/SearchPanel";

/** Typical seed country for this project; merged with values returned from `/api/hotels`. */
const DEFAULT_COUNTRY_FILTERS = ["Palestine"];

export default function Hotels() {
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
      size: 6,
      city: searchParams.get("city") || "",
      country,
      name: searchParams.get("name") || "",
    }),
    [country, page, searchParams],
  );

  const hotelsQuery = useQuery({
    queryKey: ["hotels", filters],
    queryFn: () => bookingApi.listHotels(filters),
  });

  const hotels = hotelsQuery.data?.content || [];
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

  return (
    <section className="container results-page">
      <SearchPanel
        compact
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
        <button className="filter-button" type="button">
          {t("hotels.mapView")}
        </button>
      </div>

      <Alert type="error">{hotelsQuery.error?.message}</Alert>

      {hotelsQuery.isLoading ? (
        <div className="empty-state">{t("hotels.loading")}</div>
      ) : hotels.length ? (
        <div className="hotel-list">
          {hotels.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{t("hotels.noResultsTitle")}</h2>
          <p>{t("hotels.noResultsBody")}</p>
        </div>
      )}

      {hotelsQuery.data && (
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
      )}
    </section>
  );
}
