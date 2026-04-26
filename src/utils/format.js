export function money(value) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(number);
}

export function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function compactAddress(hotel) {
  return [hotel?.address, hotel?.city, hotel?.country].filter(Boolean).join(", ");
}
