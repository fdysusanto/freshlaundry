import { laundryService } from './laundryService';

export interface PricingInputItem {
  serviceId: string;
  quantity: number;
  unitPrice?: number; // Note: Client unitPrice is explicitly ignored for authoritative calculation!
}

export interface PricingCalculationInput {
  laundryId: string;
  items: PricingInputItem[];
  pickupAddress?: string;
  deliveryAddress?: string;
  discountCode?: string;
  clientSuppliedPrice?: number; // Note: Client total is explicitly ignored for authoritative calculation!
}

export interface PricingItemBreakdown {
  serviceId: string;
  serviceName: string;
  unitPrice: number;
  quantity: number;
  unit: 'kg' | 'pcs';
  subtotal: number;
  estimatedHours?: number;
}

export interface PricingCalculationResult {
  laundryId: string;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  totalPrice: number;
  items: PricingItemBreakdown[];
  appliedVoucher?: {
    code: string;
    discountAmount: number;
    description: string;
  };
}

/**
 * Validates and calculates the delivery fee abstraction.
 * Currently defaults to fixed IDR 0 (or distance/zone based rule).
 */
export function calculateDeliveryFee(input: PricingCalculationInput): number {
  // Delivery fee abstraction - default IDR 0 for MVP
  return 0;
}

/**
 * Validates and calculates the platform fee abstraction.
 * Currently defaults to fixed IDR 2,000 as defined in platform business configuration.
 */
export function calculatePlatformFee(input: PricingCalculationInput): number {
  return 2000;
}

/**
 * Validates discount code and returns authoritative discount amount in IDR.
 */
export function validateAndCalculateDiscount(
  input: PricingCalculationInput,
  subtotal: number
): { discountAmount: number; voucherInfo?: { code: string; discountAmount: number; description: string } } {
  if (!input.discountCode) {
    return { discountAmount: 0 };
  }

  const cleanCode = input.discountCode.trim().toUpperCase();

  if (cleanCode === 'FRESH5K') {
    const minSubtotal = 20000;
    if (subtotal < minSubtotal) {
      return { discountAmount: 0 };
    }
    return {
      discountAmount: 5000,
      voucherInfo: {
        code: 'FRESH5K',
        discountAmount: 5000,
        description: 'Potongan Rp 5.000 (Min. Transaksi Rp 20.000)',
      },
    };
  }

  if (cleanCode === 'FRESH100K') {
    return {
      discountAmount: 100000,
      voucherInfo: {
        code: 'FRESH100K',
        discountAmount: 100000,
        description: 'Voucher Promo Rp 100.000',
      },
    };
  }

  return { discountAmount: 0 };
}

export const pricingService = {
  /**
   * Real Supabase / Async Authoritative Pricing Calculation.
   * Fetches service prices directly from Supabase / master data and validates multi-tenant ownership.
   */
  async calculateOrderPricingAsync(input: PricingCalculationInput): Promise<PricingCalculationResult> {
    if (!input.laundryId) {
      throw new Error('Validasi Harga Gagal: laundryId wajib diisi.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('Validasi Harga Gagal: Order wajib memiliki minimal 1 item layanan.');
    }

    let subtotal = 0;
    const itemBreakdowns: PricingItemBreakdown[] = [];

    for (const item of input.items) {
      if (!item.serviceId) {
        throw new Error('Validasi Harga Gagal: serviceId wajib diisi untuk setiap item.');
      }
      const qty = Math.max(0.1, item.quantity || 1);

      // Fetch authoritative service from database/service layer
      const srv = await laundryService.getServiceByIdAsync(item.serviceId);

      if (!srv) {
        throw new Error(`Validasi Harga Gagal: Layanan dengan ID '${item.serviceId}' tidak ditemukan.`);
      }

      // Multi-Tenant Isolation Check: Service MUST belong to selected laundry!
      if (srv.laundryId !== input.laundryId) {
        throw new Error(
          `Validasi Multi-Tenant Gagal: Layanan '${srv.name}' (${item.serviceId}) terdaftar pada laundry '${srv.laundryId}', bukan pada laundry '${input.laundryId}' yang dipilih.`
        );
      }

      // Service Availability Check
      if (!srv.isActive) {
        throw new Error(`Validasi Harga Gagal: Layanan '${srv.name}' saat ini sedang tidak aktif.`);
      }

      // Authoritative Unit Price (Integer IDR)
      const authoritativeUnitPrice = Math.round(Number(srv.price));
      const itemSubtotal = Math.round(authoritativeUnitPrice * qty);
      subtotal += itemSubtotal;

      itemBreakdowns.push({
        serviceId: srv.id,
        serviceName: srv.name,
        unitPrice: authoritativeUnitPrice,
        quantity: qty,
        unit: srv.unit,
        subtotal: itemSubtotal,
        estimatedHours: srv.estimatedHours || 48,
      });
    }

    const deliveryFee = Math.round(calculateDeliveryFee(input));
    const platformFee = Math.round(calculatePlatformFee(input));
    const { discountAmount, voucherInfo } = validateAndCalculateDiscount(input, subtotal);
    const validDiscount = Math.round(discountAmount);

    // Ensure total price is never negative (Customer Total = max(0, subtotal + delivery + platform - discount))
    const totalPrice = Math.max(0, subtotal + deliveryFee + platformFee - validDiscount);

    return {
      laundryId: input.laundryId,
      subtotal,
      deliveryFee,
      platformFee,
      discount: validDiscount,
      totalPrice,
      items: itemBreakdowns,
      appliedVoucher: voucherInfo,
    };
  },

  /**
   * Synchronous / Local Authoritative Pricing Calculation.
   */
  calculateOrderPricing(input: PricingCalculationInput): PricingCalculationResult {
    if (!input.laundryId) {
      throw new Error('Validasi Harga Gagal: laundryId wajib diisi.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('Validasi Harga Gagal: Order wajib memiliki minimal 1 item layanan.');
    }

    let subtotal = 0;
    const itemBreakdowns: PricingItemBreakdown[] = [];

    for (const item of input.items) {
      if (!item.serviceId) {
        throw new Error('Validasi Harga Gagal: serviceId wajib diisi untuk setiap item.');
      }
      const qty = Math.max(0.1, item.quantity || 1);

      const srv = laundryService.getServiceById(item.serviceId);

      if (!srv) {
        throw new Error(`Validasi Harga Gagal: Layanan dengan ID '${item.serviceId}' tidak ditemukan.`);
      }

      // Multi-Tenant Isolation Check: Service MUST belong to selected laundry!
      if (srv.laundryId !== input.laundryId) {
        throw new Error(
          `Validasi Multi-Tenant Gagal: Layanan '${srv.name}' (${item.serviceId}) terdaftar pada laundry '${srv.laundryId}', bukan pada laundry '${input.laundryId}' yang dipilih.`
        );
      }

      if (!srv.isActive) {
        throw new Error(`Validasi Harga Gagal: Layanan '${srv.name}' saat ini sedang tidak aktif.`);
      }

      const authoritativeUnitPrice = Math.round(Number(srv.price));
      const itemSubtotal = Math.round(authoritativeUnitPrice * qty);
      subtotal += itemSubtotal;

      itemBreakdowns.push({
        serviceId: srv.id,
        serviceName: srv.name,
        unitPrice: authoritativeUnitPrice,
        quantity: qty,
        unit: srv.unit,
        subtotal: itemSubtotal,
        estimatedHours: typeof srv.estimatedHours === 'number' && srv.estimatedHours > 0 ? srv.estimatedHours : 48,
      });
    }

    const deliveryFee = Math.round(calculateDeliveryFee(input));
    const platformFee = Math.round(calculatePlatformFee(input));
    const { discountAmount, voucherInfo } = validateAndCalculateDiscount(input, subtotal);
    const validDiscount = Math.round(discountAmount);

    const totalPrice = Math.max(0, subtotal + deliveryFee + platformFee - validDiscount);

    return {
      laundryId: input.laundryId,
      subtotal,
      deliveryFee,
      platformFee,
      discount: validDiscount,
      totalPrice,
      items: itemBreakdowns,
      appliedVoucher: voucherInfo,
    };
  },
};
