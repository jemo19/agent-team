import { getPreference, setPreference } from "../preferences.mjs";

export function requireUser(request) {
  if (!request.user?.id) {
    const error = new Error("Authentication required");
    error.code = "UNAUTHORIZED";
    throw error;
  }
  return request.user;
}

export function getSavedFilters(request) {
  const user = requireUser(request);
  return getPreference(user.id, "saved-report-filters") ?? [];
}

export function updateSavedFilters(request) {
  const user = requireUser(request);
  return setPreference(user.id, "saved-report-filters", request.body?.filterIds);
}
