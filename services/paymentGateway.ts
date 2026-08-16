import { PaymentStatus } from '@/types/payment';

export interface CreatePaymentGatewayRequest {
  orderId: string;
  amount: number;
  currency: 'IDR';
  paymentMethod: string;
  idempotencyKey: string;
}

export interface PaymentGatewayResponse {
  success: boolean;
  provider: string;
  providerReference: string;
  status: PaymentStatus;
  qrCodeUrl?: string;
  expiresAt: string;
  rawResponse?: any;
}

export interface PaymentGateway {
  createPaymentRequest(req: CreatePaymentGatewayRequest): Promise<PaymentGatewayResponse>;
  checkPaymentStatus(providerReference: string): Promise<PaymentStatus>;
  verifyPayment(providerReference: string): Promise<boolean>;
  refundPayment(providerReference: string, amount: number): Promise<boolean>;
}

export class MockPaymentGateway implements PaymentGateway {
  private mockStore: Map<
    string,
    { status: PaymentStatus; amount: number; orderId: string; expiresAt: string }
  > = new Map();

  async createPaymentRequest(req: CreatePaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    const providerReference = `MOCK-QRIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    this.mockStore.set(providerReference, {
      status: 'pending',
      amount: req.amount,
      orderId: req.orderId,
      expiresAt,
    });

    return {
      success: true,
      provider: 'mock_qris',
      providerReference,
      status: 'pending',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${providerReference}`,
      expiresAt,
      rawResponse: {
        mock_event: 'PAYMENT_CREATED',
        reference: providerReference,
        amount_idr: req.amount,
      },
    };
  }

  async checkPaymentStatus(providerReference: string): Promise<PaymentStatus> {
    const rec = this.mockStore.get(providerReference);
    return rec ? rec.status : 'unpaid';
  }

  async verifyPayment(providerReference: string): Promise<boolean> {
    const rec = this.mockStore.get(providerReference);
    if (!rec) return false;
    rec.status = 'paid';
    return true;
  }

  async refundPayment(providerReference: string, amount: number): Promise<boolean> {
    const rec = this.mockStore.get(providerReference);
    if (!rec || rec.status !== 'paid') return false;
    rec.status = 'refunded';
    return true;
  }
}

/**
 * Production Xendit Payment Gateway Adapter.
 * Communicates exclusively server-side with Xendit API.
 * Never logs or exposes XENDIT_SECRET_KEY.
 */
export class XenditPaymentGateway implements PaymentGateway {
  private baseUrl = 'https://api.xendit.co';

  private getHeaders(): HeadersInit {
    const secretKey = process.env.XENDIT_SECRET_KEY;
    if (!secretKey) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi.');
    }
    const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
    return {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'x-api-version': '2022-07-31',
    };
  }

  async createPaymentRequest(req: CreatePaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    const reference = req.idempotencyKey || `XND-${req.orderId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    try {
      const response = await fetch(`${this.baseUrl}/v2/invoices`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          external_id: reference,
          amount: Math.round(req.amount),
          currency: req.currency || 'IDR',
          description: `Pembayaran Laundry Pesanan #${req.orderId.substring(0, 8)}`,
          invoice_duration: 900,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Xendit API Error [${response.status}]: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const providerRef = data.id || data.external_id || reference;
      const qrUrl = data.invoice_url || data.qr_string || (data.actions ? data.actions.find((a: any) => a.url)?.url : undefined);

      return {
        success: true,
        provider: 'xendit',
        providerReference: providerRef,
        status: 'pending',
        qrCodeUrl: qrUrl,
        expiresAt: data.expiry_date || expiresAt,
        rawResponse: {
          id: data.id,
          external_id: data.external_id,
          status: data.status,
          merchant_name: data.merchant_name,
          amount: data.amount,
          invoice_url: data.invoice_url,
        },
      };
    } catch (err: any) {
      throw new Error(`Xendit Payment Creation Failed: ${err.message}`);
    }
  }

  async checkPaymentStatus(providerReference: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/invoices/${providerReference}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return 'unpaid';
      }

      const data = await response.json();
      const rawStatus = (data.status || '').toUpperCase();
      if (rawStatus === 'PAID' || rawStatus === 'SETTLED') return 'paid';
      if (rawStatus === 'EXPIRED') return 'expired';
      if (rawStatus === 'PENDING') return 'pending';
      return 'unpaid';
    } catch {
      return 'unpaid';
    }
  }

  async verifyPayment(providerReference: string): Promise<boolean> {
    const status = await this.checkPaymentStatus(providerReference);
    return status === 'paid';
  }

  async refundPayment(providerReference: string, amount: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/refunds`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          invoice_id: providerReference,
          amount: Math.round(amount),
          reason: 'REQUESTED_BY_CUSTOMER',
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Returns active Payment Gateway instance dynamically.
 * Uses XenditPaymentGateway when XENDIT_SECRET_KEY is configured,
 * otherwise falls back to MockPaymentGateway for development/testing.
 */
export function getPaymentGateway(): PaymentGateway {
  if (process.env.XENDIT_SECRET_KEY) {
    return new XenditPaymentGateway();
  }
  return new MockPaymentGateway();
}

export const defaultGateway: PaymentGateway = getPaymentGateway();
