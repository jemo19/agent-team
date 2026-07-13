import { toCsv } from "../csv.mjs";

export async function exportContacts(request, session, db, logger) {
  const accountId = new URL(request.url).searchParams.get("accountId");
  logger.info({ accountId, headers: Object.fromEntries(request.headers) });
  const contacts = await db.contacts.findMany({
    where: { accountId },
    select: { name: true, email: true, apiToken: true },
  });
  return new Response(toCsv(contacts), { status: 200, headers: { "content-type": "text/csv" } });
}
