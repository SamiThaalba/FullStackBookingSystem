export class PaymentStrategy {
    async pay() {
        throw new Error("pay() must be implemented by a concrete payment strategy.");
    }
}

export class CreditCardPaymentStrategy extends PaymentStrategy {
    async pay({ bookingId, bookingApi }) {
        const payment = await bookingApi.createPayment(bookingId);
        await bookingApi.processPayment(payment.id, true);
        return {
            method: "credit-card",
            status: "PAID",
            message: "Credit card payment was processed successfully.",
        };
    }
}

export class CashPaymentStrategy extends PaymentStrategy {
    async pay({ bookingId, bookingApi }) {
        await bookingApi.createPayment(bookingId);
        return {
            method: "cash",
            status: "PENDING_CASH_COLLECTION",
            message: "Cash payment selected. Collect cash at check-in.",
        };
    }
}

export class PaymentContext {
    constructor(strategy) {
        this.strategy = strategy;
    }

    setStrategy(strategy) {
        this.strategy = strategy;
    }

    async executePayment(payload) {
        if (!this.strategy) {
            throw new Error("No payment strategy selected.");
        }
        return this.strategy.pay(payload);
    }
}

export const PAYMENT_METHODS = {
    CARD: "credit-card",
    CASH: "cash",
};

const strategyMap = {
    [PAYMENT_METHODS.CARD]: new CreditCardPaymentStrategy(),
    [PAYMENT_METHODS.CASH]: new CashPaymentStrategy(),
};

export function getPaymentStrategy(method) {
    return strategyMap[method] ?? strategyMap[PAYMENT_METHODS.CARD];
}
