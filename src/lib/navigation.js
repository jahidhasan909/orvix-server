export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  NGO_ADMIN: "ngo_admin",
  WORKER: "worker",
};

export const MODULES = {
  PROJECTS: "projects",
  SITES: "sites",
  WORKERS: "workers",
  ATTENDANCE: "attendance",
  LEAVE: "leave",
  INVENTORY: "inventory",
  PROCUREMENT: "procurement",
  RESOURCE_REQUESTS: "resource_requests",
  DISTRIBUTION: "distribution",
  DOCUMENTS: "documents",
  REPORTS: "reports",
  MONITORING: "monitoring",
  DATA_ENTRY: "data_entry",
};

export const ALL_MODULES = Object.values(MODULES);

export const PERMISSIONS = {
  INVENTORY_VIEW: "inventory.view",
  DISTRIBUTION_VIEW: "distribution.view",
  ACTIVITIES_VIEW: "activities.view",
  DATA_ENTRY_VIEW: "data_entry.view",
  ATTENDANCE_VIEW: "attendance.view",
  LEAVE_VIEW: "leave.view",
  DOCUMENTS_VIEW: "documents.view",
  RESOURCE_REQUESTS_VIEW: "resource_requests.view",
  PROCUREMENT_VIEW: "procurement.view",
};

export const DESIGNATIONS = {
  STORE_LOGISTICS_OFFICER: "store_logistics_officer",
  FIELD_WORKER: "field_worker",
  PROJECT_WORKER: "project_worker",
  DATA_ENTRY_OFFICER: "data_entry_officer",
  OTHER: "other",
};

const R = {
  PLATFORM: [ROLES.PLATFORM_ADMIN],
  NGO: [ROLES.NGO_ADMIN],
  NGO_WORKER: [ROLES.NGO_ADMIN, ROLES.WORKER],
  WORKER: [ROLES.WORKER],
};

export const NAVIGATION = [
  {
    id: "overview",
    label: "Overview",
    roles: [ROLES.PLATFORM_ADMIN, ROLES.NGO_ADMIN],
    items: [
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "House", roles: [ROLES.PLATFORM_ADMIN, ROLES.NGO_ADMIN] },
    ],
  },
  {
    id: "platform-org",
    label: "Organization",
    roles: R.PLATFORM,
    items: [
      { id: "ngos", label: "NGOs", href: "/platform/ngos", icon: "Globe", roles: R.PLATFORM },
      { id: "ngo-modules", label: "Module Management", href: "/platform/modules", icon: "Layers", roles: R.PLATFORM },
    ],
  },
  {
    id: "platform-admin",
    label: "Administration",
    roles: R.PLATFORM,
    items: [
      { id: "platform-users", label: "Platform Users", href: "/platform/users", icon: "Persons", roles: R.PLATFORM },
      { id: "platform-settings", label: "Platform Settings", href: "/platform/settings", icon: "Gear", roles: R.PLATFORM },
      { id: "platform-security", label: "Security / MFA", href: "/platform/security", icon: "Shield", roles: R.PLATFORM },
    ],
  },
  {
    id: "platform-insights",
    label: "Insights",
    roles: R.PLATFORM,
    items: [
      { id: "platform-reports", label: "Platform Reports", href: "/platform/reports", icon: "ChartColumn", roles: R.PLATFORM },
      { id: "platform-monitoring", label: "Monitoring", href: "/platform/monitoring", icon: "Pulse", roles: R.PLATFORM },
      { id: "audit-logs", label: "Audit Logs", href: "/platform/audit-logs", icon: "SquareArticle", roles: R.PLATFORM },
    ],
  },
  {
    id: "ngo-org",
    label: "Organization",
    roles: R.NGO,
    items: [
      { id: "ngo-settings", label: "NGO Settings", href: "/ngo/settings", icon: "Gear", roles: R.NGO },
      { id: "sharepoint", label: "SharePoint", href: "/ngo/sharepoint", icon: "Folders", roles: R.NGO, feature: "sharePoint" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    roles: R.NGO_WORKER,
    items: [
      {
        id: "projects-group",
        label: "Projects",
        icon: "Briefcase",
        module: MODULES.PROJECTS,
        roles: R.NGO,
        children: [
          { id: "projects", label: "Projects", href: "/projects", module: MODULES.PROJECTS, roles: R.NGO },
          { id: "sites", label: "Sites", href: "/sites", module: MODULES.SITES, roles: R.NGO },
        ],
      },
      { id: "workers", label: "Workers / Employees", href: "/workers", icon: "Persons", module: MODULES.WORKERS, roles: R.NGO },
      { id: "attendance", label: "Attendance", href: "/attendance", icon: "Calendar", module: MODULES.ATTENDANCE, roles: R.NGO },
      { id: "leave", label: "Leave Management", href: "/leave", icon: "CalendarXmark", module: MODULES.LEAVE, roles: R.NGO },
      {
        id: "my-work",
        label: "My Work",
        icon: "PersonWorker",
        roles: R.WORKER,
        children: [
          { id: "my-attendance", label: "My Attendance", href: "/attendance/me", icon: "Calendar", roles: R.WORKER, workerDefault: true, excludeDesignations: [DESIGNATIONS.DATA_ENTRY_OFFICER] },
          { id: "my-assignments", label: "My Projects / Sites", href: "/my-assignments", icon: "MapPin", roles: R.WORKER, workerDefault: true, excludeDesignations: [DESIGNATIONS.DATA_ENTRY_OFFICER] },
          { id: "my-leave", label: "My Leave", href: "/leave", icon: "CalendarXmark", roles: R.WORKER, workerDefault: true, excludeDesignations: [DESIGNATIONS.DATA_ENTRY_OFFICER] },
          { id: "issued", label: "Issued Resources", href: "/issued", icon: "Box", roles: R.WORKER, workerDefault: true, excludeDesignations: [DESIGNATIONS.DATA_ENTRY_OFFICER] },
          { id: "activities", label: "Assigned Activities", href: "/activities", icon: "ListCheck", module: MODULES.PROJECTS, roles: R.WORKER, designations: [DESIGNATIONS.FIELD_WORKER, DESIGNATIONS.PROJECT_WORKER], permissions: [PERMISSIONS.ACTIVITIES_VIEW] },
        ],
      },
    ],
  },
  {
    id: "supply",
    label: "Supply Chain",
    roles: R.NGO_WORKER,
    items: [
      {
        id: "inventory-group",
        label: "Inventory",
        icon: "Box",
        module: MODULES.INVENTORY,
        roles: R.NGO_WORKER,
        permissions: [PERMISSIONS.INVENTORY_VIEW],
        designations: [DESIGNATIONS.STORE_LOGISTICS_OFFICER],
        children: [
          { id: "inventory", label: "Overview", href: "/inventory", module: MODULES.INVENTORY, roles: R.NGO_WORKER, permissions: [PERMISSIONS.INVENTORY_VIEW], designations: [DESIGNATIONS.STORE_LOGISTICS_OFFICER] },
          { id: "inventory-items", label: "Items", href: "/inventory/items", module: MODULES.INVENTORY, roles: R.NGO, },
          { id: "inventory-categories", label: "Categories", href: "/inventory/categories", module: MODULES.INVENTORY, roles: R.NGO },
          { id: "stock-txn", label: "Stock Transactions", href: "/inventory/transactions", module: MODULES.INVENTORY, roles: R.NGO_WORKER, permissions: [PERMISSIONS.INVENTORY_VIEW], designations: [DESIGNATIONS.STORE_LOGISTICS_OFFICER] },
          { id: "stock-transfers", label: "Stock Transfers", href: "/inventory/transfers", module: MODULES.INVENTORY, roles: R.NGO },
          { id: "stock-adjust", label: "Adjustments", href: "/inventory/adjustments", module: MODULES.INVENTORY, roles: R.NGO },
        ],
      },
      {
        id: "procurement-group",
        label: "Procurement",
        icon: "ShoppingCart",
        module: MODULES.PROCUREMENT,
        roles: R.NGO,
        children: [
          { id: "suppliers", label: "Suppliers", href: "/suppliers", module: MODULES.PROCUREMENT, roles: R.NGO },
          { id: "purchase-orders", label: "Purchase Orders", href: "/purchases/orders", module: MODULES.PROCUREMENT, roles: R.NGO },
          { id: "purchases", label: "Purchases", href: "/purchases", module: MODULES.PROCUREMENT, roles: R.NGO },
          { id: "receiving", label: "Receiving", href: "/purchases/receiving", module: MODULES.PROCUREMENT, roles: R.NGO },
        ],
      },
      { id: "resource-requests", label: "Resource Requests", href: "/resource-requests", icon: "ListCheck", module: MODULES.RESOURCE_REQUESTS, roles: R.NGO_WORKER, workerDefault: true, excludeDesignations: [DESIGNATIONS.DATA_ENTRY_OFFICER] },
      { id: "distribution", label: "Distribution", href: "/distribution", icon: "Trolley", module: MODULES.DISTRIBUTION, roles: R.NGO_WORKER, permissions: [PERMISSIONS.DISTRIBUTION_VIEW], designations: [DESIGNATIONS.STORE_LOGISTICS_OFFICER] },
    ],
  },
  {
    id: "records",
    label: "Records",
    roles: R.NGO_WORKER,
    items: [
      { id: "documents", label: "Documents", href: "/documents", icon: "Folders", module: MODULES.DOCUMENTS, roles: R.NGO_WORKER, permissions: [PERMISSIONS.DOCUMENTS_VIEW], workerDefault: true, excludeDesignations: [DESIGNATIONS.DATA_ENTRY_OFFICER] },
      { id: "data-entry", label: "Data Entry", href: "/data-entry", icon: "PersonPencil", module: MODULES.DATA_ENTRY, roles: R.WORKER, designations: [DESIGNATIONS.DATA_ENTRY_OFFICER], permissions: [PERMISSIONS.DATA_ENTRY_VIEW] },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    roles: R.NGO,
    items: [
      {
        id: "reports-group",
        label: "Reports",
        icon: "ChartColumn",
        module: MODULES.REPORTS,
        roles: R.NGO,
        children: [
          { id: "reports-ops", label: "Operations", href: "/reports/operations", module: MODULES.REPORTS, roles: R.NGO },
          { id: "reports-workers", label: "Workers", href: "/reports/workers", module: MODULES.REPORTS, roles: R.NGO },
          { id: "reports-attendance", label: "Attendance", href: "/reports/attendance", module: MODULES.REPORTS, roles: R.NGO },
          { id: "reports-inventory", label: "Inventory", href: "/reports/inventory", module: MODULES.REPORTS, roles: R.NGO },
          { id: "reports-procurement", label: "Procurement", href: "/reports/procurement", module: MODULES.REPORTS, roles: R.NGO },
          { id: "reports-distribution", label: "Distribution", href: "/reports/distribution", module: MODULES.REPORTS, roles: R.NGO },
        ],
      },
      { id: "monitoring", label: "Monitoring", href: "/monitoring", icon: "Pulse", module: MODULES.MONITORING, roles: R.NGO },
    ],
  },
  {
    id: "access",
    label: "Access",
    roles: R.NGO,
    items: [
      { id: "permissions", label: "Permissions / Designations", href: "/permissions", icon: "Key", roles: R.NGO },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { id: "notifications", label: "Notifications", href: "/notifications", icon: "Bell", roles: [ROLES.PLATFORM_ADMIN, ROLES.WORKER] },
      { id: "profile", label: "Profile", href: "/profile", icon: "Person", roles: [ROLES.PLATFORM_ADMIN, ROLES.NGO_ADMIN] },
      { id: "my-profile", label: "My Profile", href: "/profile", icon: "Person", roles: R.WORKER },
    ],
  },
];

function canSeeItem(item, user) {
  if (item.roles?.length && !item.roles.includes(user.role)) return false;
  if (item.module && !(user.enabledModules ?? []).includes(item.module)) return false;
  if (item.feature === "sharePoint" && !user.sharePointEnabled) return false;
  if (item.feature === "mfa" && !user.mfaEnabled) return false;
  if (item.excludeDesignations?.includes(user.designation)) return false;

  if (user.role === ROLES.PLATFORM_ADMIN) {
    return !item.roles || item.roles.includes(ROLES.PLATFORM_ADMIN);
  }

  if (user.role === ROLES.NGO_ADMIN) {
    return !item.roles || item.roles.includes(ROLES.NGO_ADMIN);
  }

  if (item.permissions?.length) {
    return item.permissions.some((permission) => (user.permissions ?? []).includes(permission));
  }
  if (item.workerDefault) return true;
  if (item.designations?.includes(user.designation)) return true;
  return !item.designations?.length;
}

function filterItems(items, user) {
  return items
    .map((item) => {
      if (item.children) {
        const children = filterItems(item.children, user);
        if (!children.length) return null;
        return { ...item, children };
      }
      return canSeeItem(item, user) ? item : null;
    })
    .filter(Boolean);
}

export function homePath(user) {
  if (user?.role === ROLES.WORKER) {
    return user.designation === DESIGNATIONS.DATA_ENTRY_OFFICER ? "/data-entry" : "/attendance/me";
  }
  return "/dashboard";
}

export function getVisibleNavigation(user) {
  return NAVIGATION.map((section) => {
    if (section.roles?.length && !section.roles.includes(user.role)) return null;
    const items = filterItems(section.items, user);
    if (!items.length) return null;
    return { ...section, items };
  }).filter(Boolean);
}

export function findActiveHref(pathname, sections) {
  const hrefs = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href) hrefs.push(item.href);
      for (const child of item.children ?? []) {
        if (child.href) hrefs.push(child.href);
      }
    }
  }
  return hrefs
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export const PAGE_META = {
  "/dashboard": { title: "Dashboard", eyebrow: "Overview", description: "Role-aware snapshot of platform or NGO operations." },
  "/platform/ngos": { title: "NGOs", eyebrow: "Organization", description: "Create NGOs here, then assign an NGO Admin for each organization." },
  "/platform/ngos/new": { title: "Create NGO", eyebrow: "Organization", description: "Register an NGO, enable modules, and create its first NGO Admin." },
  "/platform/modules": { title: "Module Management", eyebrow: "Organization", description: "Enable or disable operational modules per NGO." },
  "/platform/users": { title: "Platform Users", eyebrow: "Administration", description: "Platform administrators only. NGO Admins and workers are managed in their own sections." },
  "/platform/settings": { title: "Platform Settings", eyebrow: "Administration", description: "Global platform configuration and branding." },
  "/platform/security": { title: "Security / MFA", eyebrow: "Administration", description: "Authentication policies and multi-factor settings." },
  "/platform/reports": { title: "Platform Reports", eyebrow: "Insights", description: "Cross-NGO operational and adoption reports." },
  "/platform/monitoring": { title: "Monitoring", eyebrow: "Insights", description: "Platform health, usage, and NGO activity." },
  "/platform/audit-logs": { title: "Audit Logs", eyebrow: "Insights", description: "Security and configuration change history." },
  "/notifications": { title: "Notifications", eyebrow: "Account", description: "Alerts, assignments, and system notices." },
  "/profile": { title: "Profile", eyebrow: "Account", description: "Personal account details and preferences." },
  "/ngo/settings": { title: "NGO Settings", eyebrow: "Organization", description: "Organization profile for this NGO." },
  "/ngo/sharepoint": { title: "SharePoint", eyebrow: "Organization", description: "SharePoint libraries and files enabled for this NGO." },
  "/projects": { title: "Projects", eyebrow: "Operations", description: "NGO programs and field projects." },
  "/sites": { title: "Sites", eyebrow: "Operations", description: "Field sites and warehouses linked to projects." },
  "/workers": { title: "Workers / Employees", eyebrow: "Operations", description: "NGO Admins create workers here and assign designations, permissions, and sites." },
  "/workers/new": { title: "Add Worker", eyebrow: "Operations", description: "Create a worker account for this NGO only." },
  "/attendance": { title: "Attendance", eyebrow: "Operations", description: "Team attendance records and exceptions." },
  "/attendance/me": { title: "My Attendance", eyebrow: "My Work", description: "Your attendance calendar, leave details, and salary impact." },
  "/leave": { title: "Leave Management", eyebrow: "Operations", description: "Leave requests, balances, and approvals." },
  "/issued": { title: "Issued Resources", eyebrow: "My Work", description: "Items issued to you and their issue history." },
  "/my-assignments": { title: "My Projects / Sites", eyebrow: "My Work", description: "Projects and sites assigned to you." },
  "/activities": { title: "Assigned Activities", eyebrow: "My Work", description: "Field and project activities assigned to you." },
  "/inventory": { title: "Inventory Overview", eyebrow: "Inventory", description: "Stock levels, low stock, receipts, and issues for this NGO." },
  "/inventory/items": { title: "Inventory Items", eyebrow: "Inventory", description: "Catalog of items, SKUs, and on-hand quantities." },
  "/inventory/categories": { title: "Inventory Categories", eyebrow: "Inventory", description: "Item categories used for this NGO only." },
  "/inventory/transactions": { title: "Stock Transactions", eyebrow: "Inventory", description: "Receipts, issues, and movement history." },
  "/inventory/transfers": { title: "Stock Transfers", eyebrow: "Inventory", description: "Transfers between warehouses and sites." },
  "/inventory/adjustments": { title: "Adjustments", eyebrow: "Inventory", description: "Quantity corrections and write-offs." },
  "/suppliers": { title: "Suppliers", eyebrow: "Procurement", description: "Vendor directory and contact records." },
  "/suppliers/new": { title: "New Supplier", eyebrow: "Procurement", description: "Add a vendor for this NGO." },
  "/purchases/orders": { title: "Purchase Orders", eyebrow: "Procurement", description: "Open and received purchase orders." },
  "/purchases/orders/new": { title: "New Purchase Order", eyebrow: "Procurement", description: "Create a purchase order with line items." },
  "/purchases": { title: "Purchases", eyebrow: "Procurement", description: "Posted purchases and spend history." },
  "/purchases/receiving": { title: "Receiving", eyebrow: "Procurement", description: "Inbound goods receipts against orders." },
  "/resource-requests": { title: "Resource Requests", eyebrow: "Supply Chain", description: "Field requests for stock and materials." },
  "/distribution": { title: "Distribution", eyebrow: "Supply Chain", description: "Resource issue and last-mile distribution." },
  "/documents": { title: "Documents", eyebrow: "Records", description: "Policies, SOPs, and operational files." },
  "/data-entry": { title: "Data Entry", eyebrow: "Records", description: "Assigned data-entry forms and queues." },
  "/reports/operations": { title: "Operations Report", eyebrow: "Reports", description: "Program and site performance." },
  "/reports/workers": { title: "Workers Report", eyebrow: "Reports", description: "Workforce composition and assignments." },
  "/reports/attendance": { title: "Attendance Report", eyebrow: "Reports", description: "Attendance trends and exceptions." },
  "/reports/inventory": { title: "Inventory Report", eyebrow: "Reports", description: "Stock levels, movement, and valuation." },
  "/reports/procurement": { title: "Procurement Report", eyebrow: "Reports", description: "Orders, suppliers, and receiving." },
  "/reports/distribution": { title: "Distribution Report", eyebrow: "Reports", description: "Issued goods and coverage." },
  "/monitoring": { title: "Monitoring", eyebrow: "Insights", description: "NGO activity monitoring and follow-up." },
  "/permissions": { title: "Permissions / Designations", eyebrow: "Access", description: "Worker designations and module permissions." },
};
