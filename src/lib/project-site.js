import { ROLES } from "#lib/navigation.js";
import { asString, dateInputValue, joiningDateFrom } from "#lib/worker-payload.js";

export const PROJECT_STATUSES = ["active", "on_hold", "completed", "archived"];
export const SITE_STATUSES = ["active", "on_hold", "completed", "archived"];

export const STATUS_LABELS = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Active";
}

function sanitizeStatus(value, allowed) {
  const status = asString(value);
  return allowed.includes(status) ? status : "active";
}

function optionalDate(value) {
  const raw = asString(value);
  if (!raw) return null;
  return joiningDateFrom(raw);
}

export function parseProjectBody(body) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }

  const name = asString(body.name);
  const description = asString(body.description) || null;
  const manager = asString(body.manager) || null;
  const status = sanitizeStatus(body.status, PROJECT_STATUSES);
  const startDate = optionalDate(body.startDate);
  const endDate = optionalDate(body.endDate);

  if (!name) return { error: "Project name is required." };
  if (startDate && endDate && endDate < startDate) {
    return { error: "End date cannot be before the start date." };
  }

  return { data: { name, description, manager, status, startDate, endDate } };
}

export function parseSiteBody(body, { requireProject = true } = {}) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }

  const name = asString(body.name);
  const projectId = asString(body.projectId) || null;
  const location = asString(body.location) || null;
  const description = asString(body.description) || null;
  const status = sanitizeStatus(body.status, SITE_STATUSES);
  const startDate = optionalDate(body.startDate);
  const endDate = optionalDate(body.endDate);

  if (!name) return { error: "Site name is required." };
  if (requireProject && !projectId) return { error: "A project is required for this site." };
  if (startDate && endDate && endDate < startDate) {
    return { error: "End date cannot be before the start date." };
  }

  return { data: { name, projectId, location, description, status, startDate, endDate } };
}

export function publicProject(project, extras = {}) {
  return {
    id: project.id,
    ngoId: project.ngoId,
    name: project.name,
    description: project.description || "",
    manager: project.manager || "",
    status: project.status,
    statusLabel: statusLabel(project.status),
    startDate: dateInputValue(project.startDate),
    endDate: dateInputValue(project.endDate),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    siteCount: project._count?.sites ?? project.sites?.length ?? extras.siteCount ?? 0,
    sites: (project.sites ?? []).map((site) => publicSite(site)),
    workers: extras.workers ?? [],
  };
}

export function publicSite(site, extras = {}) {
  return {
    id: site.id,
    ngoId: site.ngoId,
    projectId: site.projectId || "",
    projectName: site.project?.name || extras.projectName || "",
    name: site.name,
    location: site.location || "",
    description: site.description || "",
    status: site.status,
    statusLabel: statusLabel(site.status),
    startDate: dateInputValue(site.startDate),
    endDate: dateInputValue(site.endDate),
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    workers: extras.workers ?? [],
  };
}

export function parseWorkerIds(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.workerIds)) return null;
  return [...new Set(body.workerIds.map((id) => asString(id)).filter(Boolean))];
}

export function asIdList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((id) => String(id).trim()).filter(Boolean))];
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return asIdList(parsed);
    } catch {
      return [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
    }
  }
  return [];
}

export async function scopedAssignmentIds(prisma, ngoId, projectIds, siteIds) {
  const requestedProjects = asIdList(projectIds);
  const requestedSites = asIdList(siteIds);

  const [projects, sites] = await Promise.all([
    requestedProjects.length
      ? prisma.project.findMany({
          where: { ngoId, id: { in: requestedProjects } },
          select: { id: true },
        })
      : [],
    requestedSites.length
      ? prisma.site.findMany({
          where: { ngoId, id: { in: requestedSites } },
          select: { id: true, projectId: true },
        })
      : [],
  ]);

  if (projects.length !== requestedProjects.length) {
    return { error: "One or more projects do not belong to this NGO." };
  }
  if (sites.length !== requestedSites.length) {
    return { error: "One or more sites do not belong to this NGO." };
  }

  return {
    assignedProjectIds: [...new Set([...requestedProjects, ...sites.map((site) => site.projectId).filter(Boolean)])],
    assignedSiteIds: requestedSites,
  };
}

export async function workersForAssignment(prisma, ngoId, { projectId, siteId } = {}) {
  const where = { ngoId, role: ROLES.WORKER };
  if (projectId) where.assignedProjectIds = { has: projectId };
  if (siteId) where.assignedSiteIds = { has: siteId };

  const workers = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      designation: true,
      status: true,
    },
  });

  return workers;
}

export async function syncProjectWorkers(prisma, { ngoId, projectId, workerIds }) {
  const workers = await prisma.user.findMany({
    where: { ngoId, role: ROLES.WORKER },
    select: { id: true, assignedProjectIds: true },
  });

  const wanted = new Set(workerIds);
  const ops = workers.flatMap((worker) => {
    const has = worker.assignedProjectIds.includes(projectId);
    const should = wanted.has(worker.id);
    if (has === should) return [];
    const assignedProjectIds = should
      ? [...worker.assignedProjectIds, projectId]
      : worker.assignedProjectIds.filter((id) => id !== projectId);
    return [prisma.user.update({ where: { id: worker.id }, data: { assignedProjectIds } })];
  });

  if (ops.length) await prisma.$transaction(ops);
}

export async function syncSiteWorkers(prisma, { ngoId, siteId, projectId, workerIds }) {
  const workers = await prisma.user.findMany({
    where: { ngoId, role: ROLES.WORKER },
    select: { id: true, assignedSiteIds: true, assignedProjectIds: true },
  });

  const wanted = new Set(workerIds);
  const ops = workers.flatMap((worker) => {
    const has = worker.assignedSiteIds.includes(siteId);
    const should = wanted.has(worker.id);
    const data = {};

    if (has !== should) {
      data.assignedSiteIds = should
        ? [...worker.assignedSiteIds, siteId]
        : worker.assignedSiteIds.filter((id) => id !== siteId);
    }

    if (should && projectId && !worker.assignedProjectIds.includes(projectId)) {
      data.assignedProjectIds = [...worker.assignedProjectIds, projectId];
    }

    if (!Object.keys(data).length) return [];
    return [prisma.user.update({ where: { id: worker.id }, data })];
  });

  if (ops.length) await prisma.$transaction(ops);
}

export async function stripProjectAssignments(prisma, { ngoId, projectId }) {
  const workers = await prisma.user.findMany({
    where: { ngoId, role: ROLES.WORKER, assignedProjectIds: { has: projectId } },
    select: { id: true, assignedProjectIds: true },
  });

  if (!workers.length) return;
  await prisma.$transaction(
    workers.map((worker) =>
      prisma.user.update({
        where: { id: worker.id },
        data: { assignedProjectIds: worker.assignedProjectIds.filter((id) => id !== projectId) },
      })
    )
  );
}

export async function stripSiteAssignments(prisma, { ngoId, siteId }) {
  const workers = await prisma.user.findMany({
    where: { ngoId, role: ROLES.WORKER, assignedSiteIds: { has: siteId } },
    select: { id: true, assignedSiteIds: true },
  });

  if (!workers.length) return;
  await prisma.$transaction(
    workers.map((worker) =>
      prisma.user.update({
        where: { id: worker.id },
        data: { assignedSiteIds: worker.assignedSiteIds.filter((id) => id !== siteId) },
      })
    )
  );
}
