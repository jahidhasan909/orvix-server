import { headers } from "#shims/next-headers.js";
import { auth } from "#lib/auth.js";
import { ROLES } from "#lib/navigation.js";

export async function requirePlatformAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  if (session.user.role !== ROLES.PLATFORM_ADMIN) {
    return { error: "Only a Main Platform Admin can manage NGOs.", status: 403 };
  }

  return { session, userId: session.user.id, email: session.user.email || session.user.name || "platform_admin" };
}
