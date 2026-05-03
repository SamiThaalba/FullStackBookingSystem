import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { buildSearchCityRows } from "../utils/searchCities";
import Alert from "../components/Alert";
import HotelCard from "../components/HotelCard";
import SearchPanel from "../components/SearchPanel";
import { FaMapMarkerAlt } from "react-icons/fa";
import { FaMap } from "react-icons/fa6";
export default function Hotels() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || 0) || 0;
  const country = searchParams.get("country") || "";

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
  const mapHref = queryString ? `/hotels/map?${queryString}` : "/hotels/map";

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
        <Link className="btn btn-teal" to={mapHref} aria-label={t("hotels.mapView")}>
          <FaMap size={40} />
        </Link>
      </div>

      <Alert type="error">
        {hotelsQuery.error?.message || countriesQuery.error?.message || citiesQuery.error?.message}
      </Alert>

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

      {hotelsQuery.data && hotelsQuery.data.totalPages > 1 ? (
        <div className="pager">
          <button type="button" className="btn btn-outline" disabled={hotelsQuery.data.first} onClick={() => changePage(page - 1)}>
            {t("hotels.previous")}
          </button>
          <span className="muted">
            {t("hotels.pageOf", { page: page + 1, total: hotelsQuery.data.totalPages })}
          </span>
          <button type="button" className="btn btn-outline" disabled={hotelsQuery.data.last} onClick={() => changePage(page + 1)}>
            {t("hotels.next")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
