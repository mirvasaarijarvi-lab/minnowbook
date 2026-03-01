/**
 * Permission keys used throughout the application.
 * These map to rows in the role_permissions table.
 *
 * Hierarchy: Owner (all) > Admin > Staff > custom roles
 * Owner bypasses all checks — permissions are only evaluated
 * for admin, staff, and custom roles.
 */

// Reservations
export const PERM_RESERVATIONS_VIEW = "reservations.view";
export const PERM_RESERVATIONS_CREATE = "reservations.create";
export const PERM_RESERVATIONS_EDIT = "reservations.edit";
export const PERM_RESERVATIONS_DELETE = "reservations.delete";

// Resources
export const PERM_RESOURCES_VIEW = "resources.view";
export const PERM_RESOURCES_MANAGE = "resources.manage";

// Reports
export const PERM_REPORTS_VIEW = "reports.view";

// Calendar
export const PERM_CALENDAR_VIEW = "calendar.view";

// Settings
export const PERM_SETTINGS_VIEW = "settings.view";
export const PERM_SETTINGS_MANAGE = "settings.manage";

// Admin
export const PERM_ADMIN_VIEW = "admin.view";
export const PERM_ADMIN_MANAGE = "admin.manage";

// Support
export const PERM_SUPPORT_VIEW = "support.view";
export const PERM_SUPPORT_MANAGE = "support.manage";

/** All available permissions grouped by category (for UI) */
export const PERMISSION_CATEGORIES = [
  {
    category: "Reservations",
    permissions: [
      { key: PERM_RESERVATIONS_VIEW, label: "View reservations" },
      { key: PERM_RESERVATIONS_CREATE, label: "Create reservations" },
      { key: PERM_RESERVATIONS_EDIT, label: "Edit reservations" },
      { key: PERM_RESERVATIONS_DELETE, label: "Delete reservations" },
    ],
  },
  {
    category: "Resources",
    permissions: [
      { key: PERM_RESOURCES_VIEW, label: "View resources" },
      { key: PERM_RESOURCES_MANAGE, label: "Manage resources" },
    ],
  },
  {
    category: "Calendar",
    permissions: [
      { key: PERM_CALENDAR_VIEW, label: "View calendar" },
    ],
  },
  {
    category: "Reports",
    permissions: [
      { key: PERM_REPORTS_VIEW, label: "View reports" },
    ],
  },
  {
    category: "Settings",
    permissions: [
      { key: PERM_SETTINGS_VIEW, label: "View settings" },
      { key: PERM_SETTINGS_MANAGE, label: "Manage settings" },
    ],
  },
  {
    category: "Admin",
    permissions: [
      { key: PERM_ADMIN_VIEW, label: "View admin panel" },
      { key: PERM_ADMIN_MANAGE, label: "Manage users & roles" },
    ],
  },
  {
    category: "Support",
    permissions: [
      { key: PERM_SUPPORT_VIEW, label: "View support requests" },
      { key: PERM_SUPPORT_MANAGE, label: "Respond to support requests" },
    ],
  },
] as const;
