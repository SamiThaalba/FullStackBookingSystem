import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";

// ── Pure helpers ──────────────────────────────────────────────────────────────

function checkedToIds(checked, allPermissions = []) {
  const ids = [];
  for (const p of allPermissions) {
    const key = p.name ?? p;
    if (checked[key] && p.id != null) ids.push(p.id);
  }
  return ids;
}

function buildChecked(allPermissions = [], activeNames = []) {
  const activeSet = new Set(activeNames);
  const state = {};
  for (const p of allPermissions) {
    const key = p.name ?? p;
    state[key] = activeSet.has(key);
  }
  return state;
}

function groupPermissions(allPermissions = []) {
  const map = {};
  for (const p of allPermissions) {
    const name = p.name ?? p;
    const colonIdx = name.indexOf(":");
    const group  = colonIdx !== -1 ? name.slice(0, colonIdx)  : "other";
    const action = colonIdx !== -1 ? name.slice(colonIdx + 1) : name;
    if (!map[group]) map[group] = [];
    map[group].push({ action, key: name });
  }
  // Put "other" last
  const entries = Object.entries(map);
  entries.sort(([a], [b]) => (a === "other" ? 1 : b === "other" ? -1 : a.localeCompare(b)));
  return entries.map(([group, items]) => ({ group, items }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminRoles() {
  const queryClient = useQueryClient();

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleChecked, setRoleChecked] = useState({});

  const [permissionForm, setPermissionForm] = useState({ name: "", description: "" });

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [editChecked, setEditChecked] = useState({});

  const [assignForm, setAssignForm] = useState({ userId: "", roleId: "" });

  // ── Queries
  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: bookingApi.adminRoles,
  });
  const permissionsQuery = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: bookingApi.adminPermissions,
  });

  const roles       = rolesQuery.data       || [];
  const permissions = permissionsQuery.data || [];

  const permissionGroups = useMemo(() => groupPermissions(permissions), [permissions]);

  useMemo(() => {
    if (permissions.length && Object.keys(roleChecked).length === 0) {
      setRoleChecked(buildChecked(permissions, []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const handleSelectRole = (roleId) => {
    setSelectedRoleId(roleId);
    const role = roles.find((r) => String(r.id) === String(roleId));
    setEditChecked(buildChecked(permissions, role?.permissions || []));
  };

  // ── Mutations
  const createRoleMutation = useMutation({
    mutationFn: bookingApi.adminCreateRole,
    onSuccess: () => {
      setRoleName("");
      setRoleDescription("");
      setRoleChecked(buildChecked(permissions, []));
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
    mutationFn: ({ roleId, permissionIds }) =>
      bookingApi.adminReplaceRolePermissions(roleId, { permissionIds }),
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

  // ── Checkbox helpers
  const toggle = (setter, key) =>
    setter((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleGroup = (setter, items, value) =>
    setter((prev) => {
      const next = { ...prev };
      items.forEach(({ key }) => { next[key] = value; });
      return next;
    });

  const isGroupAll  = (checked, items) => items.every(({ key }) =>  checked[key]);
  const isGroupNone = (checked, items) => items.every(({ key }) => !checked[key]);

  // ── PermissionPicker
  const PermissionPicker = ({ checked, setChecked }) => {
    if (permissionsQuery.isLoading) return <p className="muted">Loading permissions…</p>;
    if (!permissionGroups.length)   return <p className="muted">No permissions in the database yet.</p>;

    return (
      <div className="perm-picker">
        {permissionGroups.map(({ group, items }) => {
          const allOn  = isGroupAll(checked, items);
          const allOff = isGroupNone(checked, items);
          const isOther = group === "other";

          return (
            <div key={group} className={`perm-group ${isOther ? "perm-group--other" : ""}`}>
              {/* Group header row */}
              <div className="perm-group-header">
                <label className="perm-group-toggle">
                  <input
                    type="checkbox"
                    className="perm-master-cb"
                    checked={allOn}
                    ref={(el) => { if (el) el.indeterminate = !allOn && !allOff; }}
                    onChange={(e) => toggleGroup(setChecked, items, e.target.checked)}
                  />
                  <span className="perm-group-name">{group}</span>
                </label>
                {!isOther && (
                  <span className="perm-group-count">
                    {items.filter(({ key }) => checked[key]).length}/{items.length}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className={`perm-actions ${isOther ? "perm-actions--grid" : ""}`}>
                {items.map(({ action, key }) => (
                  <label
                    key={key}
                    className={`perm-chip ${checked[key] ? "perm-chip--on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[key]}
                      onChange={() => toggle(setChecked, key)}
                    />
                    <span>{action}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render
  return (
    <section className="container dashboard-page">
      <style>{styles}</style>

      <div className="section-heading">
        <p className="eyebrow">Administration</p>
        <h1>Roles &amp; permissions</h1>
        <p>Create roles/permissions and apply roles to users.</p>
      </div>

      <Alert type="error">{errorMessage}</Alert>

      {/* ── Row 1: Create role + Create permission ── */}
      <div className="dashboard-grid">
        <form
          className="panel stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            createRoleMutation.mutate({
              name: roleName,
              description: roleDescription,
              permissionIds: checkedToIds(roleChecked, permissions),
            });
          }}
        >
          <h2>Create role</h2>
          <label>
            Name
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} required />
          </label>
          <label>
            Description
            <input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
          </label>
          <p className="perm-section-label">Permissions</p>
          <PermissionPicker checked={roleChecked} setChecked={setRoleChecked} />
          <button className="btn btn-teal" disabled={createRoleMutation.isPending}>
            {createRoleMutation.isPending ? "Creating…" : "Create role"}
          </button>
          {createRoleMutation.isSuccess && <p className="success-msg">✓ Role created.</p>}
        </form>

        <form
          className="panel stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            createPermissionMutation.mutate(permissionForm);
          }}
        >
          <h2>Create permission</h2>
          {permissions.length > 0 && (
            <>
              <p className="muted">Existing ({permissions.length}):</p>
              <div className="amenity-row">
                {permissions.map((p) => (
                  <span key={p.id ?? p.name ?? p}>{p.name ?? p}</span>
                ))}
              </div>
            </>
          )}
          <label>
            Name
            <input
              value={permissionForm.name}
              onChange={(e) => setPermissionForm((c) => ({ ...c, name: e.target.value }))}
              placeholder="booking:create"
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
            {createPermissionMutation.isPending ? "Creating…" : "Create permission"}
          </button>
          {createPermissionMutation.isSuccess && <p className="success-msg">✓ Permission created.</p>}
        </form>
      </div>

      {/* ── Row 2: Roles list + Edit permissions ── */}
      <div className="dashboard-grid">
        <div className="panel">
          <h2>Roles</h2>
          {rolesQuery.isLoading ? (
            <p className="muted">Loading roles…</p>
          ) : roles.length ? (
            <div className="manager-list">
              {roles.map((role) => (
                <article key={role.id} className="manager-row">
                  <div>
                    <strong>{role.name} <span className="role-id">#{role.id}</span></strong>
                    <span>{role.description || "—"}</span>
                  </div>
                  <button
                    className="btn btn-small btn-outline"
                    onClick={() => handleSelectRole(String(role.id))}
                  >
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
          onSubmit={(e) => {
            e.preventDefault();
            replaceRolePermissionsMutation.mutate({
              roleId: Number(selectedRoleId),
              permissionIds: checkedToIds(editChecked, permissions),
            });
          }}
        >
          <h2>Edit role permissions</h2>
          <label>
            Role
            <select value={selectedRoleId} onChange={(e) => handleSelectRole(e.target.value)} required>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name} (#{role.id})</option>
              ))}
            </select>
          </label>
          {selectedRoleId ? (
            <PermissionPicker checked={editChecked} setChecked={setEditChecked} />
          ) : (
            <p className="muted">Select a role above to edit its permissions.</p>
          )}
          <button
            className="btn btn-teal"
            disabled={replaceRolePermissionsMutation.isPending || !selectedRoleId}
          >
            {replaceRolePermissionsMutation.isPending ? "Saving…" : "Save permissions"}
          </button>
          {replaceRolePermissionsMutation.isSuccess && <p className="success-msg">✓ Permissions updated.</p>}
        </form>
      </div>

      {/* ── Row 3: Assign / Remove role — merged panel ── */}
      <div className="panel user-role-panel">
        <h2>User role management</h2>
        <p className="muted">Select a user ID and a role, then assign or remove it.</p>

        <div className="user-role-fields">
          <label>
            User ID
            <input
              value={assignForm.userId}
              onChange={(e) => setAssignForm((c) => ({ ...c, userId: e.target.value }))}
              inputMode="numeric"
              placeholder="e.g. 42"
            />
          </label>
          <label>
            Role
            <select
              value={assignForm.roleId}
              onChange={(e) => setAssignForm((c) => ({ ...c, roleId: e.target.value }))}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name} (#{role.id})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="user-role-actions">
          <button
            type="button"
            className="btn btn-teal"
            disabled={assignRoleMutation.isPending || !assignForm.userId || !assignForm.roleId}
            onClick={() =>
              assignRoleMutation.mutate({
                userId: Number(assignForm.userId),
                roleId: Number(assignForm.roleId),
              })
            }
          >
            {assignRoleMutation.isPending ? "Assigning…" : "✓ Assign role"}
          </button>

          <button
            type="button"
            className="btn btn-danger"
            disabled={removeRoleMutation.isPending || !assignForm.userId || !assignForm.roleId}
            onClick={() =>
              removeRoleMutation.mutate({
                userId: Number(assignForm.userId),
                roleId: Number(assignForm.roleId),
              })
            }
          >
            {removeRoleMutation.isPending ? "Removing…" : "✕ Remove role"}
          </button>
        </div>

        {assignRoleMutation.isSuccess && <p className="success-msg">✓ Role assigned to user.</p>}
        {removeRoleMutation.isSuccess  && <p className="danger-msg">Role removed from user.</p>}
      </div>
    </section>
  );
}

const styles = `
/* ── Permission picker container ── */
.perm-picker {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-surface, #fff);
}

.perm-section-label {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

/* ── Each group row ── */
.perm-group {
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  padding: 0.6rem 0.75rem;
}
.perm-group:last-child {
  border-bottom: none;
}

/* "Other" group gets a slightly tinted background */
.perm-group--other {
  background: var(--color-surface-subtle, #f8fafc);
}

/* ── Group header: name + count ── */
.perm-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}

.perm-group-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.perm-master-cb {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--color-teal, #0d9488);
}

.perm-group-name {
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary, #64748b);
}

.perm-group-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, #94a3b8);
  background: var(--color-surface-subtle, #f1f5f9);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 99px;
  padding: 0.1rem 0.5rem;
}

/* ── Action chips row ── */
.perm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

/* "Other" grid: 2-column layout for the long ungrouped list */
.perm-actions--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.35rem;
}

/* ── Individual chip ── */
.perm-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 500;
  padding: 0.22rem 0.6rem;
  border-radius: 5px;
  border: 1px solid var(--color-border, #e2e8f0);
  background: var(--color-surface-subtle, #f8fafc);
  color: var(--color-text, #334155);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.perm-chip input {
  width: 13px;
  height: 13px;
  accent-color: var(--color-teal, #0d9488);
  cursor: pointer;
}
.perm-chip--on {
  background: var(--color-teal-light, #e6f7f5);
  border-color: var(--color-teal, #0d9488);
  color: var(--color-teal, #0d9488);
  font-weight: 600;
}

/* ── User role panel ── */
.user-role-panel {
  margin-top: 1.5rem;
}
.user-role-panel h2 {
  margin-bottom: 0.25rem;
}
.user-role-fields {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
  margin: 1rem 0;
}
@media (max-width: 600px) {
  .user-role-fields { grid-template-columns: 1fr; }
}
.user-role-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* ── Danger button ── */
.btn-danger {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  padding: 0.45rem 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn-danger:hover:not(:disabled) {
  background: #fecaca;
  border-color: #f87171;
}
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Misc ── */
.role-id {
  font-weight: 400;
  font-size: 0.8em;
  color: var(--color-text-secondary, #94a3b8);
}
.success-msg {
  color: var(--color-teal, #0d9488);
  font-size: 0.875rem;
  font-weight: 500;
}
.danger-msg {
  color: #b91c1c;
  font-size: 0.875rem;
  font-weight: 500;
}
`;
