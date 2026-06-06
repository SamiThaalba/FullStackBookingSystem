/**
 * Command — encapsulates “pay + confirm” as one executable operation.
 * Used by: `src/pages/HotelDetails.jsx` (after create booking succeeds)
 */
import { PaymentContext } from "../../strategies/paymentStrategies";
import { createPaymentStrategy } from "../factory/paymentStrategyFactory";

export class ExecuteBookingCheckoutCommand {
  constructor({ bookingApi, paymentMethod, bookingId }) {
    this.bookingApi = bookingApi;
    this.paymentMethod = paymentMethod;
    this.bookingId = bookingId;
  }

  async execute() {
    const paymentContext = new PaymentContext(createPaymentStrategy(this.paymentMethod));
    const paymentPromise = paymentContext.executePayment({
      bookingId: this.bookingId,
      bookingApi: this.bookingApi,
    });
    const confirmPromise = this.bookingApi.confirmBooking(this.bookingId);
    const [paymentResult, confirmed] = await Promise.all([paymentPromise, confirmPromise]);
    return { paymentResult, confirmed };
  }
}
