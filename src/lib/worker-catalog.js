import { DESIGNATIONS, MODULES, PERMISSIONS } from "./navigation.js";

export const WORKER_DESIGNATIONS = [
  { id: DESIGNATIONS.STORE_LOGISTICS_OFFICER, label: "Store / Logistics Officer" },
  { id: DESIGNATIONS.FIELD_WORKER, label: "Field Worker" },
  { id: DESIGNATIONS.PROJECT_WORKER, label: "Project Worker" },
  { id: DESIGNATIONS.DATA_ENTRY_OFFICER, label: "Data Entry Officer" },
  { id: DESIGNATIONS.OTHER, label: "Other" },
];

export const WORKER_PERMISSIONS = [
  { id: PERMISSIONS.ATTENDANCE_VIEW, label: "Attendance", module: MODULES.ATTENDANCE },
  { id: PERMISSIONS.LEAVE_VIEW, label: "Leave", module: MODULES.LEAVE },
  { id: PERMISSIONS.INVENTORY_VIEW, label: "Inventory", module: MODULES.INVENTORY },
  { id: PERMISSIONS.PROCUREMENT_VIEW, label: "Procurement", module: MODULES.PROCUREMENT },
  { id: PERMISSIONS.RESOURCE_REQUESTS_VIEW, label: "Resource requests", module: MODULES.RESOURCE_REQUESTS },
  { id: PERMISSIONS.DISTRIBUTION_VIEW, label: "Distribution", module: MODULES.DISTRIBUTION },
  { id: PERMISSIONS.DOCUMENTS_VIEW, label: "Documents", module: MODULES.DOCUMENTS },
  { id: PERMISSIONS.ACTIVITIES_VIEW, label: "Assigned activities", module: MODULES.PROJECTS },
  { id: PERMISSIONS.DATA_ENTRY_VIEW, label: "Data entry", module: MODULES.DATA_ENTRY },
];

export const DESIGNATION_PERMISSIONS = {
  [DESIGNATIONS.STORE_LOGISTICS_OFFICER]: [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.DISTRIBUTION_VIEW,
    PERMISSIONS.RESOURCE_REQUESTS_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
  ],
  [DESIGNATIONS.FIELD_WORKER]: [
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ACTIVITIES_VIEW,
    PERMISSIONS.RESOURCE_REQUESTS_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
  ],
  [DESIGNATIONS.PROJECT_WORKER]: [
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ACTIVITIES_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
  ],
  [DESIGNATIONS.DATA_ENTRY_OFFICER]: [PERMISSIONS.DATA_ENTRY_VIEW],
  [DESIGNATIONS.OTHER]: [PERMISSIONS.DOCUMENTS_VIEW],
};

const DESIGNATION_IDS = new Set(WORKER_DESIGNATIONS.map((item) => item.id));
const PERMISSION_IDS = new Set(WORKER_PERMISSIONS.map((item) => item.id));

export function designationLabel(designation, designationOther) {
  if (designation === DESIGNATIONS.OTHER) {
    return designationOther || "Other";
  }
  return WORKER_DESIGNATIONS.find((item) => item.id === designation)?.label ?? designation ?? "—";
}

export function sanitizeDesignation(value) {
  return DESIGNATION_IDS.has(value) ? value : "";
}

export function sanitizePermissions(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => PERMISSION_IDS.has(id)))];
}

export function defaultPermissionsFor(designation) {
  return DESIGNATION_PERMISSIONS[designation] ?? [];
}

export function sanitizeIdList(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id).trim()).filter(Boolean))];
}
