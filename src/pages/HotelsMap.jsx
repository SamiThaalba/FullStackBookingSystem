import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { buildSearchCityRows } from "../utils/searchCities";
import { resolveCityBilingual, resolveCountryBilingual } from "../utils/aiAssistant";
import Alert from "../components/Alert";
import SearchPanel from "../components/SearchPanel";
import { FaListUl } from "react-icons/fa";
const HotelsGoogleMap = lazy(() => import("../components/HotelsGoogleMap"));

/** Page size per request when loading every hotel that matches the map filters (not the list UI page). */
const MAP_LIST_PAGE_SIZE = 200;

async function fetchAllHotelsMatchingFilters(filterFields) {
  const merged = [];
  let pageIdx = 0;
  let totalPages = 1;
  while (pageIdx < totalPages && pageIdx < 100) {
    const res = await bookingApi.listHotels({
      ...filterFields,
      page: pageIdx,
      size: MAP_LIST_PAGE_SIZE,
    });
    merged.push(...(res.content || []));
    totalPages = Math.max(res.totalPages ?? 1, 1);
    if (res.last) break;
    pageIdx += 1;
  }
  return {
    content: merged,
    page: 0,
    size: merged.length,
    totalElements: merged.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}

export default function HotelsMap() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const country = resolveCountryBilingual(searchParams.get("country") || "");

  const filterFields = useMemo(
    () => ({
      city: resolveCityBilingual(searchParams.get("city") || ""),
      country,
      name: searchParams.get("name") || "",
    }),
    [country, searchParams],
  );

  const hotelsQuery = useQuery({
    queryKey: ["hotels-map", filterFields],
    queryFn: () => fetchAllHotelsMatchingFilters(filterFields),
  });

  const countriesQuery = useQuery({
    queryKey: ["countries"],
    queryFn: bookingApi.listCountries,
    staleTime: 120_000,
  });

  const citiesQuery = useQuery({
    queryKey: ["cities", "all"],
    queryFn: () => bookingApi.listCities({}),
    staleTime: 120_000,
  });

  const hotels = hotelsQuery.data?.content || [];
  const queryString = searchParams.toString();

  const detailBookingQuery = useMemo(() => {
    const q = new URLSearchParams();
    for (const key of ["from", "to", "guests", "adults", "children", "rooms", "work"]) {
      const v = searchParams.get(key);
      if (v != null && v !== "") q.set(key, v);
    }
    return q.toString();
  }, [searchParams]);

  const searchCityRows = useMemo(
    () => buildSearchCityRows(citiesQuery.data ?? [], hotels),
    [citiesQuery.data, hotels],
  );

  const countryOptions = useMemo(() => {
    const unique = new Set((countriesQuery.data ?? []).map((c) => c.name));
    hotels.forEach((hotel) => {
      const c = hotel?.country?.trim();
      if (c) unique.add(c);
    });
    if (country) unique.add(country.trim());
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [countriesQuery.data, hotels, country]);

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
        cities={searchCityRows}
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
        <Link className="btn btn-teal" to={listHref} aria-label={t("hotels.listView")}>
          <FaListUl size={20} />
        </Link>
      </div>

      <Alert type="error">
        {hotelsQuery.error?.message || countriesQuery.error?.message || citiesQuery.error?.message}
      </Alert>

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
          <HotelsGoogleMap hotels={hotels} variant="page" detailBookingQuery={detailBookingQuery} />
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
    </section>
  );
}
