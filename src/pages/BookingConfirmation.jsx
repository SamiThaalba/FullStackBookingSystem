import { Link, useLocation, useParams } from "react-router-dom";
import { formatDate, money } from "../utils/format";

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const { state } = useLocation();
  const booking = state?.booking;
  const payment = state?.payment;

  return (
    <section className="container confirmation-page">
      <div className="confirmation-card">
        <p className="eyebrow">Booking confirmed</p>
        <h1>Sleep easy. Your stay is booked.</h1>
        <p>
          Your booking reference is <strong>#{booking?.id || bookingId}</strong>. Payment was processed
          successfully to complete your booking.
        </p>
        {payment?.id ? (
          <p className="muted">
            Payment #{payment.id} · {money(payment.amount)} · {payment.status}
          </p>
        ) : null}
        {booking && (
          <div className="summary-grid">
            <div>
              <span>Hotel</span>
              <strong>{state?.hotel?.name || `Hotel #${booking.hotelId}`}</strong>
            </div>
            <div>
              <span>Room</span>
              <strong>{state?.room?.name || `Room #${booking.roomTypeId}`}</strong>
            </div>
            <div>
              <span>Dates</span>
              <strong>{formatDate(booking.startDate)} to {formatDate(booking.endDate)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{money(booking.totalPrice)}</strong>
            </div>
          </div>
        )}
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/my-bookings">
            Manage booking
          </Link>
          <Link className="btn btn-outline" to="/hotels">
            Search again
          </Link>
        </div>
      </div>
    </section>
  );
}
