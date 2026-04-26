import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import { formatDate, money } from "../utils/format";

export default function MyBookings() {
  const queryClient = useQueryClient();
  const bookingsQuery = useQuery({
    queryKey: ["my-bookings"],
    queryFn: bookingApi.myBookings,
  });

  const cancelMutation = useMutation({
    mutationFn: bookingApi.cancelBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
  });

  const bookings = bookingsQuery.data || [];

  return (
    <section className="container section">
      <div className="section-heading">
        <p className="eyebrow">Manage booking</p>
        <h1>My bookings</h1>
      </div>
      <Alert type="error">{bookingsQuery.error?.message || cancelMutation.error?.message}</Alert>

      {bookingsQuery.isLoading ? (
        <div className="empty-state">Loading bookings...</div>
      ) : bookings.length ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>#{booking.id}</td>
                  <td>
                    {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                  </td>
                  <td>
                    <span className="status-pill">{booking.status}</span>
                  </td>
                  <td>{money(booking.totalPrice)}</td>
                  <td>
                    <button
                      className="btn btn-small btn-outline"
                      disabled={booking.status === "CANCELLED" || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(booking.id)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h2>No bookings yet</h2>
          <p>Search hotels and create your first booking.</p>
        </div>
      )}
    </section>
  );
}
