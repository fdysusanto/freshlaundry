// =============================================================================
// FRESHWASH / FRESHLAUNDRY MARKETPLACE
// Utility: serviceCodeUtils.ts
// Purpose: Normalizes service codes to valid PostgreSQL service_type ENUM values:
//          'kiloan' | 'express' | 'dry_clean' | 'satuan'.
// =============================================================================

export type ServiceTypeCode = 'kiloan' | 'express' | 'dry_clean' | 'satuan';

export const VALID_SERVICE_TYPE_CODES = new Set<ServiceTypeCode>([
  'kiloan',
  'express',
  'dry_clean',
  'satuan',
]);

/**
 * Normalizes any input service code, unit, or name to a valid PostgreSQL service_type ENUM value.
 *
 * Business Rules:
 * 1. If requestedCode is a valid enum ('kiloan', 'express', 'dry_clean', 'satuan'), preserve it.
 * 2. Otherwise, check code/name string:
 *    - Matches 'express' -> 'express'
 *    - Matches 'dry_clean' -> 'dry_clean'
 * 3. Fallback based on unit:
 *    - unit === 'pcs' -> 'satuan'
 *    - unit === 'kg' (or default) -> 'kiloan'
 */
export function normalizeServiceType(
  requestedCode?: string | null,
  unit?: string | null,
  name?: string | null
): ServiceTypeCode {
  const cleanCode = (requestedCode || '').trim().toLowerCase() as ServiceTypeCode;

  // 1. Direct valid enum match
  if (VALID_SERVICE_TYPE_CODES.has(cleanCode)) {
    return cleanCode;
  }

  // 2. String heuristic check on code or name
  const combined = `${cleanCode} ${(name || '').toLowerCase()}`;
  if (combined.includes('express')) {
    return 'express';
  }
  if (combined.includes('dry_clean') || combined.includes('dry clean')) {
    return 'dry_clean';
  }

  // 3. Fallback by unit
  const cleanUnit = (unit || '').trim().toLowerCase();
  if (cleanUnit === 'pcs' || cleanUnit === 'satuan' || cleanUnit === 'item') {
    return 'satuan';
  }

  return 'kiloan';
}
