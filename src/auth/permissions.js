export const MANAGER_WORKSPACE_PERMISSIONS = [
  "hotel:create",
  "hotel:update",
  "hotel:delete",
  "hotel:view_all",
  "room:create",
  "room:update",
  "room:delete",
  "booking:update",
  "booking:cancel",
  "analytics:view",
];

export function hasAnyPermission(user, permissions = []) {
  const owned = new Set(user?.permissions || []);
  return permissions.some((permission) => owned.has(permission));
}
