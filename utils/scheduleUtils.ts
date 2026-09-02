import { TIME_SLOTS } from '@/utils/constants';

/**
 * Resolves the Operational SLA Start Timestamp in WIB (+07:00) based on Pickup Date and Pickup Time Slot.
 * Business Rules:
 * - Pickup '08:00 - 10:00 WIB' -> SLA Start: Same day at 11:00 WIB
 * - Pickup '11:00 - 14:00 WIB' -> SLA Start: Same day at 15:00 WIB
 * - Pickup '15:00 - 17:00 WIB' -> SLA Start: Next day at 08:00 WIB
 */
export function resolveSlaStartDateTime(
  pickupDateStr: string,
  pickupTimeSlotStr: string
): { slaStartIso: string; slaStartMs: number; year: number; month: number; day: number; hour: number } {
  const dateMatch = pickupDateStr ? pickupDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  let targetYear = new Date().getFullYear();
  let targetMonth = new Date().getMonth() + 1;
  let targetDay = new Date().getDate();

  if (dateMatch) {
    targetYear = parseInt(dateMatch[1], 10);
    targetMonth = parseInt(dateMatch[2], 10);
    targetDay = parseInt(dateMatch[3], 10);
  }

  let pickupStartHour = 8;
  if (pickupTimeSlotStr) {
    const slotMatch = pickupTimeSlotStr.match(/(\d{1,2}):(\d{2})/);
    if (slotMatch) {
      pickupStartHour = parseInt(slotMatch[1], 10);
    }
  }

  let slaStartHour = 11;
  let dayOffset = 0;

  if (pickupStartHour < 11) {
    // Pickup 08:00 - 10:00 WIB -> SLA Start: 11:00 WIB same day
    slaStartHour = 11;
    dayOffset = 0;
  } else if (pickupStartHour < 15) {
    // Pickup 11:00 - 14:00 WIB -> SLA Start: 15:00 WIB same day
    slaStartHour = 15;
    dayOffset = 0;
  } else {
    // Pickup 15:00 - 17:00 WIB (or later) -> SLA Start: 08:00 WIB next day
    slaStartHour = 8;
    dayOffset = 1;
  }

  const pickupBaseIso = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}T00:00:00.000+07:00`;
  const pickupBaseMs = new Date(pickupBaseIso).getTime();

  const slaStartMs = pickupBaseMs + (dayOffset * 24 + slaStartHour) * 3600 * 1000;
  const wibMs = slaStartMs + 7 * 3600 * 1000;
  const wibDate = new Date(wibMs);

  const year = wibDate.getUTCFullYear();
  const month = wibDate.getUTCMonth() + 1;
  const day = wibDate.getUTCDate();
  const hour = wibDate.getUTCHours();

  const slaStartIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000+07:00`;

  return {
    slaStartIso,
    slaStartMs,
    year,
    month,
    day,
    hour,
  };
}

/**
 * Calculates the earliest permissible delivery Date & Time Slot based on
 * Pickup Date, Pickup Time Slot, and Service Estimated Processing Hours.
 * Uses Operational SLA Start Boundary and WIB (Asia/Jakarta, UTC+7).
 */
export function calculateEarliestDeliveryDateTime(
  pickupDateStr: string,
  pickupTimeSlotStr: string,
  estimatedProcessingHours: number = 48
): { earliestDate: string; earliestTimeSlot: string; earliestIso: string } {
  const hours = estimatedProcessingHours > 0 ? estimatedProcessingHours : 48;

  const slaStart = resolveSlaStartDateTime(pickupDateStr, pickupTimeSlotStr);
  const earliestDeliveryMs = slaStart.slaStartMs + hours * 3600 * 1000;

  // Convert earliestDeliveryMs to WIB (+07:00) calendar components
  const wibMs = earliestDeliveryMs + 7 * 3600 * 1000;
  const wibDate = new Date(wibMs);

  const eYear = wibDate.getUTCFullYear();
  const eMonth = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const eDay = String(wibDate.getUTCDate()).padStart(2, '0');
  const eHour = wibDate.getUTCHours();
  const eMinute = wibDate.getUTCMinutes();

  const effectiveHour = eMinute > 0 ? eHour + 0.001 : eHour;
  const earliestDateStr = `${eYear}-${eMonth}-${eDay}`;

  let matchedSlot = '';
  for (const slot of TIME_SLOTS) {
    const sMatch = slot.match(/(\d{1,2}):(\d{2})/);
    if (sMatch) {
      const sHour = parseInt(sMatch[1], 10);
      if (sHour >= effectiveHour) {
        matchedSlot = slot;
        break;
      }
    }
  }

  if (!matchedSlot) {
    // Rollover to next day H+1 first operational slot
    const nextDayMs = wibMs + 24 * 3600 * 1000;
    const nextDayDate = new Date(nextDayMs);
    const nYear = nextDayDate.getUTCFullYear();
    const nMonth = String(nextDayDate.getUTCMonth() + 1).padStart(2, '0');
    const nDay = String(nextDayDate.getUTCDate()).padStart(2, '0');

    return {
      earliestDate: `${nYear}-${nMonth}-${nDay}`,
      earliestTimeSlot: TIME_SLOTS[0],
      earliestIso: new Date(earliestDeliveryMs).toISOString(),
    };
  }

  return {
    earliestDate: earliestDateStr,
    earliestTimeSlot: matchedSlot,
    earliestIso: new Date(earliestDeliveryMs).toISOString(),
  };
}

/**
 * Returns available delivery time slots for a selected delivery date.
 * If deliveryDateStr > earliestDate, all TIME_SLOTS are available.
 * If deliveryDateStr === earliestDate, only slots starting at or after earliestTimeSlot start hour are available.
 * If deliveryDateStr < earliestDate, no slots are available.
 */
export function filterAvailableDeliverySlots(
  deliveryDateStr: string,
  earliestDateStr: string,
  earliestTimeSlotStr: string
): string[] {
  if (!deliveryDateStr || deliveryDateStr < earliestDateStr) {
    return [];
  }
  if (deliveryDateStr > earliestDateStr) {
    return TIME_SLOTS;
  }

  const eMatch = earliestTimeSlotStr ? earliestTimeSlotStr.match(/(\d{1,2}):(\d{2})/) : null;
  const eHour = eMatch ? parseInt(eMatch[1], 10) : 8;

  return TIME_SLOTS.filter((slot) => {
    const sMatch = slot.match(/(\d{1,2}):(\d{2})/);
    if (sMatch) {
      const sHour = parseInt(sMatch[1], 10);
      return sHour >= eHour;
    }
    return true;
  });
}

/**
 * Validates selected delivery date and time slot against minimum processing duration.
 */
export function validateDeliverySchedule(
  pickupDateStr: string,
  pickupTimeSlotStr: string,
  deliveryDateStr: string,
  deliveryTimeSlotStr: string,
  estimatedProcessingHours: number = 48
): { isValid: boolean; earliestDate: string; earliestTimeSlot: string; errorMessage?: string } {
  const earliest = calculateEarliestDeliveryDateTime(pickupDateStr, pickupTimeSlotStr, estimatedProcessingHours);

  if (deliveryTimeSlotStr && !TIME_SLOTS.includes(deliveryTimeSlotStr)) {
    return {
      isValid: false,
      earliestDate: earliest.earliestDate,
      earliestTimeSlot: earliest.earliestTimeSlot,
      errorMessage: `Slot waktu pengantaran '${deliveryTimeSlotStr}' tidak valid.`,
    };
  }

  if (!deliveryDateStr) {
    return {
      isValid: false,
      earliestDate: earliest.earliestDate,
      earliestTimeSlot: earliest.earliestTimeSlot,
      errorMessage: `Silakan pilih tanggal pengantaran. Layanan ini memerlukan estimasi proses ${estimatedProcessingHours} jam. Pengantaran paling cepat tersedia pada ${earliest.earliestDate} (${earliest.earliestTimeSlot}).`,
    };
  }

  if (deliveryDateStr < earliest.earliestDate) {
    return {
      isValid: false,
      earliestDate: earliest.earliestDate,
      earliestTimeSlot: earliest.earliestTimeSlot,
      errorMessage: `Jadwal pengantaran terlalu cepat. Layanan ini membutuhkan minimal ${estimatedProcessingHours} jam pengerjaan dari SLA start boundary. Pengantaran paling cepat tersedia pada ${earliest.earliestDate} (${earliest.earliestTimeSlot}).`,
    };
  }

  if (deliveryDateStr === earliest.earliestDate) {
    const dMatch = deliveryTimeSlotStr ? deliveryTimeSlotStr.match(/(\d{1,2}):(\d{2})/) : null;
    const eMatch = earliest.earliestTimeSlot.match(/(\d{1,2}):(\d{2})/);
    if (dMatch && eMatch) {
      const dHour = parseInt(dMatch[1], 10);
      const eHour = parseInt(eMatch[1], 10);
      if (dHour < eHour) {
        return {
          isValid: false,
          earliestDate: earliest.earliestDate,
          earliestTimeSlot: earliest.earliestTimeSlot,
          errorMessage: `Slot waktu pengantaran terlalu cepat untuk durasi proses ${estimatedProcessingHours} jam. Slot paling cepat pada tanggal ${earliest.earliestDate} adalah ${earliest.earliestTimeSlot}.`,
        };
      }
    }
  }

  return {
    isValid: true,
    earliestDate: earliest.earliestDate,
    earliestTimeSlot: earliest.earliestTimeSlot,
  };
}

/**
 * Resolves the effective order processing duration (in hours) for an order.
 * Priority 1: Immutable snapshot in order.items[].estimatedHours (MAX value across items).
 * Priority 2: Fallback lookup in live catalog (if servicesCatalog provided).
 * Priority 3: Safe default (48 hours).
 */
export function resolveOrderProcessingHours(
  order: { items?: { estimatedHours?: number; serviceId?: string }[] },
  catalogServices?: { id?: string; code?: string; estimatedHours?: number }[]
): number {
  if (order.items && order.items.length > 0) {
    const snapshotDurations = order.items
      .map((item) => item.estimatedHours)
      .filter((h): h is number => typeof h === 'number' && h > 0);

    if (snapshotDurations.length > 0) {
      return Math.max(...snapshotDurations);
    }

    if (catalogServices && catalogServices.length > 0) {
      const catalogDurations = order.items.map((item) => {
        const found = catalogServices.find((cs) => cs.id === item.serviceId || cs.code === item.serviceId);
        return found?.estimatedHours && found.estimatedHours > 0 ? found.estimatedHours : 48;
      });
      if (catalogDurations.length > 0) {
        return Math.max(...catalogDurations);
      }
    }
  }

  return 48;
}
