/**
 * Repository — abstracts booking/hotel reads & writes behind a small API.
 * Used by: `src/pages/HotelDetails.jsx` (queries + availability + create booking)
 */
export function createBookingRepository(api) {
  return {
    getHotel: (id) => api.getHotel(id),
    getRoomTypes: (hotelId) => api.getRoomTypes(hotelId),
    checkAvailability: (payload) => api.checkAvailability(payload),
    createBooking: (payload) => api.createBooking(payload),
    confirmBooking: (bookingId) => api.confirmBooking(bookingId),
  };
}
