import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { todayIso, tomorrowIso } from "../utils/dates";

const BookingUiContext = createContext(null);

export function BookingUiProvider({ children }) {
  const [state, setState] = useState({
    checkInDate: todayIso(),
    checkOutDate: tomorrowIso(),
    city: "",
    guests: 1,
  });

  const updateBookingUi = useCallback((next) => {
    setState((prev) => {
      const merged = {
        ...prev,
        ...next,
      };
      const unchanged =
        merged.checkInDate === prev.checkInDate &&
        merged.checkOutDate === prev.checkOutDate &&
        merged.city === prev.city &&
        Number(merged.guests) === Number(prev.guests);
      if (unchanged) {
        return prev;
      }
      // Debug trace: AI/URL/UI sync.
      console.info("[BookingUi] state updated", merged);
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({
      bookingUi: state,
      updateBookingUi,
    }),
    [state],
  );

  return <BookingUiContext.Provider value={value}>{children}</BookingUiContext.Provider>;
}

export function useBookingUi() {
  const ctx = useContext(BookingUiContext);
  if (!ctx) {
    throw new Error("useBookingUi must be used inside BookingUiProvider");
  }
  return ctx;
}
