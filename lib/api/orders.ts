import { apiRequest, buildQueryString, QueryParams, ApiError } from './client';
import { OrderStatus } from '@prisma/client';

// Order interfaces
export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderDate: string;
  requiredDate?: string;
  shippedDate?: string;
  deliveredDate?: string;
  supplierId: string;
  supplierName?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes?: string;
  shippingAddress?: string;
  trackingNumber?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  items: OrderItem[];
  supplier?: {
    id: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
  };
}

export interface OrderItem {
  id: string;
  orderId: string;
  partId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  part?: {
    id: string;
    partNumber: string;
    description: string;
    category: string;
  };
}

export interface OrderListResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOrderItemData {
  partId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface CreateOrderData {
  orderNumber?: string; // Optional, system can generate if not provided
  status?: OrderStatus;
  orderDate?: string;
  requiredDate?: string;
  shippedDate?: string;
  deliveredDate?: string;
  supplierId: string;
  subtotal?: number; // Optional, system can calculate
  tax?: number;
  shipping?: number;
  total?: number; // Optional, system can calculate
  notes?: string;
  shippingAddress?: string;
  trackingNumber?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  items: CreateOrderItemData[];
}

export interface UpdateOrderItemData {
  id?: string; // Existing item ID if updating
  partId?: string;
  quantity?: number;
  unitPrice?: number;
  notes?: string | null;
}

export interface UpdateOrderData {
  orderNumber?: string;
  status?: OrderStatus;
  orderDate?: string;
  requiredDate?: string | null;
  shippedDate?: string | null;
  deliveredDate?: string | null;
  supplierId?: string;
  subtotal?: number;
  tax?: number | null;
  shipping?: number | null;
  total?: number;
  notes?: string | null;
  shippingAddress?: string | null;
  trackingNumber?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  items?: UpdateOrderItemData[];
  removeItems?: string[]; // IDs of items to remove
}

/**
 * Fetch a list of orders with optional filtering, pagination, and sorting
 */
export async function getOrders(params: QueryParams = {}): Promise<OrderListResponse> {
  const queryString = buildQueryString(params);
  return apiRequest<OrderListResponse>(`/api/orders${queryString}`);
}

/**
 * Fetch a single order by ID
 */
export async function getOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}`);
}

/**
 * Create a new order
 */
export async function createOrder(data: CreateOrderData): Promise<Order> {
  return apiRequest<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing order
 */
export async function updateOrder(id: string, data: UpdateOrderData): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete an order
 */
export async function deleteOrder(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/api/orders/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Calculate order totals based on items
 */
export function calculateOrderTotals(items: CreateOrderItemData[] | OrderItem[], taxRate = 0, shippingCost = 0): {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
} {
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    return sum + itemSubtotal;
  }, 0);
  
  // Calculate tax
  const tax = subtotal * (taxRate / 100);
  
  // Calculate total
  const total = subtotal + tax + shippingCost;
  
  return {
    subtotal,
    tax,
    shipping: shippingCost,
    total,
  };
}

/**
 * Get a human-readable status label
 */
export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return 'Pending';
    case OrderStatus.PENDING_QUOTE:
      return 'Pending Quote';
    case OrderStatus.PROCESSING:
      return 'Processing';
    case OrderStatus.IN_TRANSIT:
      return 'In Transit';
    case OrderStatus.DELIVERED:
      return 'Delivered';
    case OrderStatus.CANCELLED:
      return 'Cancelled';
    case OrderStatus.RETURNED:
      return 'Returned';
    default:
      return status;
  }
}

// Import formatCurrency from utils
import { formatCurrency } from './utils';

// Re-export for convenience
export { formatCurrency };