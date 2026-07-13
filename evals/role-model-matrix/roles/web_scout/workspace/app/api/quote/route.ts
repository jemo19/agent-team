import { priceQuote } from "../../../services/pricing";
export async function POST(request: Request) { return Response.json(await priceQuote(await request.json())); }
