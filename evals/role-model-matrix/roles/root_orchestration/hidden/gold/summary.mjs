export function buildPublicIncident(incident) {
  return {
    id: incident.id,
    status: incident.status,
    message: incident.publicMessage || "Update pending.",
    updatedAt: incident.updatedAt,
  };
}
