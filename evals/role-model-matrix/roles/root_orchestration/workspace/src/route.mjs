import { buildPublicIncident } from "./summary.mjs";

export function getIncidentResponse(incident) {
  return { status: 200, body: buildPublicIncident(incident) };
}
