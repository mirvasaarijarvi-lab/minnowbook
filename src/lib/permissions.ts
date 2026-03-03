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
    category: "admin.catReservations",
    permissions: [
      { key: PERM_RESERVATIONS_VIEW, labelKey: "admin.permViewReservations" },
      { key: PERM_RESERVATIONS_CREATE, labelKey: "admin.permCreateReservations" },
      { key: PERM_RESERVATIONS_EDIT, labelKey: "admin.permEditReservations" },
      { key: PERM_RESERVATIONS_DELETE, labelKey: "admin.permDeleteReservations" },
    ],
  },
  {
    category: "admin.catResources",
    permissions: [
      { key: PERM_RESOURCES_VIEW, labelKey: "admin.permViewResources" },
      { key: PERM_RESOURCES_MANAGE, labelKey: "admin.permManageResources" },
    ],
  },
  {
    category: "admin.catCalendar",
    permissions: [
      { key: PERM_CALENDAR_VIEW, labelKey: "admin.permViewCalendar" },
    ],
  },
  {
    category: "admin.catReports",
    permissions: [
      { key: PERM_REPORTS_VIEW, labelKey: "admin.permViewReports" },
    ],
  },
  {
    category: "admin.catSettings",
    permissions: [
      { key: PERM_SETTINGS_VIEW, labelKey: "admin.permViewSettings" },
      { key: PERM_SETTINGS_MANAGE, labelKey: "admin.permManageSettings" },
    ],
  },
  {
    category: "admin.catAdmin",
    permissions: [
      { key: PERM_ADMIN_VIEW, labelKey: "admin.permViewAdmin" },
      { key: PERM_ADMIN_MANAGE, labelKey: "admin.permManageAdmin" },
    ],
  },
  {
    category: "admin.catSupport",
    permissions: [
      { key: PERM_SUPPORT_VIEW, labelKey: "admin.permViewSupport" },
      { key: PERM_SUPPORT_MANAGE, labelKey: "admin.permManageSupport" },
    ],
  },
] as const;
