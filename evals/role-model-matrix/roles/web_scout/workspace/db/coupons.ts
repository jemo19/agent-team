const coupons = new Map([["DEMO10", { amount: 1000, active: true }]]);
export async function findCoupon(code: string) { const coupon = coupons.get(code); return coupon?.active ? coupon : null; }
