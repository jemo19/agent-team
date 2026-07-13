export async function submitOrder(store, request) {
  const existing = await store.findByRequestId(request.requestId);
  if (existing) return existing;
  return store.insert(request);
}
