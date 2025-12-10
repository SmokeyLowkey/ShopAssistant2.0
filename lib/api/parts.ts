import { apiRequest, buildQueryString, QueryParams, ApiError } from './client';

// Part interfaces
export interface Part {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  subcategory?: string;
  manufacturer?: string;
  price: number;
  cost: number;
  quantity: number;
  minQuantity?: number;
  location?: string;
  specifications?: any;
  compatibility?: any;
  supplierIds?: string[];
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  suppliers?: Supplier[];
}

// Simplified supplier interface for part relationships
interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

export interface PartListResponse {
  data: Part[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreatePartData {
  partNumber: string;
  description: string;
  category: string;
  subcategory?: string;
  manufacturer?: string;
  price: number;
  cost: number;
  quantity: number;
  minQuantity?: number;
  location?: string;
  specifications?: any;
  compatibility?: any;
  supplierIds?: string[];
}

export interface UpdatePartData {
  partNumber?: string;
  description?: string;
  category?: string;
  subcategory?: string | null;
  manufacturer?: string | null;
  price?: number;
  cost?: number;
  quantity?: number;
  minQuantity?: number | null;
  location?: string | null;
  specifications?: any;
  compatibility?: any;
  supplierIds?: string[];
}

/**
 * Fetch a list of parts with optional filtering, pagination, and sorting
 */
export async function getParts(params: QueryParams = {}): Promise<PartListResponse> {
  const queryString = buildQueryString(params);
  return apiRequest<PartListResponse>(`/api/parts${queryString}`);
}

/**
 * Fetch a single part by ID
 */
export async function getPart(id: string): Promise<Part> {
  return apiRequest<Part>(`/api/parts/${id}`);
}

/**
 * Create a new part
 */
export async function createPart(data: CreatePartData): Promise<Part> {
  return apiRequest<Part>('/api/parts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing part
 */
export async function updatePart(id: string, data: UpdatePartData): Promise<Part> {
  return apiRequest<Part>(`/api/parts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a part
 */
export async function deletePart(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/api/parts/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Check if a part is low in stock
 */
export function isLowStock(part: Part): boolean {
  if (part.minQuantity === undefined || part.minQuantity === null) {
    // If no minimum quantity is set, use a default threshold of 5
    return part.quantity <= 5;
  }
  return part.quantity <= part.minQuantity;
}

/**
 * Calculate the total value of a part's inventory
 */
export function calculateInventoryValue(part: Part): number {
  return part.quantity * part.cost;
}

/**
 * Calculate the potential profit from selling all inventory of a part
 */
export function calculatePotentialProfit(part: Part): number {
  return part.quantity * (part.price - part.cost);
}

/**
 * Get markup percentage for a part
 */
export function calculateMarkupPercentage(part: Part): number {
  if (part.cost === 0) return 0;
  return ((part.price - part.cost) / part.cost) * 100;
}