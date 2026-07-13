export function buildPublicIncident(incident) {
  return {
    id: incident.id,
    status: incident.status === "resolved" ? "closed" : incident.status,
    message: incident.internalNote,
    updatedAt: incident.updatedAt,
    internalNote: incident.internalNote,
  };
}
