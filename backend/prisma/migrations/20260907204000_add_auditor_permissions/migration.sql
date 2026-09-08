INSERT INTO "Permission" ("id", "key", "createdAt")
VALUES
  ('auditors-read', 'auditors.read', CURRENT_TIMESTAMP),
  ('auditors-create', 'auditors.create', CURRENT_TIMESTAMP),
  ('auditors-update', 'auditors.update', CURRENT_TIMESTAMP),
  ('auditors-delete', 'auditors.delete', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role.id, permission.id
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role.name = 'ADMIN'
  AND permission.key IN ('auditors.read', 'auditors.create', 'auditors.update', 'auditors.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
