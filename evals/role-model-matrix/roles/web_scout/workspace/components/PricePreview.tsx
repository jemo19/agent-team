import { fetchQuote } from "../lib/api/client";
export async function PricePreview(props: { coupon: string; subtotal: number }) { const quote = await fetchQuote(props); return <output>{quote.total}</output>; }
