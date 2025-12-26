export type Role =
  | 'free'
  | 'premium'
  | 'creator'
  | 'partner'
  | 'admin'
  | 'superadmin'
  | 'moderator'
  | 'order_member'
  | 'lodge_officer'
  // legacy/compat
  | 'filmmaker';

export type PermKey =
  | 'view_free'
  | 'forum_read'
  | 'forum_post'
  | 'forum_reply'
  | 'forum_react'
  | 'submit_content'
  | 'access_partner_tools'
  | 'start_group_chat'
  | 'dm_attachments'
  | 'view_creator_partner_directory'
  | 'connection_request'
  | 'profile_edit'
  | 'watch_now_free'
  | 'watch_now_premium'
  // Admin/Superadmin permissions
  | 'admin_panel'
  | 'manage_users'
  | 'manage_roles'
  | 'moderate_content'
  | 'view_audit_logs'
  | 'manage_site_settings'
  | 'impersonate_users'
  // Order permissions
  | 'access_order'
  | 'manage_lodge'
  // Backlot permissions
  | 'create_project'
  | 'manage_all_projects';

type PermToRoles = Record<PermKey, Role[]>;

// All roles for convenience
const ALL_ROLES: Role[] = ['free', 'premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator', 'order_member', 'lodge_officer', 'filmmaker'];
const STAFF_ROLES: Role[] = ['admin', 'superadmin', 'moderator'];
const ADMIN_ROLES: Role[] = ['admin', 'superadmin'];

// Map each permission to the minimal roles that can perform it.
// We include legacy 'filmmaker' where it makes sense to maintain compatibility with existing RLS/UI.
export const PERMISSIONS: PermToRoles = {
  view_free: ALL_ROLES,
  forum_read: ALL_ROLES,

  // Premium or higher features
  forum_post: ['premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator', 'filmmaker', 'order_member', 'lodge_officer'],
  forum_reply: ['premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator', 'filmmaker', 'order_member', 'lodge_officer'],
  forum_react: ['premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator', 'filmmaker', 'order_member', 'lodge_officer'],

  // Creator/partner/admin only
  submit_content: ['creator', 'partner', 'admin', 'superadmin', 'filmmaker'],

  access_partner_tools: ['partner', 'admin', 'superadmin'],

  start_group_chat: ['premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator'],
  dm_attachments: ['premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator'],

  view_creator_partner_directory: ALL_ROLES,
  connection_request: ALL_ROLES,
  profile_edit: ALL_ROLES,

  watch_now_free: ALL_ROLES,
  watch_now_premium: ['premium', 'creator', 'partner', 'admin', 'superadmin', 'moderator'],

  // Admin/Superadmin permissions
  admin_panel: ADMIN_ROLES,
  manage_users: ADMIN_ROLES,
  manage_roles: ['superadmin'],  // Only superadmin can change roles
  moderate_content: STAFF_ROLES,
  view_audit_logs: ADMIN_ROLES,
  manage_site_settings: ['superadmin'],  // Only superadmin can change site settings
  impersonate_users: ['superadmin'],  // Only superadmin can impersonate

  // Order permissions
  access_order: ['order_member', 'lodge_officer', 'admin', 'superadmin', 'moderator'],
  manage_lodge: ['lodge_officer', 'admin', 'superadmin'],

  // Backlot permissions
  create_project: ALL_ROLES,
  manage_all_projects: ADMIN_ROLES,
};

// Utility: derive permissions from roles
export function listPermissionsForRoles(roles: string[] = []): Set<PermKey> {
  const rs = new Set<Role>(roles as Role[]);
  const out = new Set<PermKey>();
  (Object.keys(PERMISSIONS) as PermKey[]).forEach((perm) => {
    const allowed = PERMISSIONS[perm].some((r) => rs.has(r));
    if (allowed) out.add(perm);
  });
  return out;
}

export function requirePerm(roles: string[] = [], perm: PermKey): boolean {
  const rs = new Set<Role>(roles as Role[]);
  return PERMISSIONS[perm].some((r) => rs.has(r));
}