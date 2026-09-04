import { headers } from "#shims/next-headers.js";
import { auth } from "#lib/auth.js";
import { ROLES } from "#lib/navigation.js";

export async function requireNgoSession(roles = [ROLES.NGO_ADMIN, ROLES.WORKER]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  if (!session.user.ngoId || !roles.includes(session.user.role)) {
    return { error: "You cannot access this NGO workspace.", status: 403 };
  }

  return {
    session,
    ngoId: session.user.ngoId,
    userId: session.user.id,
    role: session.user.role,
  };
}
