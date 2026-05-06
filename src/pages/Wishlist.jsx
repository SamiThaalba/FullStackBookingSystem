import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import HotelCard from "../components/HotelCard";
import RoomTypeCard from "../components/RoomTypeCard";
import { Link } from "react-router-dom";

export default function Wishlist() {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const queryClient = useQueryClient();

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

  const alertRoomTypeIds = useMemo(
    () => Array.from(new Set((alerts || []).map((a) => Number(a.roomTypeId)).filter(Boolean))),
    [alerts],
  );

  const alertRoomTypesQuery = useQuery({
    queryKey: ["alerts-room-types", alertRoomTypeIds],
    enabled: alertRoomTypeIds.length > 0,
    queryFn: async () => Promise.all(alertRoomTypeIds.map((id) => bookingApi.getRoomType(id))),
  });

  const alertRoomTypes = alertRoomTypesQuery.data || [];
  const alertRoomTypeById = useMemo(() => {
    const map = new Map();
    alertRoomTypes.forEach((rt) => map.set(Number(rt?.id), rt));
    return map;
  }, [alertRoomTypes]);

  const activateAlertMutation = useMutation({
    mutationFn: (id) => bookingApi.activateAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const deactivateAlertMutation = useMutation({
    mutationFn: (id) => bookingApi.deactivateAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

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
        <div className="manager-list" style={{ marginTop: 18 }}>
          {alerts.map((alert) => {
            const roomType = alertRoomTypeById.get(Number(alert.roomTypeId)) || null;
            const title = roomType?.name ? roomType.name : `Room type #${alert.roomTypeId}`;
            const desc = roomType?.description || "Room type";
            const isActive = Boolean(alert.active);
            const toggling =
              (activateAlertMutation.isPending && activateAlertMutation.variables === alert.id) ||
              (deactivateAlertMutation.isPending && deactivateAlertMutation.variables === alert.id);

            return (
              <article key={alert.id} className="room-card room-card--hotel-detail">
                <div className="room-card__media" aria-hidden>
                  {roomType?.imageUrl ? (
                    <img src={roomType.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="room-card__mediaFallback">Room</span>
                  )}
                </div>

                <div className="room-card__content">
                  <h3 className="room-card__title" title={title}>
                    {title}
                  </h3>
                  <p className="room-card__desc">{desc}</p>

                  <div className="amenity-row" aria-label="Alert details">
                    <span>Alert #{alert.id}</span>
                    <span>{String(alert.alertType || "ALERT")}</span>
                    <span>{isActive ? "ACTIVE" : "INACTIVE"}</span>
                  </div>
                </div>

                <aside className="room-card__actions" aria-label={`${title} alert actions`}>
                  <div className="room-card__actionsTop">
                    {roomType?.hotelId ? (
                      <Link className="btn btn-small btn-outline room-card__alertBtn" to={`/hotels/${roomType.hotelId}`}>
                        View hotel
                      </Link>
                    ) : (
                      <span aria-hidden />
                    )}
                  </div>

                  <div className="room-card__priceBlock">
                    <div className="room-card__priceValue">{isActive ? "On" : "Off"}</div>
                    <div className="room-card__priceMeta">Alert status</div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-teal room-action-btn room-action-btn--primary"
                    onClick={() => (isActive ? deactivateAlertMutation.mutate(alert.id) : activateAlertMutation.mutate(alert.id))}
                    disabled={toggling}
                    aria-label={isActive ? "Deactivate alert" : "Activate alert"}
                  >
                    {toggling ? "Updating..." : isActive ? "Deactivate" : "Activate"}
                  </button>
                </aside>
              </article>
            );
          })}
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

