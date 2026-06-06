/**
 * Factory — creates the correct payment Strategy for a method key.
 * Used by: `src/pages/HotelDetails.jsx`, `src/pages/Dashboard.jsx`,
 *          `src/patterns/command/ExecuteBookingCheckoutCommand.js`
 */
import {
  PAYMENT_METHODS,
  CreditCardPaymentStrategy,
  CashPaymentStrategy,
} from "../../strategies/paymentStrategies";

const strategies = {
  [PAYMENT_METHODS.CARD]: new CreditCardPaymentStrategy(),
  [PAYMENT_METHODS.CASH]: new CashPaymentStrategy(),
};

export function createPaymentStrategy(method) {
  return strategies[method] ?? strategies[PAYMENT_METHODS.CARD];
}
