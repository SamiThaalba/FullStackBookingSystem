/**
 * Builder — stepwise construction of stay pricing / discount breakdown.
 * Used by: `src/pages/HotelDetails.jsx` (quote sidebar)
 */
export class BookingPricingBuilder {
  constructor() {
    this.room = null;
    this.nights = 1;
    this.guests = 1;
  }

  withRoom(room) {
    this.room = room;
    return this;
  }

  withStay(nights, guests) {
    this.nights = nights;
    this.guests = guests;
    return this;
  }

  build() {
    const safeNights = Number.isFinite(Number(this.nights)) ? Math.max(1, Number(this.nights)) : 1;
    const safeGuests = Number.isFinite(Number(this.guests)) ? Math.max(1, Number(this.guests)) : 1;
    const basePrice = Number(this.room?.basePrice || 0);
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
    if (Number(this.room?.inventoryCount || 0) >= 10) {
      discountRate += 0.05;
      reasons.push("highRoomAvailability");
    }
    discountRate = Math.min(discountRate, 0.22);

    const discountAmount = baseTotal * discountRate;
    const finalTotal = Math.max(0, baseTotal - discountAmount);
    return { baseTotal, discountRate, discountAmount, finalTotal, reasons };
  }
}
