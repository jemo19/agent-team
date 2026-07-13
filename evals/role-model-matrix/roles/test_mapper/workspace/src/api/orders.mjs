import { submitOrder } from "../orders/submit.mjs";
export async function postOrder(store, body) { return { status: 201, body: await submitOrder(store, body) }; }
