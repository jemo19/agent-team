export async function fetchQuote(input: { coupon: string; subtotal: number }) { return fetch("/api/quote", { method: "POST", body: JSON.stringify(input) }).then((r) => r.json()); }
