import { PermKey } from "@/lib/permissions";

type HasPermissionFn = (perm: PermKey) => boolean;

export function withUpgradeGate<Args extends unknown[], R>(
  hasPermission: HasPermissionFn,
  requiredPerm: PermKey,
  handler: (...args: Args) => Promise<R>
) {
  return async (...args: Args): Promise<R> => {
    if (!hasPermission(requiredPerm)) {
      const err = new Error("UPGRADE_REQUIRED");
      (err as any).code = "UPGRADE_REQUIRED";
      (err as any).requiredPerm = requiredPerm;
      throw err;
    }
    return handler(...args);
  };
}