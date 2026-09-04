import { MODULES } from "./navigation.js";

export const NGO_CATEGORIES = [
  { id: "food_nutrition", label: "Food / Nutrition / Food Distribution" },
  { id: "education", label: "Education" },
  { id: "healthcare", label: "Healthcare" },
  { id: "humanitarian", label: "Humanitarian / Emergency Support" },
  { id: "wash", label: "WASH / Community Development" },
  { id: "other", label: "Other" },
];

export const NGO_MODULE_OPTIONS = [
  {
    id: "projects_sites",
    label: "Projects & Sites",
    description: "Programs, field sites, and warehouses.",
    modules: [MODULES.PROJECTS, MODULES.SITES],
  },
  {
    id: "workers",
    label: "Worker / Employee Management",
    description: "Create workers and assign designations later.",
    modules: [MODULES.WORKERS],
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Team attendance records.",
    modules: [MODULES.ATTENDANCE],
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Stock levels, transfers, and adjustments.",
    modules: [MODULES.INVENTORY],
  },
  {
    id: "procurement",
    label: "Supplier & Purchase / Procurement",
    description: "Suppliers, purchase orders, and receiving.",
    modules: [MODULES.PROCUREMENT],
  },
  {
    id: "distribution",
    label: "Food / Resource Distribution",
    description: "Resource requests and last-mile issue.",
    modules: [MODULES.RESOURCE_REQUESTS, MODULES.DISTRIBUTION],
  },
  {
    id: "documents",
    label: "Documents",
    description: "Policies, SOPs, and operational files.",
    modules: [MODULES.DOCUMENTS],
  },
  {
    id: "reports_monitoring",
    label: "Reports & Monitoring",
    description: "Operational reports and activity monitoring.",
    modules: [MODULES.REPORTS, MODULES.MONITORING],
  },
];

export const DEFAULT_NGO_MODULE_OPTION_IDS = NGO_MODULE_OPTIONS.map((option) => option.id);

export function expandNgoModules(optionIds) {
  const selected = new Set(optionIds);
  return [...new Set(
    NGO_MODULE_OPTIONS
      .filter((option) => selected.has(option.id))
      .flatMap((option) => option.modules)
  )];
}

export function moduleOptionIdsFromEnabled(enabledModules = []) {
  const enabled = new Set(enabledModules);
  return NGO_MODULE_OPTIONS
    .filter((option) => option.modules.some((moduleId) => enabled.has(moduleId)))
    .map((option) => option.id);
}

export function categoryLabel(category, categoryOther) {
  if (category === "other" && categoryOther) return categoryOther;
  return NGO_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function makeNgoCode(name) {
  const slug = (name || "NGO").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "NGO";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}
