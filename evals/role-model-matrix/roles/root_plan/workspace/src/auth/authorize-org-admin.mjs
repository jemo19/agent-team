export function requireOrgAdmin(session, orgId) {
  if (!session.adminOrgIds.includes(orgId)) throw Object.assign(new Error("forbidden"), { code: "FORBIDDEN" });
}
