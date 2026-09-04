import { DESIGNATIONS, ROLES } from "./navigation.js";

export const USER_ORIGINS = {
  PUBLIC_REGISTRATION: "public_registration",
  PLATFORM_INTERNAL: "platform_internal",
  NGO_INTERNAL: "ngo_internal",
};

export const PUBLIC_REGISTRATION = {
  path: "/registration",
  role: ROLES.PLATFORM_ADMIN,
  roleLabel: "Main Platform Admin",
};

export const INTERNAL_USER_FLOWS = {
  ngoAdmin: {
    role: ROLES.NGO_ADMIN,
    roleLabel: "NGO Admin",
    createdBy: ROLES.PLATFORM_ADMIN,
    origin: USER_ORIGINS.PLATFORM_INTERNAL,
    href: "/platform/ngos",
    title: "Create NGO Admin",
    description:
      "NGO Admins are assigned when a Platform Admin creates or manages an NGO. They are not created through public registration.",
  },
  worker: {
    role: ROLES.WORKER,
    roleLabel: "Worker / Employee",
    createdBy: ROLES.NGO_ADMIN,
    origin: USER_ORIGINS.NGO_INTERNAL,
    href: "/workers",
    title: "Create Worker / Employee",
    description:
      "Workers are created by an NGO Admin, then given a designation, permissions, and project or site assignments. Designations are not system roles.",
    designations: [
      { id: DESIGNATIONS.STORE_LOGISTICS_OFFICER, label: "Store / Logistics Officer" },
      { id: DESIGNATIONS.FIELD_WORKER, label: "Field Worker" },
      { id: DESIGNATIONS.PROJECT_WORKER, label: "Project Worker" },
      { id: DESIGNATIONS.DATA_ENTRY_OFFICER, label: "Data Entry Officer" },
      { id: DESIGNATIONS.OTHER, label: "Other" },
    ],
  },
  platformAdminInvite: {
    role: ROLES.PLATFORM_ADMIN,
    roleLabel: "Main Platform Admin",
    createdBy: ROLES.PLATFORM_ADMIN,
    origin: USER_ORIGINS.PLATFORM_INTERNAL,
    href: "/platform/users",
    title: "Invite Platform Admin",
    description:
      "Additional platform administrators can be invited from this directory. The public registration flow remains reserved for first-time platform setup.",
  },
};
