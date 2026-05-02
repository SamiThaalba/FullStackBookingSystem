import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { storeBookingIntent } from "../auth/bookingIntent";
import Alert from "../components/Alert";
import { nightsBetween, todayIso, tomorrowIso } from "../utils/dates";
import { compactAddress, money } from "../utils/format";
import { hasValidHotelLatLng } from "../utils/geo";
import { useHotelWishlistToggle } from "../hooks/useHotelWishlistToggle";
import RoomWishlistButton from "../components/RoomWishlistButton";

const HotelsGoogleMap = lazy(() => import("../components/HotelsGoogleMap"));

export default function HotelDetails() {
  const { t } = useTranslation();
  const { hotelId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();

  if (auth.isAuthenticated && !auth.isCustomer) {
    return <Navigate to={auth.isAdmin ? "/admin/roles" : "/dashboard"} replace />;
  }

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [dates, setDates] = useState({
    checkIn: searchParams.get("from") || todayIso(),
    checkOut: searchParams.get("to") || tomorrowIso(),
    guests: Number(searchParams.get("guests") || 1),
  });
  const [quote, setQuote] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({
    fullName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });
  const [pendingBook, setPendingBook] = useState(false);

  const hotelQuery = useQuery({
    queryKey: ["hotel", hotelId],
    queryFn: () => bookingApi.getHotel(hotelId),
  });

  const roomQuery = useQuery({
    queryKey: ["rooms", hotelId],
    queryFn: () => bookingApi.getRoomTypes(hotelId),
  });

  const quoteMutation = useMutation({
    mutationFn: (room) =>
      bookingApi.checkAvailability({
        roomTypeId: room.id,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        numberOfGuests: Number(dates.guests),
      }),
    onSuccess: (data, room) => {
      setSelectedRoom(room);
      setQuote(data);
    },
  });

  const bookingMutation = useMutation({
    mutationFn: () =>
      bookingApi.createBooking({
        hotelId: Number(hotelId),
        roomTypeId: selectedRoom.id,
        startDate: dates.checkIn,
        endDate: dates.checkOut,
      }),
    onSuccess: async (booking) => {
      const payment = await bookingApi.createPayment(booking.id);
      await bookingApi.processPayment(payment.id, true);
      const confirmed = await bookingApi.confirmBooking(booking.id);
      navigate(`/confirmation/${booking.id}`, {
        state: { booking: confirmed, hotel: hotelQuery.data, room: selectedRoom, payment },
      });
    },
    onSettled: () => setPendingBook(false),
  });

  const alertMutation = useMutation({
    mutationFn: ({ roomTypeId, alertType, targetPrice }) => {
      if (alertType === "PRICE_BELOW") {
        const parsed = Number(String(targetPrice ?? "").replace(",", "."));
        return bookingApi.createAlert({
          roomTypeId,
          alertType,
          targetPrice: Number.isFinite(parsed) ? parsed : undefined,
        });
      }

      return bookingApi.createAlert({
        roomTypeId,
        alertType,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount: Number(dates.guests),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const [alertOpenFor, setAlertOpenFor] = useState(null);
  const [alertDraft, setAlertDraft] = useState({ alertType: "PRICE_BELOW", targetPrice: "" });

  const hotel = hotelQuery.data;
  const wishlistHotelEnabled =
    auth.isAuthenticated && auth.isCustomer && Boolean(hotel?.id);
  const wishlistHotel =
    hotel ?? { id: undefined, name: "", city: null, imageUrl: null };
  const { isInWishlist, toggleMutation } = useHotelWishlistToggle(
    wishlistHotel,
    wishlistHotelEnabled,
  );

  const rooms = roomQuery.data || hotel?.roomTypes || [];
  const nights = nightsBetween(dates.checkIn, dates.checkOut);

  useEffect(() => {
    const resumeIntent = window.history.state?.usr?.intent || null;
    if (!resumeIntent || selectedRoom || !rooms.length) return;
    const roomMatch = rooms.find((room) => room.id === resumeIntent.roomTypeId) || null;
    if (!roomMatch) return;

    setSelectedRoom(roomMatch);
    setDates((current) => ({
      checkIn: resumeIntent.checkIn || current.checkIn,
      checkOut: resumeIntent.checkOut || current.checkOut,
      guests: Number(resumeIntent.guests || current.guests),
    }));
  }, [rooms, selectedRoom]);

  if (hotelQuery.isLoading) {
    return <div className="container empty-state">{t("hotelDetail.loadingHotel")}</div>;
  }

  return (
    <section className="container detail-page">
      <Alert type="error">{hotelQuery.error?.message || roomQuery.error?.message}</Alert>
      {hotel && (
        <>
          <div className="detail-hero">
            <div>
              <p className="eyebrow">{hotel.city}, {hotel.country}</p>
              <h1>{hotel.name}</h1>
              <p>{compactAddress(hotel)}</p>
              <p className="muted">{hotel.description || t("hotelDetail.defaultDescription")}</p>
              {wishlistHotelEnabled ? (
                <div className="detail-fav-row">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
                  >
                    {isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="gallery-card">
              {hotel.imageUrl ? <img src={hotel.imageUrl} alt={hotel.name} /> : <span>{t("hotelDetail.galleryPlaceholder")}</span>}
            </div>
          </div>

          <div className="booking-panel">
            <label>
              {t("hotelDetail.checkIn")}
              <input
                type="date"
                value={dates.checkIn}
                onChange={(event) => setDates({ ...dates, checkIn: event.target.value })}
              />
            </label>
            <label>
              {t("hotelDetail.checkOut")}
              <input
                type="date"
                value={dates.checkOut}
                onChange={(event) => setDates({ ...dates, checkOut: event.target.value })}
              />
            </label>
            <label>
              {t("hotelDetail.guests")}
              <input
                type="number"
                min="1"
                value={dates.guests}
                onChange={(event) => setDates({ ...dates, guests: event.target.value })}
              />
            </label>
            <strong>{t("hotelDetail.nightStay", { count: nights })}</strong>
          </div>

          <div className="detail-map-section">
            <h2>{t("hotelDetail.locationOnMap")}</h2>
            {hasValidHotelLatLng(hotel.latitude, hotel.longitude) ? (
              <Suspense
                fallback={
                  <div className="map-panel map-panel--placeholder">
                    <p className="muted">{t("hotels.mapsLoading")}</p>
                  </div>
                }
              >
                <HotelsGoogleMap hotels={[hotel]} variant="detail" />
              </Suspense>
            ) : (
              <p className="muted detail-map-muted">{t("hotelDetail.mapNotAvailable")}</p>
            )}
          </div>

          <div className="split-grid">
            <div>
              <h2>{t("hotelDetail.roomTypesHeading")}</h2>
              <Alert type="error">{quoteMutation.error?.message || bookingMutation.error?.message}</Alert>
              <div className="room-list">
                {rooms.map((room) => (
                  <article className="room-card" key={room.id}>
                    <div>
                      <h3>{room.name}</h3>
                      <p>{room.description || t("hotelDetail.defaultRoomDescription")}</p>
                      <div className="amenity-row">
                        <span>{t("hotelDetail.sleepsCount", { count: room.capacity })}</span>
                        <span>{t("hotelDetail.inventoryRooms", { count: room.inventoryCount })}</span>
                        {(room.amenities || []).slice(0, 3).map((amenity) => (
                          <span key={amenity}>{amenity}</span>
                        ))}
                      </div>
                    </div>
                    <div className="room-price">

                      <strong>{money(room.basePrice)} {t("hotelDetail.perNight")}</strong>
                      <button className="btn btn-teal" onClick={() => quoteMutation.mutate(room)}>
                        {t("hotelDetail.checkAvailability")}
                      </button>
                      {auth.isAuthenticated ? (
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                          <RoomWishlistButton
                            room={room}
                            hotel={hotel}
                            enabled={auth.isAuthenticated && auth.isCustomer}
                          />
                          <button
                            className="btn btn-small btn-outline"
                            type="button"
                            onClick={() => {
                              setAlertOpenFor(room.id);
                              setAlertDraft({ alertType: "PRICE_BELOW", targetPrice: "" });
                            }}
                          >
                            {t("hotelDetail.addAlert")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="quote-card">
              <h2>{t("hotelDetail.yourQuote")}</h2>
              {quote ? (
                <>
                  <p>{quote.message}</p>
                  <div className="price-line">
                    <span>{t("hotelDetail.labelRoom")}</span>
                    <strong>{selectedRoom?.name}</strong>
                  </div>
                  <div className="price-line">
                    <span>{t("hotelDetail.labelNights")}</span>
                    <strong>{nights}</strong>
                  </div>
                  <div className="price-line">
                    <span>{t("hotelDetail.labelBaseTotal")}</span>
                    <strong>{money((selectedRoom?.basePrice || 0) * nights)}</strong>
                  </div>
                  {typeof quote.totalPrice === "number" ? (
                    <div className="price-line">
                      <span>{t("hotelDetail.labelDynamicPricing")}</span>
                      <strong>{money(quote.totalPrice - (selectedRoom?.basePrice || 0) * nights)}</strong>
                    </div>
                  ) : null}
                  <div className="price-line">
                    <span>{t("hotelDetail.labelTotal")}</span>
                    <strong>{money(quote.totalPrice)}</strong>
                  </div>
                  <button
                    className="btn btn-primary btn-full"
                    disabled={!quote.available || bookingMutation.isPending}
                    onClick={() => {
                      if (!auth.isAuthenticated) {
                        const from = `${window.location.pathname}${window.location.search || ""}`;
                        const intent = {
                          type: "booking",
                          hotelId: Number(hotelId),
                          roomTypeId: selectedRoom?.id,
                          checkIn: dates.checkIn,
                          checkOut: dates.checkOut,
                          guests: Number(dates.guests),
                        };
                        storeBookingIntent(intent);
                        navigate("/login", { replace: true, state: { from, intent } });
                        return;
                      }
                      setPaymentOpen(true);
                    }}
                  >
                    {bookingMutation.isPending ? t("hotelDetail.booking") : t("hotelDetail.createBooking")}
                  </button>
                </>
              ) : (
                <p className="muted">{t("hotelDetail.quoteHint")}</p>
              )}
            </aside>
          </div>

          {paymentOpen ? (
            <div className="modal-backdrop" role="presentation" onClick={() => !pendingBook && setPaymentOpen(false)}>
              <div className="modal" role="dialog" aria-label={t("hotelDetail.mockPaymentAria")} onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h2>{t("hotelDetail.mockPaymentTitle")}</h2>
                  <button className="btn btn-small btn-outline" type="button" disabled={pendingBook} onClick={() => setPaymentOpen(false)}>
                    {t("hotelDetail.close")}
                  </button>
                </div>
                <p className="muted">{t("hotelDetail.mockPaymentDisclaimer")}</p>
                <form
                  className="stack-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPendingBook(true);
                    bookingMutation.mutate();
                  }}
                >
                  <label>
                    {t("hotelDetail.fullName")}
                    <input value={paymentDraft.fullName} onChange={(e) => setPaymentDraft((c) => ({ ...c, fullName: e.target.value }))} required />
                  </label>
                  <label>
                    {t("hotelDetail.cardNumber")}
                    <input
                      value={paymentDraft.cardNumber}
                      onChange={(e) => setPaymentDraft((c) => ({ ...c, cardNumber: e.target.value }))}
                      placeholder={t("hotelDetail.cardPlaceholder")}
                      required
                    />
                  </label>
                  <div className="modal-grid">
                    <label>
                      {t("hotelDetail.expiry")}
                      <input
                        value={paymentDraft.expiry}
                        onChange={(e) => setPaymentDraft((c) => ({ ...c, expiry: e.target.value }))}
                        placeholder={t("hotelDetail.expiryPlaceholder")}
                        required
                      />
                    </label>
                    <label>
                      {t("hotelDetail.cvv")}
                      <input
                        value={paymentDraft.cvv}
                        onChange={(e) => setPaymentDraft((c) => ({ ...c, cvv: e.target.value }))}
                        placeholder={t("hotelDetail.cvvPlaceholder")}
                        required
                      />
                    </label>
                  </div>
                  <div className="hero-actions" style={{ justifyContent: "space-between" }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={pendingBook}
                      onClick={() =>
                        setPaymentDraft({
                          fullName: auth.user?.username || t("hotelDetail.guestDisplayName"),
                          cardNumber: "4242 4242 4242 4242",
                          expiry: "12/30",
                          cvv: "123",
                        })
                      }
                    >
                      {t("hotelDetail.autofill")}
                    </button>
                    <button className="btn btn-primary" disabled={pendingBook}>
                      {pendingBook ? t("hotelDetail.processing") : t("hotelDetail.payAndBook")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {alertOpenFor ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setAlertOpenFor(null)}>
              <div className="modal" role="dialog" aria-label={t("hotelDetail.alertDialogAria")} onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h2>{t("hotelDetail.createAlertTitle")}</h2>
                  <button className="btn btn-small btn-outline" type="button" onClick={() => setAlertOpenFor(null)}>
                    {t("hotelDetail.close")}
                  </button>
                </div>
                <Alert type="error">{alertMutation.error?.message}</Alert>
                <form
                  className="stack-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    alertMutation.mutate({
                      roomTypeId: Number(alertOpenFor),
                      alertType: alertDraft.alertType,
                      targetPrice: alertDraft.alertType === "PRICE_BELOW" ? alertDraft.targetPrice : undefined,
                    });
                    setAlertOpenFor(null);
                  }}
                >
                  <label>
                    {t("hotelDetail.alertType")}
                    <select value={alertDraft.alertType} onChange={(e) => setAlertDraft((c) => ({ ...c, alertType: e.target.value }))}>
                      <option value="PRICE_BELOW">{t("hotelDetail.alertTypePriceBelow")}</option>
                      <option value="AVAILABLE_NOW">{t("hotelDetail.alertTypeAvailableNow")}</option>
                    </select>
                  </label>
                  {alertDraft.alertType === "PRICE_BELOW" ? (
                    <label>
                      {t("hotelDetail.targetPrice")}
                      <input
                        value={alertDraft.targetPrice}
                        onChange={(e) => setAlertDraft((c) => ({ ...c, targetPrice: e.target.value }))}
                        placeholder={t("hotelDetail.targetPricePlaceholder")}
                        required
                      />
                    </label>
                  ) : null}
                  <button className="btn btn-teal" disabled={alertMutation.isPending}>
                    {alertMutation.isPending ? t("hotelDetail.creating") : t("hotelDetail.createAlert")}
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
