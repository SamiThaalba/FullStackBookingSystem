const BOOKING_INTENT_KEY = "quickreserve-booking-intent";

export function storeBookingIntent(intent) {
  try {
    sessionStorage.setItem(BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // ignore
  }
}

export function readBookingIntent() {
  try {
    return JSON.parse(sessionStorage.getItem(BOOKING_INTENT_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearBookingIntent() {
  try {
    sessionStorage.removeItem(BOOKING_INTENT_KEY);
  } catch {
    // ignore
  }
}

