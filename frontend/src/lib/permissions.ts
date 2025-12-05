export type Role =
  | 'free'
  | 'premium'
  | 'creator'
  | 'partner'
  | 'admin'
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
  | 'watch_now_premium';

type PermToRoles = Record<PermKey, Role[]>;

// Map each permission to the minimal roles that can perform it.
// We include legacy 'filmmaker' where it makes sense to maintain compatibility with existing RLS/UI.
export const PERMISSIONS: PermToRoles = {
  view_free: ['free', 'premium', 'creator', 'partner', 'admin', 'filmmaker'],
  forum_read: ['free', 'premium', 'creator', 'partner', 'admin', 'filmmaker'],

  // Premium or higher features
  forum_post: ['premium', 'creator', 'partner', 'admin', 'filmmaker'],
  forum_reply: ['premium', 'creator', 'partner', 'admin', 'filmmaker'],
  forum_react: ['premium', 'creator', 'partner', 'admin', 'filmmaker'],

  // Creator/partner/admin only
  submit_content: ['creator', 'partner', 'admin', 'filmmaker'],

  access_partner_tools: ['partner', 'admin'],

  start_group_chat: ['premium', 'creator', 'partner', 'admin'],
  dm_attachments: ['premium', 'creator', 'partner', 'admin'],

  view_creator_partner_directory: ['free', 'premium', 'creator', 'partner', 'admin', 'filmmaker'],
  connection_request: ['free', 'premium', 'creator', 'partner', 'admin', 'filmmaker'],
  profile_edit: ['free', 'premium', 'creator', 'partner', 'admin', 'filmmaker'],

  watch_now_free: ['free', 'premium', 'creator', 'partner', 'admin', 'filmmaker'],
  watch_now_premium: ['premium', 'creator', 'partner', 'admin'],
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