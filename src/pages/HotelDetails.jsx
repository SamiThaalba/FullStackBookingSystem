import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { storeBookingIntent } from "../auth/bookingIntent";
import Alert from "../components/Alert";
import { useBookingUi } from "../context/BookingUiContext";
import { nightsBetween, todayIso, tomorrowIso } from "../utils/dates";
import { compactAddress, money } from "../utils/format";
import { hasValidHotelLatLng } from "../utils/geo";
import { useHotelWishlistToggle } from "../hooks/useHotelWishlistToggle";
import { FaExchangeAlt, FaHeart, FaRegHeart } from "react-icons/fa";
import RoomWishlistButton from "../components/RoomWishlistButton";
import {
  PAYMENT_METHODS,
  PaymentContext,
  getPaymentStrategy,
} from "../strategies/paymentStrategies";
import {
  getCardBrand,
  loadSavedCards,
  maskCardNumber,
  saveSavedCards,
} from "../utils/paymentCards";

const HotelsGoogleMap = lazy(() => import("../components/HotelsGoogleMap"));

const ASSISTANT_MEMORY_KEY = "quickreserve-ai-memory-v2";
const DEFAULT_PAYMENT_DRAFT = {
  fullName: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
};

function buildDiscountPricing({ room, nights, guests }) {
  const safeNights = Number.isFinite(Number(nights)) ? Math.max(1, Number(nights)) : 1;
  const safeGuests = Number.isFinite(Number(guests)) ? Math.max(1, Number(guests)) : 1;
  const basePrice = Number(room?.basePrice || 0);
  const baseTotal = basePrice * safeNights;

  let discountRate = 0;
  const reasons = [];
  if (safeNights >= 5) {
    discountRate += 0.1;
    reasons.push("extendedStay");
  }
  if (safeGuests >= 4) {
    discountRate += 0.07;
    reasons.push("groupSize");
  }
  if (Number(room?.inventoryCount || 0) >= 10) {
    discountRate += 0.05;
    reasons.push("highRoomAvailability");
  }
  discountRate = Math.min(discountRate, 0.22);

  const discountAmount = baseTotal * discountRate;
  const finalTotal = Math.max(0, baseTotal - discountAmount);
  return { baseTotal, discountRate, discountAmount, finalTotal, reasons };
}

export default function HotelDetails() {
  const { t } = useTranslation();
  const { hotelId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { bookingUi, updateBookingUi } = useBookingUi();
  const queryClient = useQueryClient();

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [dates, setDates] = useState({
    checkIn: searchParams.get("from") || bookingUi.checkInDate || todayIso(),
    checkOut: searchParams.get("to") || bookingUi.checkOutDate || tomorrowIso(),
    guests: Number(searchParams.get("guests") || bookingUi.guests || 1),
  });
  const [quote, setQuote] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CARD);
  const [paymentDraft, setPaymentDraft] = useState(DEFAULT_PAYMENT_DRAFT);
  const [savedCards, setSavedCards] = useState([]);
  const [saveCardForNextTime, setSaveCardForNextTime] = useState(true);
  const [activeSavedCardIndex, setActiveSavedCardIndex] = useState(null);
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
      const paymentContext = new PaymentContext(getPaymentStrategy(paymentMethod));
      const paymentPromise = paymentContext.executePayment({ bookingId: booking.id, bookingApi });
      const confirmPromise = bookingApi.confirmBooking(booking.id);
      const [paymentResult, confirmed] = await Promise.all([paymentPromise, confirmPromise]);
      navigate(`/confirmation/${booking.id}`, {
        state: {
          booking: confirmed,
          hotel: hotelQuery.data,
          room: selectedRoom,
          payment: paymentResult,
          paymentMethod,
          pricing: discountPricing,
        },
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
    auth.isAuthenticated && Boolean(hotel?.id);
  const wishlistHotel =
    hotel ?? { id: undefined, name: "", city: null, imageUrl: null };
  const { isInWishlist, toggleMutation } = useHotelWishlistToggle(
    wishlistHotel,
    wishlistHotelEnabled,
  );

  const rooms = (roomQuery.data || hotel?.roomTypes || []).filter((room) => {
    const name = String(room?.name || "").trim().toLowerCase();
    return Boolean(name) && name !== "room type name is required.";
  });
  const nights = nightsBetween(dates.checkIn, dates.checkOut);
  const discountPricing = useMemo(
    () =>
      buildDiscountPricing({
        room: selectedRoom,
        nights,
        guests: Number(dates.guests),
      }),
    [selectedRoom, nights, dates.guests],
  );
  const aiFocusRooms = searchParams.get("ai") === "1";

  useEffect(() => {
    // Keep AI chat state consistent with the hotel the user is viewing/choosing.
    if (!hotel?.id) return;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(ASSISTANT_MEMORY_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return;
      const next = {
        ...parsed,
        context: {
          ...(parsed.context || {}),
          selectedHotelId: Number(hotel.id),
          selectedHotelName: hotel.name || "",
        },
      };
      sessionStorage.setItem(ASSISTANT_MEMORY_KEY, JSON.stringify(next));
    } catch {
      // ignore storage issues
    }
  }, [hotel?.id, hotel?.name]);

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

    if (resumeIntent.openPayment) {
      quoteMutation.mutate(roomMatch, {
        onSuccess: () => {
          setPaymentOpen(true);
        },
      });
    }
  }, [rooms, selectedRoom]);

  useEffect(() => {
    if (!aiFocusRooms || !rooms.length) return;
    const roomSection = document.getElementById("room-types");
    roomSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [aiFocusRooms, rooms.length, location.key]);

  useEffect(() => {
    updateBookingUi({
      checkInDate: dates.checkIn,
      checkOutDate: dates.checkOut,
      guests: Number(dates.guests),
    });
    console.info("[BookingUi] HotelDetails dates synced", dates);
  }, [dates.checkIn, dates.checkOut, dates.guests, updateBookingUi]);

  useEffect(() => {
    setSavedCards(loadSavedCards());
  }, []);

  useEffect(() => {
    setActiveSavedCardIndex((current) => {
      if (!savedCards.length) return null;
      if (current == null) return current;
      return Math.min(current, savedCards.length - 1);
    });
  }, [savedCards.length]);

  useEffect(() => {
    if (!paymentOpen || !savedCards.length || activeSavedCardIndex != null) return;
    applySavedCard(savedCards[0], 0);
  }, [paymentOpen, savedCards, activeSavedCardIndex]);

  function saveCardIfNeeded() {
    if (paymentMethod !== PAYMENT_METHODS.CARD || !saveCardForNextTime) return;
    if (!paymentDraft.cardNumber || !paymentDraft.fullName || !paymentDraft.expiry) return;
    const normalized = {
      fullName: paymentDraft.fullName.trim(),
      cardNumber: paymentDraft.cardNumber.trim(),
      expiry: paymentDraft.expiry.trim(),
      cvv: paymentDraft.cvv.trim(),
    };
    const alreadyExists = savedCards.some(
      (card) =>
        card.cardNumber.replace(/\s/g, "") === normalized.cardNumber.replace(/\s/g, "") &&
        card.expiry === normalized.expiry,
    );
    if (alreadyExists) return;
    const next = [normalized, ...savedCards];
    setSavedCards(saveSavedCards(next));
  }

  function applySavedCard(card, index) {
    setActiveSavedCardIndex(index);
    setPaymentDraft({
      fullName: card.fullName || "",
      cardNumber: card.cardNumber || "",
      expiry: card.expiry || "",
      cvv: card.cvv || "",
    });
    setPaymentMethod(PAYMENT_METHODS.CARD);
  }

  function swapPaymentCard() {
    if (savedCards.length < 2) return;
    const currentIndex = activeSavedCardIndex ?? 0;
    const nextIndex = (currentIndex + 1) % savedCards.length;
    applySavedCard(savedCards[nextIndex], nextIndex);
  }

  const checkoutActiveSavedCardIndex = savedCards.length
    ? Math.min(activeSavedCardIndex ?? 0, savedCards.length - 1)
    : 0;
  const checkoutStackedCards = savedCards
    .map((card, index) => ({
      card,
      index,
      stackIndex: (index - checkoutActiveSavedCardIndex + savedCards.length) % savedCards.length,
    }))
    .filter(({ stackIndex }) => stackIndex < Math.min(savedCards.length, 3));

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
                    className="btn btn-outline fav-btn"
                    onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
                    aria-label={isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
                    aria-pressed={isInWishlist}
                  >
                    {isInWishlist ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
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
              <h2 id="room-types">{t("hotelDetail.roomTypesHeading")}</h2>
              {aiFocusRooms ? (
                <p className="muted" style={{ marginBottom: "10px" }}>
                  QuickReserve AI opened this section. Choose a room type to continue booking.
                </p>
              ) : null}
              <Alert type="error">{quoteMutation.error?.message || bookingMutation.error?.message}</Alert>
              <div className="room-list">
                {rooms.map((room) => (
                  <article
                    className="room-card room-card--hotel-detail"
                    key={room.id}
                  >
                    <div className="room-card__media" aria-hidden>
                      {room.imageUrl ? (
                        <img src={room.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="room-card__mediaFallback">Room</span>
                      )}
                    </div>
                    <div className="room-card__content">
                      <h3 className="room-card__title" title={room.name}>
                        {room.name}
                      </h3>

                      <p className="room-card__desc">
                        {room.description || t("hotelDetail.defaultRoomDescription")}
                      </p>

                      {(room.capacity || room.inventoryCount || (room.amenities || []).length) ? (
                        <div className="amenity-row">
                          <span>{t("hotelDetail.sleepsCount", { count: room.capacity })}</span>
                          <span>{t("hotelDetail.inventoryRooms", { count: room.inventoryCount })}</span>
                          {(room.amenities || []).slice(0, 2).map((amenity) => (
                            <span key={amenity}>{amenity}</span>
                          ))}
                          {(room.amenities || []).length > 2 ? (
                            <span className="amenity-more">+{(room.amenities || []).length - 2}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <aside className="room-card__actions" aria-label={`${room.name} actions`}>
                      {auth.isAuthenticated ? (
                        <div className="room-card__actionsTop">
                          <RoomWishlistButton
                            room={room}
                            hotel={hotel}
                            enabled={auth.isAuthenticated}
                          />
                          <button
                            className="btn btn-small btn-outline room-card__alertBtn"
                            type="button"
                            onClick={() => {
                              setAlertOpenFor(room.id);
                              setAlertDraft({ alertType: "PRICE_BELOW", targetPrice: "" });
                            }}
                          >
                            {t("hotelDetail.addAlert")}
                          </button>
                        </div>
                      ) : (
                        <div className="room-card__actionsTop room-card__actionsTop--guest" aria-hidden />
                      )}

                      <div className="room-card__priceBlock">
                        <div className="room-card__priceValue">{money(room.basePrice)}</div>
                        <div className="room-card__priceMeta">{t("hotelDetail.perNight")}</div>
                      </div>

                      <button
                        className="btn btn-teal room-action-btn room-action-btn--primary"
                        onClick={() => quoteMutation.mutate(room)}
                      >
                        {t("hotelDetail.checkAvailability")}
                      </button>
                    </aside>
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
                    <strong>{money(discountPricing.baseTotal)}</strong>
                  </div>
                  {discountPricing.discountAmount > 0 ? (
                    <div className="price-line">
                      <span>{t("hotelDetail.labelDiscount")}</span>
                      <strong>-{money(discountPricing.discountAmount)}</strong>
                    </div>
                  ) : null}
                  {discountPricing.discountAmount > 0 ? (
                    <p className="muted" style={{ marginTop: "-8px" }}>
                      {t("hotelDetail.discountApplied", {
                        reasons: discountPricing.reasons.map((reason) => t(`hotelDetail.discountReason.${reason}`)).join(", "),
                      })}
                    </p>
                  ) : null}
                  <div className="price-line">
                    <span>{t("hotelDetail.labelTotal")}</span>
                    <strong>{money(discountPricing.finalTotal)}</strong>
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
              <div
                className="modal"
                role="dialog"
                aria-label={t("hotelDetail.mockPaymentAria")}
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: "90vh", overflowY: "auto" }}
              >
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
                    saveCardIfNeeded();
                    bookingMutation.mutate();
                  }}
                >
                  <label>
                    Payment method
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value={PAYMENT_METHODS.CARD}>Credit card</option>
                      <option value={PAYMENT_METHODS.CASH}>Cash at check-in</option>
                    </select>
                  </label>

                  {savedCards.length > 0 ? (
                    <div className="profile-saved-card-stack hotel-payment-card-stack">
                      <div className="profile-saved-card-toolbar">
                        <span>
                          Saved card {checkoutActiveSavedCardIndex + 1} of {savedCards.length}
                        </span>
                        {savedCards.length > 1 ? (
                          <button type="button" className="btn btn-small btn-outline" disabled={pendingBook} onClick={swapPaymentCard}>
                            <FaExchangeAlt aria-hidden />
                            Swap card
                          </button>
                        ) : null}
                      </div>

                      <div
                        className={`profile-saved-card-stage hotel-payment-card-stage${
                          paymentMethod === PAYMENT_METHODS.CASH ? " is-muted" : ""
                        }`}
                        aria-live="polite"
                      >
                        {checkoutStackedCards.map(({ card, index, stackIndex }) => {
                          const brand = getCardBrand(card.cardNumber);
                          const stackX = stackIndex * 10;
                          const stackY = 34 - stackIndex * 14;
                          return (
                            <button
                              key={`${card.cardNumber}-${card.expiry}-${index}`}
                              type="button"
                              className={`profile-saved-card profile-saved-card--stacked hotel-payment-saved-card-button${
                                stackIndex === 0 ? " is-active" : ""
                              }`}
                              disabled={pendingBook}
                              aria-hidden={stackIndex !== 0}
                              aria-label={stackIndex === 0 ? `Use saved card ${checkoutActiveSavedCardIndex + 1} of ${savedCards.length}` : undefined}
                              tabIndex={stackIndex === 0 ? 0 : -1}
                              style={{
                                "--stack-x": `${stackX}px`,
                                "--stack-y": `${stackY}px`,
                                "--stack-scale": `${1 - stackIndex * 0.025}`,
                                "--stack-opacity": `${1 - stackIndex * 0.14}`,
                                "--stack-z": `${10 - stackIndex}`,
                              }}
                              onClick={() => applySavedCard(card, index)}
                            >
                              <div className="profile-saved-card__preview">
                                <div className="profile-saved-card__top">
                                  <span className="profile-saved-card__chip" aria-hidden />
                                  <strong>{brand}</strong>
                                </div>
                                <div className="profile-saved-card__number">{maskCardNumber(card.cardNumber)}</div>
                                <div className="profile-saved-card__meta">
                                  <span>
                                    <small>Card holder</small>
                                    {card.fullName || "Guest"}
                                  </span>
                                  <span>
                                    <small>Expires</small>
                                    {card.expiry || "--"}
                                  </span>
                                </div>
                                <small className="profile-saved-card__type">{brand} debit</small>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {paymentMethod === PAYMENT_METHODS.CARD ? (
                    <>
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      id="save-card-for-next-time"
                      type="checkbox"
                      checked={saveCardForNextTime}
                      onChange={(e) => setSaveCardForNextTime(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#0ea5e9", margin: 0 }}
                    />
                    <label
                      htmlFor="save-card-for-next-time"
                      style={{ margin: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
                    >
                      Save this card for quick checkout next time
                    </label>
                  </div>
                    </>
                  ) : (
                    <div
                      style={{
                        padding: "12px",
                        border: "1px solid #93c5fd",
                        borderRadius: "10px",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      You selected cash payment. Your booking will be confirmed now, and payment will be collected at check-in.
                    </div>
                  )}
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
                      Fill test card
                    </button>
                    <button className="btn btn-primary" disabled={pendingBook}>
                      {pendingBook ? t("hotelDetail.processing") : paymentMethod === PAYMENT_METHODS.CARD ? t("hotelDetail.payAndBook") : "Book now (pay cash)"}
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
                  <p className="muted" style={{ fontSize: "0.9rem" }}>
                    {t("hotelDetail.alertNotifyEmailHint")}
                  </p>
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
