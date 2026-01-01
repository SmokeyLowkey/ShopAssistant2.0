/**
 * Activity Log Helpers
 *
 * Utility functions for creating standardized activity log entries
 * for order updates and notifications.
 */

import { prisma } from '@/lib/prisma';

export type OrderUpdateType = 'tracking' | 'delivery' | 'status' | 'other';

export interface CreateOrderUpdateNotificationParams {
  orderId: string;
  orderNumber: string;
  organizationId: string;
  userId: string;
  updateType: OrderUpdateType;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Creates an activity log entry for order updates
 *
 * @param params - Notification parameters
 * @returns Created activity log entry
 *
 * @example
 * ```ts
 * await createOrderUpdateNotification({
 *   orderId: 'order-123',
 *   orderNumber: 'ORD-2024-001',
 *   organizationId: 'org-123',
 *   userId: 'user-123',
 *   updateType: 'tracking',
 *   message: 'Tracking number added: 1Z999AA10123456784',
 *   metadata: {
 *     trackingNumber: '1Z999AA10123456784',
 *     carrier: 'UPS'
 *   }
 * });
 * ```
 */
export async function createOrderUpdateNotification(
  params: CreateOrderUpdateNotificationParams
) {
  const {
    orderId,
    orderNumber,
    organizationId,
    userId,
    updateType,
    message,
    metadata = {},
  } = params;

  // Determine activity log type based on update type
  let activityType = 'SYSTEM_UPDATE';
  let title = 'Order Updated';

  switch (updateType) {
    case 'tracking':
      activityType = 'TRACKING_UPDATE';
      title = 'Tracking Information Updated';
      break;
    case 'delivery':
      activityType = 'DELIVERY_UPDATE';
      title = 'Delivery Date Updated';
      break;
    case 'status':
      activityType = 'STATUS_UPDATE';
      title = 'Order Status Updated';
      break;
    default:
      activityType = 'SYSTEM_UPDATE';
      title = 'Order Updated';
  }

  // Create activity log entry
  const activityLog = await prisma.activityLog.create({
    data: {
      type: activityType,
      title,
      description: message,
      entityType: 'Order',
      entityId: orderId,
      userId,
      organizationId,
      metadata: {
        orderNumber,
        updateType,
        ...metadata,
      },
    },
  });

  return activityLog;
}

/**
 * Creates a batch of activity log entries for multiple order updates
 *
 * @param updates - Array of notification parameters
 * @returns Array of created activity log entries
 */
export async function createBatchOrderUpdateNotifications(
  updates: CreateOrderUpdateNotificationParams[]
) {
  const activityLogs = await Promise.all(
    updates.map((update) => createOrderUpdateNotification(update))
  );

  return activityLogs;
}

/**
 * Helper to create a tracking update notification
 */
export async function createTrackingUpdateNotification(
  orderId: string,
  orderNumber: string,
  organizationId: string,
  userId: string,
  trackingNumber: string,
  carrier?: string
) {
  return createOrderUpdateNotification({
    orderId,
    orderNumber,
    organizationId,
    userId,
    updateType: 'tracking',
    message: carrier
      ? `Tracking number added: ${trackingNumber} (${carrier})`
      : `Tracking number added: ${trackingNumber}`,
    metadata: {
      trackingNumber,
      carrier,
    },
  });
}

/**
 * Helper to create a delivery date update notification
 */
export async function createDeliveryDateUpdateNotification(
  orderId: string,
  orderNumber: string,
  organizationId: string,
  userId: string,
  expectedDelivery: Date,
  previousDelivery?: Date
) {
  const message = previousDelivery
    ? `Expected delivery updated from ${previousDelivery.toLocaleDateString()} to ${expectedDelivery.toLocaleDateString()}`
    : `Expected delivery date set to ${expectedDelivery.toLocaleDateString()}`;

  return createOrderUpdateNotification({
    orderId,
    orderNumber,
    organizationId,
    userId,
    updateType: 'delivery',
    message,
    metadata: {
      expectedDelivery: expectedDelivery.toISOString(),
      previousDelivery: previousDelivery?.toISOString(),
    },
  });
}

/**
 * Helper to create a status update notification
 */
export async function createStatusUpdateNotification(
  orderId: string,
  orderNumber: string,
  organizationId: string,
  userId: string,
  newStatus: string,
  previousStatus?: string
) {
  const message = previousStatus
    ? `Order status changed from ${previousStatus} to ${newStatus}`
    : `Order status set to ${newStatus}`;

  return createOrderUpdateNotification({
    orderId,
    orderNumber,
    organizationId,
    userId,
    updateType: 'status',
    message,
    metadata: {
      newStatus,
      previousStatus,
    },
  });
}
