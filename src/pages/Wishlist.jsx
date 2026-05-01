import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import HotelCard from "../components/HotelCard";
import RoomTypeCard from "../components/RoomTypeCard";

export default function Wishlist() {
  const [typeFilter, setTypeFilter] = useState("ALL");

  const wishlistQuery = useQuery({
    queryKey: ["wishlist"],
    queryFn: bookingApi.wishlist,
  });

  const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: bookingApi.myAlerts });

  const wishlist = wishlistQuery.data || [];
  const alerts = alertsQuery.data || [];

  const filteredWishlist = useMemo(() => {
    if (typeFilter === "ALL") return wishlist;
    return wishlist.filter((item) => item.itemType === typeFilter);
  }, [typeFilter, wishlist]);

  const hotelIds = useMemo(
    () =>
      Array.from(
        new Set(
          filteredWishlist.filter((i) => i.itemType === "HOTEL").map((i) => Number(i.targetId)),
        ),
      ),
    [filteredWishlist],
  );

  const roomTypeIds = useMemo(
    () =>
      Array.from(
        new Set(
          filteredWishlist.filter((i) => i.itemType === "ROOM_TYPE").map((i) => Number(i.targetId)),
        ),
      ),
    [filteredWishlist],
  );

  const hotelsQuery = useQuery({
    queryKey: ["wishlist-hotels", hotelIds],
    enabled: hotelIds.length > 0,
    queryFn: async () => Promise.all(hotelIds.map((id) => bookingApi.getHotel(id))),
  });

  const roomTypesQuery = useQuery({
    queryKey: ["wishlist-room-types", roomTypeIds],
    enabled: roomTypeIds.length > 0,
    queryFn: async () => Promise.all(roomTypeIds.map((id) => bookingApi.getRoomType(id))),
  });

  const hotels = hotelsQuery.data || [];
  const roomTypes = roomTypesQuery.data || [];

  return (
    <section className="container section">
      <div className="section-heading">
        <p className="eyebrow">Saved items</p>
        <h1>Wishlist</h1>
      </div>

      <Alert type="error">
        {wishlistQuery.error?.message ||
          alertsQuery.error?.message ||
          hotelsQuery.error?.message ||
          roomTypesQuery.error?.message}
      </Alert>

      {wishlistQuery.isLoading ? (
        <div className="empty-state">Loading wishlist...</div>
      ) : wishlist.length ? (
        <>
          <div className="results-toolbar" style={{ marginBottom: 18 }}>
            <select className="filter-button" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="HOTEL">Hotels</option>
              <option value="ROOM_TYPE">Rooms</option>
            </select>
          </div>

          {hotelsQuery.isLoading || roomTypesQuery.isLoading ? (
            <div className="empty-state">Loading saved items...</div>
          ) : (
            <div className="manager-list">
              {hotels.map((hotel) => (
                <HotelCard key={`hotel-${hotel.id}`} hotel={hotel} />
              ))}
              {roomTypes.map((roomType) => (
                <RoomTypeCard key={`room-${roomType.id}`} roomType={roomType} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h2>No wishlist items</h2>
          <p>Save hotels or room types to track them.</p>
        </div>
      )}

      <div className="section-heading" style={{ marginTop: 44 }}>
        <p className="eyebrow">Price & availability</p>
        <h2>Alerts</h2>
      </div>

      {alertsQuery.isLoading ? (
        <div className="empty-state">Loading alerts...</div>
      ) : alerts.length ? (
        <div className="table-card" style={{ marginTop: 18 }}>
          <table>
            <thead>
              <tr>
                <th>Alert</th>
                <th>Type</th>
                <th>Room type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>#{alert.id}</td>
                  <td>{alert.alertType}</td>
                  <td>#{alert.roomTypeId}</td>
                  <td>{alert.active ? "ACTIVE" : "INACTIVE"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h2>No alerts yet</h2>
          <p>Add an alert from a room card inside a hotel page.</p>
        </div>
      )}
    </section>
  );
}

