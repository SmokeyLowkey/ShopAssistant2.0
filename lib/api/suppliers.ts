import { apiRequest, buildQueryString, QueryParams, ApiError } from './client';

// Supplier interfaces
export interface AuxiliaryEmail {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  supplierId: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  notes?: string;
  paymentTerms?: string;
  accountNumber?: string;
  rating?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  parts?: Part[];
  auxiliaryEmails?: AuxiliaryEmail[];
}

// Simplified part interface for supplier relationships
interface Part {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  price: number;
}

export interface SupplierListResponse {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuxiliaryEmailData {
  email: string;
  name?: string | null;
  phone?: string | null;
}

export interface CreateSupplierData {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  notes?: string;
  paymentTerms?: string;
  accountNumber?: string;
  rating?: number;
  active?: boolean;
  auxiliaryEmails?: AuxiliaryEmailData[];
}

export interface UpdateSupplierData {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  website?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
  accountNumber?: string | null;
  rating?: number | null;
  active?: boolean;
  auxiliaryEmails?: AuxiliaryEmailData[];
}

/**
 * Fetch a list of suppliers with optional filtering, pagination, and sorting
 */
export async function getSuppliers(params: QueryParams = {}): Promise<SupplierListResponse> {
  const queryString = buildQueryString(params);
  return apiRequest<SupplierListResponse>(`/api/suppliers${queryString}`);
}

/**
 * Fetch a single supplier by ID
 */
export async function getSupplier(id: string): Promise<Supplier> {
  return apiRequest<Supplier>(`/api/suppliers/${id}`);
}

/**
 * Create a new supplier
 */
export async function createSupplier(data: CreateSupplierData): Promise<Supplier> {
  return apiRequest<Supplier>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing supplier
 */
export async function updateSupplier(id: string, data: UpdateSupplierData): Promise<Supplier> {
  return apiRequest<Supplier>(`/api/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a supplier
 */
export async function deleteSupplier(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/api/suppliers/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Get parts supplied by a specific supplier
 */
export async function getSupplierParts(supplierId: string, params: QueryParams = {}): Promise<Part[]> {
  const queryString = buildQueryString(params);
  return apiRequest<Part[]>(`/api/suppliers/${supplierId}/parts${queryString}`);
}

/**
 * Format supplier address as a single string
 */
export function formatSupplierAddress(supplier: Supplier): string {
  const addressParts = [];
  
  if (supplier.address) addressParts.push(supplier.address);
  
  const cityStateZip = [];
  if (supplier.city) cityStateZip.push(supplier.city);
  if (supplier.state) cityStateZip.push(supplier.state);
  if (supplier.postalCode) cityStateZip.push(supplier.postalCode);
  
  if (cityStateZip.length > 0) {
    addressParts.push(cityStateZip.join(', '));
  }
  
  if (supplier.country) addressParts.push(supplier.country);
  
  return addressParts.join(', ');
}

/**
 * Get a display string for supplier rating (e.g., "★★★☆☆" for rating 3)
 */
export function getSupplierRatingStars(supplier: Supplier): string {
  const rating = supplier.rating || 0;
  const fullStars = '★'.repeat(Math.floor(rating));
  const emptyStars = '☆'.repeat(5 - Math.floor(rating));
  return fullStars + emptyStars;
}