import { findCoupon } from "../db/coupons";
export async function priceQuote(input: { coupon: string; subtotal: number }) { const coupon = await findCoupon(input.coupon); return { total: coupon ? input.subtotal - coupon.amount : input.subtotal }; }
