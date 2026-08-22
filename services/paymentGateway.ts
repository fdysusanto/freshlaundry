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
  invoiceUrl?: string;
  paymentToken?: string;
  paymentUrl?: string;
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

    const mockInvoiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${providerReference}`;
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
      qrCodeUrl: mockInvoiceUrl,
      invoiceUrl: mockInvoiceUrl,
      expiresAt,
      rawResponse: {
        mock_event: 'PAYMENT_CREATED',
        reference: providerReference,
        amount_idr: req.amount,
        invoice_url: mockInvoiceUrl,
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
 * Generates a short, ASCII-safe, unique, and stable provider reference for Midtrans order_id.
 * Format: FL-{short_order_id}-{timestamp_suffix} (e.g. FL-1787124820731-482073 or FL-7d8e9f0a1b2c-482073).
 * Always <= 25 characters (well below Midtrans 50-character limit).
 */
export function generateShortProviderReference(orderId: string): string {
  const cleanId = (orderId || '').replace(/[^a-zA-Z0-9]/g, '');
  const shortId = cleanId.slice(-12) || 'ORDER';
  const ts = Date.now().toString().slice(-6);
  return `FL-${shortId}-${ts}`;
}

/**
 * Production Midtrans Payment Gateway Adapter.
 * Communicates server-side exclusively with Midtrans Snap & Core REST API.
 * Never logs or exposes MIDTRANS_SERVER_KEY.
 */
export class MidtransPaymentGateway implements PaymentGateway {
  private isProductionEnvironment(): boolean {
    const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
    if (serverKey.startsWith('SB-Mid-server-') || serverKey.startsWith('SB-')) {
      return false;
    }
    return process.env.MIDTRANS_IS_PRODUCTION === 'true';
  }

  public validateEnvironmentMatch(): void {
    const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
    const clientKey = (process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim();

    if (!serverKey) return;

    const isServerSandbox = serverKey.startsWith('SB-Mid-server-') || serverKey.startsWith('SB-');
    if (clientKey) {
      const isClientSandbox = clientKey.startsWith('SB-Mid-client-') || clientKey.startsWith('SB-');
      if (isServerSandbox !== isClientSandbox) {
        throw new Error('Midtrans environment mismatch between client and server credentials.');
      }
    }
  }

  private getSnapUrl(): string {
    this.validateEnvironmentMatch();
    const isProd = this.isProductionEnvironment();
    return isProd
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
  }

  private getCoreUrl(): string {
    this.validateEnvironmentMatch();
    const isProd = this.isProductionEnvironment();
    return isProd
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
  }

  private getHeaders(): HeadersInit {
    const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
    if (!serverKey) {
      throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi.');
    }
    const authHeader = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`;
    return {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async createPaymentRequest(req: CreatePaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
    if (!serverKey) {
      throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi.');
    }

    if (!req.amount || req.amount <= 0) {
      throw new Error('Validasi Nominal Midtrans Gagal: Jumlah pembayaran tidak valid.');
    }

    const providerReference = (req.idempotencyKey && req.idempotencyKey.length <= 48)
      ? req.idempotencyKey
      : generateShortProviderReference(req.orderId);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    try {
      const response = await fetch(this.getSnapUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          transaction_details: {
            order_id: providerReference,
            gross_amount: Math.round(req.amount),
          },
          credit_card: {
            secure: true,
          },
          callbacks: {
            finish: `${baseUrl}/orders/${req.orderId}?payment=finish`,
            error: `${baseUrl}/orders/${req.orderId}?payment=error`,
            pending: `${baseUrl}/orders/${req.orderId}?payment=pending`,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsgs = Array.isArray(errorData.error_messages)
          ? errorData.error_messages.join(', ')
          : errorData.message || response.statusText;
        throw new Error(`Midtrans API Error [${response.status}]: ${errMsgs}`);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('Midtrans API Error: Response tidak berisi token transaksi.');
      }

      return {
        success: true,
        provider: 'midtrans',
        providerReference,
        status: 'pending',
        paymentToken: data.token,
        paymentUrl: data.redirect_url,
        expiresAt,
        rawResponse: {
          token: data.token,
          redirect_url: data.redirect_url,
          order_id: providerReference,
          gross_amount: Math.round(req.amount),
        },
      };
    } catch (err: any) {
      // Safe error throw: Never expose MIDTRANS_SERVER_KEY or Authorization headers
      const safeMsg = err.message ? err.message.replace(serverKey, '[REDACTED]') : 'Unknown error';
      throw new Error(`Midtrans Payment Creation Failed: ${safeMsg}`);
    }
  }

  async checkPaymentStatus(providerReference: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(`${this.getCoreUrl()}/${providerReference}/status`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return 'unpaid';
      }

      const data = await response.json();
      const transactionStatus = (data.transaction_status || '').toLowerCase();
      const fraudStatus = (data.fraud_status || '').toLowerCase();

      if (transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept')) {
        return 'paid';
      }
      if (transactionStatus === 'pending') return 'pending';
      if (transactionStatus === 'deny' || transactionStatus === 'cancel') return 'failed';
      if (transactionStatus === 'expire') return 'expired';

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
      const response = await fetch(`${this.getCoreUrl()}/${providerReference}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          refund_key: `REF-${providerReference}-${Date.now()}`,
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successRedirectUrl = `${baseUrl}/orders/${req.orderId}?payment=success`;
    const failureRedirectUrl = `${baseUrl}/orders/${req.orderId}?payment=failed`;

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
          success_redirect_url: successRedirectUrl,
          failure_redirect_url: failureRedirectUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Xendit API Error [${response.status}]: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();

      console.log('[XENDIT-DIAGNOSTIC]', {
        id: data.id,
        status: data.status,
        external_id: data.external_id,
        invoice_url: data.invoice_url,
        hasInvoiceUrl: Boolean(data.invoice_url),
      });

      const providerRef = data.id || data.external_id || reference;
      const qrUrl = data.invoice_url || data.qr_string || (data.actions ? data.actions.find((a: any) => a.url)?.url : undefined);

      return {
        success: true,
        provider: 'xendit',
        providerReference: providerRef,
        status: 'pending',
        qrCodeUrl: qrUrl,
        invoiceUrl: data.invoice_url || qrUrl,
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
 * Priority:
 * 1. MidtransPaymentGateway when MIDTRANS_SERVER_KEY is configured.
 * 2. XenditPaymentGateway when XENDIT_SECRET_KEY is configured.
 * 3. MockPaymentGateway fallback for development/testing.
 */
export function getPaymentGateway(): PaymentGateway {
  if (process.env.MIDTRANS_SERVER_KEY) {
    return new MidtransPaymentGateway();
  }
  if (process.env.XENDIT_SECRET_KEY) {
    return new XenditPaymentGateway();
  }
  return new MockPaymentGateway();
}

export const defaultGateway: PaymentGateway = getPaymentGateway();

