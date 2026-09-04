import { DESIGNATIONS } from "#lib/navigation.js";
import { parseSalaryInput, publicSalary } from "#lib/payroll.js";
import {
  designationLabel,
  sanitizeDesignation,
  sanitizeIdList,
  sanitizePermissions,
} from "#lib/worker-catalog.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function asBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function joiningDateFrom(value) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateInputValue(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function parseWorkerBody(body, { requirePassword = false } = {}) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }

  const name = asString(body.fullName || body.name);
  const email = asString(body.email).toLowerCase();
  const phone = asString(body.phone);
  const employeeId = asString(body.employeeId);
  const designation = sanitizeDesignation(asString(body.designation));
  const designationOther = asString(body.designationOther);
  const image = asString(body.image || body.photoUrl);
  const address = asString(body.address);
  const joiningDate = joiningDateFrom(body.joiningDate);
  const status = asString(body.status) === "inactive" ? "inactive" : "active";
  const mfaEnabled = asBool(body.mfaEnabled, false);
  const password = typeof body.password === "string" ? body.password : "";
  const extraPermissions = sanitizePermissions(body.permissions);
  const assignedProjectIds = sanitizeIdList(body.assignedProjectIds);
  const assignedSiteIds = sanitizeIdList(body.assignedSiteIds);
  const salaryParsed = parseSalaryInput(body.salary);

  if (!name) return { error: "Full name is required." };
  if (!email || !EMAIL_RE.test(email)) return { error: "A valid email is required." };
  if (!phone) return { error: "Phone number is required." };
  if (!employeeId) return { error: "Employee ID is required." };
  if (!designation) return { error: "Designation is required." };
  if (designation === DESIGNATIONS.OTHER && !designationOther) {
    return { error: "Describe the designation when Other is selected." };
  }
  if (!joiningDate) return { error: "Joining date is required." };
  if (requirePassword && password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!requirePassword && password && password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (salaryParsed.error) return { error: salaryParsed.error };

  return {
    data: {
      name,
      email,
      phone,
      employeeId,
      designation,
      designationOther: designation === DESIGNATIONS.OTHER ? designationOther : null,
      image: image || null,
      address: address || null,
      joiningDate,
      status,
      mfaEnabled,
      extraPermissions,
      assignedProjectIds,
      assignedSiteIds,
      password,
      salary: salaryParsed.data,
    },
  };
}

export function publicWorker(user, { projects = [], sites = [] } = {}) {
  const projectNames = Object.fromEntries(projects.map((item) => [item.id, item.name]));
  const siteNames = Object.fromEntries(sites.map((item) => [item.id, item.name]));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    employeeId: user.employeeId,
    designation: user.designation,
    designationOther: user.designationOther,
    designationLabel: designationLabel(user.designation, user.designationOther),
    image: user.image,
    address: user.address,
    joiningDate: user.joiningDate,
    status: user.status,
    mfaEnabled: Boolean(user.mfaEnabled),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    extraPermissions: user.extraPermissions ?? [],
    assignedProjectIds: user.assignedProjectIds ?? [],
    assignedSiteIds: user.assignedSiteIds ?? [],
    assignedProjects: (user.assignedProjectIds ?? []).map((id) => projectNames[id]).filter(Boolean),
    assignedSites: (user.assignedSiteIds ?? []).map((id) => siteNames[id]).filter(Boolean),
    salary: publicSalary(user.salary),
    createdAt: user.createdAt,
  };
}
