import { expect, test } from "vitest";
import { priceQuote } from "../services/pricing";
test("applies active coupon", async () => expect((await priceQuote({ coupon: "DEMO10", subtotal: 5000 })).total).toBe(4000));
