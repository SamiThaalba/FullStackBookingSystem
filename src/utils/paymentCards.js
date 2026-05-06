export const SAVED_CARDS_STORAGE_KEY = "quickreserve-saved-cards-v1";

export function maskCardNumber(cardNumber) {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  const suffix = digits.slice(-4);
  return suffix ? `**** **** **** ${suffix}` : "****";
}

export function getCardBrand(cardNumber) {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (digits.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  return "CARD";
}

export function normalizeSavedCard(card) {
  if (!card || typeof card !== "object") return null;
  const normalized = {
    fullName: String(card.fullName || "").trim(),
    cardNumber: String(card.cardNumber || "").trim(),
    expiry: String(card.expiry || "").trim(),
    cvv: String(card.cvv || "").trim(),
  };
  return normalized.cardNumber && normalized.expiry ? normalized : null;
}

export function loadSavedCards() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_CARDS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSavedCard).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveSavedCards(cards) {
  const normalized = Array.isArray(cards) ? cards.map(normalizeSavedCard).filter(Boolean) : [];
  localStorage.setItem(SAVED_CARDS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
