import { requireOrgAdmin } from "../auth/authorize-org-admin.mjs";
export function authorizeRotation(session, orgId) { requireOrgAdmin(session, orgId); }
