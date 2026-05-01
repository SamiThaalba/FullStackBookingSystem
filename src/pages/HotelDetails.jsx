import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { storeBookingIntent } from "../auth/bookingIntent";
import Alert from "../components/Alert";
import { nightsBetween, todayIso, tomorrowIso } from "../utils/dates";
import { compactAddress, money } from "../utils/format";

export default function HotelDetails() {
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

  const saveRoomMutation = useMutation({
    mutationFn: (roomTypeId) => bookingApi.addToWishlist({ itemType: "ROOM_TYPE", targetId: roomTypeId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
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

  if (hotelQuery.isLoading) return <div className="container empty-state">Loading hotel...</div>;

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
              <p className="muted">{hotel.description || "Comfortable rooms in a convenient city location."}</p>
            </div>
            <div className="gallery-card">
              {hotel.imageUrl ? <img src={hotel.imageUrl} alt={hotel.name} /> : <span>Hotel gallery</span>}
            </div>
          </div>

          <div className="booking-panel">
            <label>
              Check in
              <input
                type="date"
                value={dates.checkIn}
                onChange={(event) => setDates({ ...dates, checkIn: event.target.value })}
              />
            </label>
            <label>
              Check out
              <input
                type="date"
                value={dates.checkOut}
                onChange={(event) => setDates({ ...dates, checkOut: event.target.value })}
              />
            </label>
            <label>
              Guests
              <input
                type="number"
                min="1"
                value={dates.guests}
                onChange={(event) => setDates({ ...dates, guests: event.target.value })}
              />
            </label>
            <strong>{nights} night stay</strong>
          </div>

          <div className="split-grid">
            <div>
              <h2>Room types</h2>
              <Alert type="error">{quoteMutation.error?.message || bookingMutation.error?.message}</Alert>
              <div className="room-list">
                {rooms.map((room) => (
                  <article className="room-card" key={room.id}>
                    <div>
                      <h3>{room.name}</h3>
                      <p>{room.description || "Flexible room for your trip."}</p>
                      <div className="amenity-row">
                        <span>Sleeps {room.capacity}</span>
                        <span>{room.inventoryCount} rooms</span>
                        {(room.amenities || []).slice(0, 3).map((amenity) => (
                          <span key={amenity}>{amenity}</span>
                        ))}
                      </div>
                    </div>
                    <div className="room-price">
                      <strong>{money(room.basePrice)}</strong>
                      <span>per night</span>
                      <button className="btn btn-teal" onClick={() => quoteMutation.mutate(room)}>
                        Check availability
                      </button>
                      {auth.isAuthenticated ? (
                        <button
                          className="btn btn-small btn-outline"
                          disabled={saveRoomMutation.isPending}
                          onClick={() => saveRoomMutation.mutate(room.id)}
                        >
                          {saveRoomMutation.isPending ? "Saving..." : "Save"}
                        </button>
                      ) : null}
                      {auth.isAuthenticated ? (
                        <button
                          className="btn btn-small btn-outline"
                          onClick={() => {
                            setAlertOpenFor(room.id);
                            setAlertDraft({ alertType: "PRICE_BELOW", targetPrice: "" });
                          }}
                        >
                          Add alert
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="quote-card">
              <h2>Your quote</h2>
              {quote ? (
                <>
                  <p>{quote.message}</p>
                  <div className="price-line">
                    <span>Room</span>
                    <strong>{selectedRoom?.name}</strong>
                  </div>
                  <div className="price-line">
                    <span>Nights</span>
                    <strong>{nights}</strong>
                  </div>
                  <div className="price-line">
                    <span>Base total</span>
                    <strong>{money((selectedRoom?.basePrice || 0) * nights)}</strong>
                  </div>
                  {typeof quote.totalPrice === "number" ? (
                    <div className="price-line">
                      <span>Dynamic pricing</span>
                      <strong>{money(quote.totalPrice - (selectedRoom?.basePrice || 0) * nights)}</strong>
                    </div>
                  ) : null}
                  <div className="price-line">
                    <span>Total</span>
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
                    {bookingMutation.isPending ? "Booking..." : "Create booking"}
                  </button>
                </>
              ) : (
                <p className="muted">Choose a room to see availability and price breakdown.</p>
              )}
            </aside>
          </div>

          {paymentOpen ? (
            <div className="modal-backdrop" role="presentation" onClick={() => !pendingBook && setPaymentOpen(false)}>
              <div className="modal" role="dialog" aria-label="Mock payment" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h2>Payment details (mock)</h2>
                  <button className="btn btn-small btn-outline" type="button" disabled={pendingBook} onClick={() => setPaymentOpen(false)}>
                    Close
                  </button>
                </div>
                <p className="muted">This is a mock payment. Your data is not stored.</p>
                <form
                  className="stack-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPendingBook(true);
                    bookingMutation.mutate();
                  }}
                >
                  <label>
                    Full name
                    <input value={paymentDraft.fullName} onChange={(e) => setPaymentDraft((c) => ({ ...c, fullName: e.target.value }))} required />
                  </label>
                  <label>
                    Card number
                    <input value={paymentDraft.cardNumber} onChange={(e) => setPaymentDraft((c) => ({ ...c, cardNumber: e.target.value }))} placeholder="4242 4242 4242 4242" required />
                  </label>
                  <div className="modal-grid">
                    <label>
                      Expiry
                      <input value={paymentDraft.expiry} onChange={(e) => setPaymentDraft((c) => ({ ...c, expiry: e.target.value }))} placeholder="12/30" required />
                    </label>
                    <label>
                      CVV
                      <input value={paymentDraft.cvv} onChange={(e) => setPaymentDraft((c) => ({ ...c, cvv: e.target.value }))} placeholder="123" required />
                    </label>
                  </div>
                  <div className="hero-actions" style={{ justifyContent: "space-between" }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={pendingBook}
                      onClick={() =>
                        setPaymentDraft({
                          fullName: auth.user?.username || "QuickReserve Guest",
                          cardNumber: "4242 4242 4242 4242",
                          expiry: "12/30",
                          cvv: "123",
                        })
                      }
                    >
                      Autofill
                    </button>
                    <button className="btn btn-primary" disabled={pendingBook}>
                      {pendingBook ? "Processing..." : "Pay & book"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {alertOpenFor ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setAlertOpenFor(null)}>
              <div className="modal" role="dialog" aria-label="Create alert" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h2>Create alert</h2>
                  <button className="btn btn-small btn-outline" type="button" onClick={() => setAlertOpenFor(null)}>
                    Close
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
                    Type
                    <select value={alertDraft.alertType} onChange={(e) => setAlertDraft((c) => ({ ...c, alertType: e.target.value }))}>
                      <option value="PRICE_BELOW">PRICE_BELOW</option>
                      <option value="AVAILABLE_NOW">AVAILABLE_NOW</option>
                    </select>
                  </label>
                  {alertDraft.alertType === "PRICE_BELOW" ? (
                    <label>
                      Target price
                      <input value={alertDraft.targetPrice} onChange={(e) => setAlertDraft((c) => ({ ...c, targetPrice: e.target.value }))} placeholder="e.g. 80" required />
                    </label>
                  ) : null}
                  <button className="btn btn-teal" disabled={alertMutation.isPending}>
                    {alertMutation.isPending ? "Creating..." : "Create alert"}
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
