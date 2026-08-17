export interface CourierNotificationPayload {
  recipientCourierId: string;
  orderId: string;
  trackingNumber: string;
  assignmentType: 'pickup' | 'delivery';
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  estimatedMinutes?: number;
  expiresAt: string;
  title: string;
  body: string;
}

export interface InAppNotificationRecord extends CourierNotificationPayload {
  id: string;
  createdAt: string;
  isRead: boolean;
}

// In-memory mock notification store for client/dev mode
const mockNotifications: InAppNotificationRecord[] = [];

export const notificationService = {
  /**
   * Sends in-app dispatch offer notification to a candidate courier.
   */
  async notifyCourierAssignmentAsync(payload: CourierNotificationPayload): Promise<void> {
    const record: InAppNotificationRecord = {
      ...payload,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    mockNotifications.unshift(record);
    console.log(`[DISPATCH-NOTIF] Notification sent to courier '${payload.recipientCourierId}' for Order #${payload.trackingNumber}`);
  },

  /**
   * Retrieves active in-app notifications for a courier.
   */
  async getNotificationsForCourierAsync(courierId: string): Promise<InAppNotificationRecord[]> {
    return mockNotifications.filter((n) => n.recipientCourierId === courierId);
  },

  /**
   * Marks a notification as read.
   */
  async markAsReadAsync(notificationId: string): Promise<void> {
    const item = mockNotifications.find((n) => n.id === notificationId);
    if (item) item.isRead = true;
  },
};
