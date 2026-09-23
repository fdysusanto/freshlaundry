import { PartnerPermission } from '@/types/laundry';
import { UserRole } from '@/types/user';

const PLATFORM_ADMIN_PERMISSIONS: Set<PartnerPermission> = new Set([
  'PARTNER_VIEW',
  'PARTNER_CREATE',
  'PARTNER_UPDATE',
  'PARTNER_STATUS_UPDATE',
  'PARTNER_VERIFY',
  'PARTNER_SUSPEND',
  'PARTNER_INVITE_OWNER',
  'PARTNER_VIEW_USERS',
  'PARTNER_VIEW_BRANCHES',
  'PARTNER_VIEW_ORDERS',
  'PARTNER_VIEW_PERFORMANCE',
  'PARTNER_VIEW_AUDIT',
]);

const LAUNDRY_OWNER_PERMISSIONS: Set<PartnerPermission> = new Set([
  'PARTNER_VIEW',
  'PARTNER_UPDATE',
  'PARTNER_VIEW_USERS',
  'PARTNER_VIEW_BRANCHES',
  'PARTNER_VIEW_ORDERS',
  'PARTNER_VIEW_PERFORMANCE',
]);

const LAUNDRY_STAFF_PERMISSIONS: Set<PartnerPermission> = new Set([
  'PARTNER_VIEW',
  'PARTNER_VIEW_ORDERS',
]);

export const partnerPermissionService = {
  /**
   * Check if a given user role has permission to perform a partner management action.
   */
  hasPermission(role?: UserRole | string | null, permission?: PartnerPermission): boolean {
    if (!role || !permission) return false;

    const normalizedRole = role.toLowerCase().trim();

    if (normalizedRole === 'platform_admin' || normalizedRole === 'admin') {
      return PLATFORM_ADMIN_PERMISSIONS.has(permission);
    }

    if (normalizedRole === 'laundry_owner' || normalizedRole === 'owner') {
      return LAUNDRY_OWNER_PERMISSIONS.has(permission);
    }

    if (normalizedRole === 'laundry_staff' || normalizedRole === 'staff') {
      return LAUNDRY_STAFF_PERMISSIONS.has(permission);
    }

    // Customer and Courier have no partner administration permissions
    return false;
  },

  /**
   * Evaluates if caller is authorized for Platform Ops Admin privileges.
   */
  isPlatformOpsAdmin(role?: UserRole | string | null): boolean {
    if (!role) return false;
    const normalizedRole = role.toLowerCase().trim();
    return normalizedRole === 'platform_admin' || normalizedRole === 'admin';
  },

  /**
   * Evaluates valid lifecycle status transitions.
   */
  isValidStatusTransition(
    currentStatus: string,
    targetStatus: string
  ): { valid: boolean; error?: string } {
    if (currentStatus === targetStatus) {
      return { valid: true };
    }

    const curr = currentStatus.toLowerCase();
    const target = targetStatus.toLowerCase();

    const allowedTransitions: Record<string, string[]> = {
      unclaimed: ['listed', 'order_ready', 'claimed'],
      listed: ['order_ready', 'unclaimed', 'claimed'],
      order_ready: ['supplier', 'active', 'suspended', 'inactive'],
      supplier: ['active', 'suspended', 'inactive'],
      claimed: ['onboarding', 'order_ready', 'supplier', 'active'],
      onboarding: ['order_ready', 'supplier', 'active', 'inactive'],
      active: ['suspended', 'inactive'],
      suspended: ['order_ready', 'supplier', 'active', 'inactive'],
      inactive: ['order_ready', 'supplier', 'active', 'onboarding'],
    };

    const allowed = allowedTransitions[curr];
    if (!allowed || !allowed.includes(target)) {
      return {
        valid: false,
        error: `Transisi status tidak valid dari '${currentStatus.toUpperCase()}' ke '${targetStatus.toUpperCase()}'.`,
      };
    }

    return { valid: true };
  },
};
