export function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return "$0.0000";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6
  }).format(value);
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

