import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import HotelCard from "../components/HotelCard";
import SearchPanel from "../components/SearchPanel";

export default function Hotels() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(Number(searchParams.get("page") || 0));
  const [country, setCountry] = useState("");

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

  function changePage(nextPage) {
    setPage(nextPage);
    const next = new R(searchParams);
    next.set("page", nextPage);
    setSearchParams(next);
  }

  return (
    <section className="container results-page">
      <SearchPanel
        compact
        initialValues={{
          city: searchParams.get("city") || "Aston",
          from: searchParams.get("from") || undefined,
          to: searchParams.get("to") || undefined,
          guests: searchParams.get("guests") || 1,
        }}
      />

      <div className="results-toolbar">
        <button className="filter-button" type="button">
          Filter by
        </button>
        <select
          className="filter-button"
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            setPage(0);
          }}
        >
          <option value="">Recommended</option>
          <option value="BU">Bethlehem</option>
          <option value="Bethlehem">Bethlehem (full)</option>
        </select>
        <button className="filter-button" type="button">
          Map view
        </button>
      </div>

      <Alert type="error">{hotelsQuery.error?.message}</Alert>

      {hotelsQuery.isLoading ? (
        <div className="empty-state">Loading hotels...</div>
      ) : hotels.length ? (
        <div className="hotel-list">
          {hotels.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No hotels found</h2>
          <p>Try another city or check that hotel data exists in the backend database.</p>
        </div>
      )}

      {hotelsQuery.data && (
        <div className="pagination">
          <button disabled={hotelsQuery.data.first} onClick={() => changePage(page - 1)}>
            Previous
          </button>
          <span>
            Page {hotelsQuery.data.page + 1} of {Math.max(hotelsQuery.data.totalPages, 1)}
          </span>
          <button disabled={hotelsQuery.data.last} onClick={() => changePage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}
