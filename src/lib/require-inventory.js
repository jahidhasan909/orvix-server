import { PERMISSIONS, ROLES } from "#lib/navigation.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";

export async function requireInventory(kind = "view") {
  const gate = await requireNgoSession([ROLES.NGO_ADMIN, ROLES.WORKER]);
  if (gate.error) return gate;

  const canManage = gate.role === ROLES.NGO_ADMIN;
  const permissions = gate.session.user.permissions ?? gate.session.user.extraPermissions ?? [];

  if (canManage) {
    return { ...gate, canManage: true, permissions };
  }

  const canViewStock =
    permissions.includes(PERMISSIONS.INVENTORY_VIEW) || permissions.includes(PERMISSIONS.DISTRIBUTION_VIEW);
  const canRequest = permissions.includes(PERMISSIONS.RESOURCE_REQUESTS_VIEW);
  const canIssue = permissions.includes(PERMISSIONS.DISTRIBUTION_VIEW);

  if (kind === "manage") {
    return { error: "Only an NGO Admin can manage inventory.", status: 403 };
  }
  if (kind === "issue" && !canIssue) {
    return { error: "You cannot issue stock.", status: 403 };
  }
  if (kind === "request") {
    return { ...gate, canManage: false, canRequest: true, permissions };
  }
  if (kind === "view" && !canViewStock && !canRequest) {
    return { error: "You cannot access this NGO inventory.", status: 403 };
  }

  return { ...gate, canManage: false, canViewStock, canRequest, canIssue, permissions };
}
