export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

export function calculateCart(input: { lines: Array<{ price: number; quantity: number }>; promoPercent?: number; delivery?: number }) {
  const subtotal = input.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discount = Math.round(subtotal * Math.max(0, Math.min(input.promoPercent ?? 0, 100)) / 100);
  const delivery = input.delivery ?? (subtotal >= 100_000 ? 0 : 7_500);
  return { subtotal, discount, delivery, total: subtotal - discount + delivery };
}
