import { apiRequest, buildQueryString, QueryParams, ApiError } from './client';
import { MaintenanceType, MaintenanceStatus, Priority } from '@prisma/client';

// Maintenance interfaces
export interface MaintenanceRecord {
  id: string;
  maintenanceId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: Priority;
  
  // Scheduling
  scheduledDate: string;
  completedDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  
  // Cost Information
  estimatedCost?: number | null;
  actualCost?: number | null;
  laborCost?: number | null;
  partsCost?: number | null;
  
  // Details
  description: string;
  workPerformed?: string | null;
  notes?: string | null;
  location?: string | null;
  
  // Technician Information
  assignedTechnician?: string | null;
  technicianNotes?: string | null;
  
  // Relations
  vehicleId: string;
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
    year: number;
    type: string;
    status: string;
    currentLocation?: string;
    operatingHours?: number;
  };
  createdById: string;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
    role: string;
  };
  parts?: MaintenancePart[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  organizationId: string;
}

export interface MaintenancePart {
  id: string;
  maintenanceId: string;
  partId: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  part?: {
    id: string;
    partNumber: string;
    description: string;
    category?: string;
    subcategory?: string;
    price: number;
    location?: string;
  };
}

export interface MaintenanceListResponse {
  data: MaintenanceRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateMaintenancePartData {
  partId: string;
  quantityUsed: number;
  unitCost: number;
}

export interface CreateMaintenanceData {
  maintenanceId?: string; // Optional, system can generate if not provided
  vehicleId: string;
  type: MaintenanceType;
  status?: MaintenanceStatus;
  priority?: Priority;
  
  // Scheduling
  scheduledDate: string;
  completedDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  
  // Cost Information
  estimatedCost?: number | null;
  actualCost?: number | null;
  laborCost?: number | null;
  partsCost?: number | null;
  
  // Details
  description: string;
  workPerformed?: string | null;
  notes?: string | null;
  location?: string | null;
  
  // Technician Information
  assignedTechnician?: string | null;
  technicianNotes?: string | null;
  
  // Parts used
  parts?: CreateMaintenancePartData[];
}

export interface UpdateMaintenancePartData {
  id?: string; // Existing part ID, if updating
  partId: string;
  quantityUsed: number;
  unitCost: number;
}

export interface UpdateMaintenanceData {
  maintenanceId?: string;
  vehicleId?: string;
  type?: MaintenanceType;
  status?: MaintenanceStatus;
  priority?: Priority;
  
  // Scheduling
  scheduledDate?: string;
  completedDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  
  // Cost Information
  estimatedCost?: number | null;
  actualCost?: number | null;
  laborCost?: number | null;
  partsCost?: number | null;
  
  // Details
  description?: string;
  workPerformed?: string | null;
  notes?: string | null;
  location?: string | null;
  
  // Technician Information
  assignedTechnician?: string | null;
  technicianNotes?: string | null;
  
  // Parts used
  parts?: UpdateMaintenancePartData[];
  
  // Parts to remove
  removeParts?: string[];
}

/**
 * Fetch a list of maintenance records with optional filtering, pagination, and sorting
 */
export async function getMaintenanceRecords(params: QueryParams = {}): Promise<MaintenanceListResponse> {
  const queryString = buildQueryString(params);
  return apiRequest<MaintenanceListResponse>(`/api/maintenance${queryString}`);
}

/**
 * Fetch a single maintenance record by ID
 */
export async function getMaintenanceRecord(id: string): Promise<MaintenanceRecord> {
  return apiRequest<MaintenanceRecord>(`/api/maintenance/${id}`);
}

/**
 * Create a new maintenance record
 */
export async function createMaintenanceRecord(data: CreateMaintenanceData): Promise<MaintenanceRecord> {
  return apiRequest<MaintenanceRecord>('/api/maintenance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing maintenance record
 */
export async function updateMaintenanceRecord(id: string, data: UpdateMaintenanceData): Promise<MaintenanceRecord> {
  return apiRequest<MaintenanceRecord>(`/api/maintenance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a maintenance record
 */
export async function deleteMaintenanceRecord(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/api/maintenance/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Get a human-readable status label
 */
export function getMaintenanceStatusLabel(status: MaintenanceStatus): string {
  switch (status) {
    case MaintenanceStatus.SCHEDULED:
      return 'Scheduled';
    case MaintenanceStatus.IN_PROGRESS:
      return 'In Progress';
    case MaintenanceStatus.COMPLETED:
      return 'Completed';
    case MaintenanceStatus.CANCELLED:
      return 'Cancelled';
    case MaintenanceStatus.OVERDUE:
      return 'Overdue';
    case MaintenanceStatus.ON_HOLD:
      return 'On Hold';
    default:
      return status;
  }
}

/**
 * Get a human-readable type label
 */
export function getMaintenanceTypeLabel(type: MaintenanceType): string {
  switch (type) {
    case MaintenanceType.PREVENTIVE:
      return 'Preventive';
    case MaintenanceType.REPAIR:
      return 'Repair';
    case MaintenanceType.INSPECTION:
      return 'Inspection';
    case MaintenanceType.EMERGENCY:
      return 'Emergency';
    case MaintenanceType.UPGRADE:
      return 'Upgrade';
    case MaintenanceType.RECALL:
      return 'Recall';
    default:
      return type;
  }
}

/**
 * Get a human-readable priority label
 */
export function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case Priority.CRITICAL:
      return 'Critical';
    case Priority.HIGH:
      return 'High';
    case Priority.MEDIUM:
      return 'Medium';
    case Priority.LOW:
      return 'Low';
    default:
      return priority;
  }
}

/**
 * Calculate the total cost of parts used in a maintenance record
 */
export function calculatePartsCost(parts: MaintenancePart[]): number {
  return parts.reduce((total, part) => total + part.totalCost, 0);
}

// Import formatCurrency from utils
import { formatCurrency } from './utils';

// Re-export for convenience
export { formatCurrency };