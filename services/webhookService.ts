import { Order } from '@/types/order';

const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || '';

export async function triggerStatusChangeWebhook(order: Order, previousStatus?: string): Promise<boolean> {
  const payload = {
    event: 'ORDER_STATUS_CHANGED',
    timestamp: new Date().toISOString(),
    orderId: order.id,
    trackingNumber: order.trackingNumber,
    customer: {
      id: order.customerId,
      name: order.customerName,
      phone: order.customerPhone,
    },
    courier: order.courierName ? {
      id: order.courierId,
      name: order.courierName,
    } : null,
    service: order.serviceName,
    previousStatus: previousStatus || 'unknown',
    newStatus: order.status,
    totalPrice: order.totalPrice,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
  };

  console.log('[n8n Webhook Service] Order Event Payload:', payload);

  if (!N8N_WEBHOOK_URL) {
    console.log('[n8n Webhook Service] NEXT_PUBLIC_N8N_WEBHOOK_URL belum diset. Simulasi webhook berhasil.');
    return true;
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[n8n Webhook Service] Webhook berhasil terkirim ke n8n.');
      return true;
    } else {
      console.warn('[n8n Webhook Service] Gagal mengirim webhook ke n8n:', response.statusText);
      return false;
    }
  } catch (error) {
    console.error('[n8n Webhook Service] Error mengirim webhook:', error);
    return false;
  }
}
