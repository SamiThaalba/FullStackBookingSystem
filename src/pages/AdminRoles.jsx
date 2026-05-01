import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";

export default function AdminRoles() {
  const queryClient = useQueryClient();
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const [permissionForm, setPermissionForm] = useState({ name: "", description: "" });
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [permissionNames, setPermissionNames] = useState("");
  const [assignForm, setAssignForm] = useState({ userId: "", roleId: "" });

  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: bookingApi.adminRoles });
  const permissionsQuery = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: bookingApi.adminPermissions,
  });

  const roles = rolesQuery.data || [];
  const permissions = permissionsQuery.data || [];

  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === String(selectedRoleId)) || null,
    [roles, selectedRoleId],
  );

  const createRoleMutation = useMutation({
    mutationFn: bookingApi.adminCreateRole,
    onSuccess: () => {
      setRoleForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
  });

  const createPermissionMutation = useMutation({
    mutationFn: bookingApi.adminCreatePermission,
    onSuccess: () => {
      setPermissionForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
    },
  });

  const replaceRolePermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionNames }) =>
      bookingApi.adminReplaceRolePermissions(roleId, { permissionNames }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-roles"] }),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }) => bookingApi.adminAssignRoleToUser(userId, roleId),
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }) => bookingApi.adminRemoveRoleFromUser(userId, roleId),
  });

  const errorMessage =
    rolesQuery.error?.message ||
    permissionsQuery.error?.message ||
    createRoleMutation.error?.message ||
    createPermissionMutation.error?.message ||
    replaceRolePermissionsMutation.error?.message ||
    assignRoleMutation.error?.message ||
    removeRoleMutation.error?.message;

  return (
    <section className="container dashboard-page">
      <div className="section-heading">
        <p className="eyebrow">Administration</p>
        <h1>Roles & permissions</h1>
        <p>Create roles/permissions and apply roles to users.</p>
      </div>

      <Alert type="error">{errorMessage}</Alert>

      <div className="dashboard-grid">
        <form
          className="panel stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            createRoleMutation.mutate(roleForm);
          }}
        >
          <h2>Create role</h2>
          <label>
            Name
            <input
              value={roleForm.name}
              onChange={(e) => setRoleForm((c) => ({ ...c, name: e.target.value }))}
              required
            />
          </label>
          <label>
            Description
            <input
              value={roleForm.description}
              onChange={(e) => setRoleForm((c) => ({ ...c, description: e.target.value }))}
            />
          </label>
          <button className="btn btn-teal" disabled={createRoleMutation.isPending}>
            {createRoleMutation.isPending ? "Creating..." : "Create role"}
          </button>
        </form>

        <form
          className="panel stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            createPermissionMutation.mutate(permissionForm);
          }}
        >
          <h2>Create permission</h2>
          <label>
            Name
            <input
              value={permissionForm.name}
              onChange={(e) => setPermissionForm((c) => ({ ...c, name: e.target.value }))}
              required
            />
          </label>
          <label>
            Description
            <input
              value={permissionForm.description}
              onChange={(e) => setPermissionForm((c) => ({ ...c, description: e.target.value }))}
            />
          </label>
          <button className="btn btn-teal" disabled={createPermissionMutation.isPending}>
            {createPermissionMutation.isPending ? "Creating..." : "Create permission"}
          </button>
        </form>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <h2>Roles</h2>
          {rolesQuery.isLoading ? (
            <p className="muted">Loading roles...</p>
          ) : roles.length ? (
            <div className="manager-list">
              {roles.map((role) => (
                <article key={role.id} className="manager-row">
                  <div>
                    <strong>
                      {role.name} (#{role.id})
                    </strong>
                    <span>{role.description || "—"}</span>
                  </div>
                  <button className="btn btn-small btn-outline" onClick={() => setSelectedRoleId(String(role.id))}>
                    Edit permissions
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No roles found.</p>
          )}
        </div>

        <form
          className="panel stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            const names = permissionNames
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            replaceRolePermissionsMutation.mutate({ roleId: Number(selectedRoleId), permissionNames: names });
          }}
        >
          <h2>Role permissions</h2>
          <label>
            Role
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} required>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} (#{role.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Permission names (comma-separated)
            <input
              value={permissionNames}
              onChange={(e) => setPermissionNames(e.target.value)}
              placeholder="hotel:view, booking:create, role:manage"
            />
          </label>
          {selectedRole?.permissions?.length ? (
            <div className="amenity-row" aria-label="Current permissions">
              {selectedRole.permissions.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
          ) : (
            <p className="muted">Select a role to see its permissions.</p>
          )}
          <button className="btn btn-teal" disabled={replaceRolePermissionsMutation.isPending || !selectedRoleId}>
            {replaceRolePermissionsMutation.isPending ? "Saving..." : "Replace role permissions"}
          </button>
          <p className="muted">
            Tip: permissions must already exist. Existing permissions list: {permissions.length}.
          </p>
        </form>
      </div>

      <div className="dashboard-grid">
        <form
          className="panel stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            assignRoleMutation.mutate({ userId: Number(assignForm.userId), roleId: Number(assignForm.roleId) });
          }}
        >
          <h2>Assign role to user</h2>
          <label>
            User ID
            <input
              value={assignForm.userId}
              onChange={(e) => setAssignForm((c) => ({ ...c, userId: e.target.value }))}
              required
              inputMode="numeric"
            />
          </label>
          <label>
            Role
            <select
              value={assignForm.roleId}
              onChange={(e) => setAssignForm((c) => ({ ...c, roleId: e.target.value }))}
              required
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} (#{role.id})
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-teal" disabled={assignRoleMutation.isPending}>
            {assignRoleMutation.isPending ? "Assigning..." : "Assign role"}
          </button>
        </form>

        <form
          className="panel stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            removeRoleMutation.mutate({ userId: Number(assignForm.userId), roleId: Number(assignForm.roleId) });
          }}
        >
          <h2>Remove role from user</h2>
          <p className="muted">Uses the same User ID and Role above.</p>
          <button className="btn btn-outline" disabled={removeRoleMutation.isPending}>
            {removeRoleMutation.isPending ? "Removing..." : "Remove role"}
          </button>
        </form>
      </div>
    </section>
  );
}

