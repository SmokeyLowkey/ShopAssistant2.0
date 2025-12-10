import { apiRequest, buildQueryString, QueryParams, ApiError } from './client';
import { VehicleStatus, VehicleType } from '@prisma/client';

// Vehicle interfaces
export interface Vehicle {
  id: string;
  vehicleId: string;
  serialNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  purchaseDate?: string;
  purchasePrice?: number;
  currentLocation?: string;
  assignedTo?: string;
  operatingHours?: number;
  fuelLevel?: number;
  lastServiceDate?: string;
  nextServiceDate?: string;
  lastServiceHours?: number;
  nextServiceHours?: number;
  notes?: string;
  specifications?: any;
  industryCategory?: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
}

export interface VehicleListResponse {
  data: Vehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateVehicleData {
  vehicleId: string;
  serialNumber?: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  purchaseDate?: string;
  purchasePrice?: number;
  currentLocation?: string;
  assignedTo?: string;
  operatingHours?: number;
  fuelLevel?: number;
  lastServiceDate?: string;
  nextServiceDate?: string;
  lastServiceHours?: number;
  nextServiceHours?: number;
  notes?: string;
  specifications?: any;
  industryCategory?: string;
}

export interface UpdateVehicleData {
  vehicleId?: string;
  serialNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  type?: VehicleType;
  status?: VehicleStatus;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  currentLocation?: string | null;
  assignedTo?: string | null;
  operatingHours?: number | null;
  fuelLevel?: number | null;
  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  lastServiceHours?: number | null;
  nextServiceHours?: number | null;
  notes?: string | null;
  specifications?: any;
  industryCategory?: string | null;
}

/**
 * Fetch a list of vehicles with optional filtering, pagination, and sorting
 */
export async function getVehicles(params: QueryParams = {}): Promise<VehicleListResponse> {
  const queryString = buildQueryString(params);
  return apiRequest<VehicleListResponse>(`/api/vehicles${queryString}`);
}

/**
 * Fetch a single vehicle by ID
 */
export async function getVehicle(id: string): Promise<Vehicle> {
  return apiRequest<Vehicle>(`/api/vehicles/${id}`);
}

/**
 * Create a new vehicle
 */
export async function createVehicle(data: CreateVehicleData): Promise<Vehicle> {
  return apiRequest<Vehicle>('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing vehicle
 */
export async function updateVehicle(id: string, data: UpdateVehicleData): Promise<Vehicle> {
  return apiRequest<Vehicle>(`/api/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a vehicle
 */
export async function deleteVehicle(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/api/vehicles/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Get vehicle health statistics
 * This is a helper function that calculates health based on various factors
 */
export function calculateVehicleHealth(vehicle: Vehicle): number {
  // This is a simplified calculation - in a real app, this would be more sophisticated
  let health = 100;
  
  // Reduce health based on operating hours
  if (vehicle.operatingHours) {
    // Assume vehicles start losing health after 1000 hours
    const hoursFactor = Math.max(0, vehicle.operatingHours - 1000) / 10000;
    health -= hoursFactor * 30; // Up to 30% reduction based on hours
  }
  
  // Reduce health if maintenance is overdue
  if (vehicle.nextServiceDate) {
    const nextService = new Date(vehicle.nextServiceDate);
    const today = new Date();
    
    if (nextService < today) {
      // Maintenance is overdue
      const daysOverdue = Math.floor((today.getTime() - nextService.getTime()) / (1000 * 60 * 60 * 24));
      health -= Math.min(20, daysOverdue / 2); // Up to 20% reduction for overdue maintenance
    }
  }
  
  // Reduce health based on status
  if (vehicle.status === 'MAINTENANCE') {
    health -= 15;
  } else if (vehicle.status === 'INACTIVE') {
    health -= 25;
  }
  
  // Ensure health is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(health)));
}

/**
 * Get vehicle alerts
 * This is a helper function that generates alerts based on vehicle data
 */
export function getVehicleAlerts(vehicle: Vehicle): { count: number; alerts: string[] } {
  const alerts: string[] = [];
  
  // Check for maintenance alerts
  if (vehicle.nextServiceDate) {
    const nextService = new Date(vehicle.nextServiceDate);
    const today = new Date();
    
    if (nextService < today) {
      alerts.push('Maintenance overdue');
    } else {
      // Check if maintenance is due within 7 days
      const daysUntilService = Math.floor((nextService.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilService <= 7) {
        alerts.push(`Maintenance due in ${daysUntilService} days`);
      }
    }
  }
  
  // Check for hours-based maintenance
  if (vehicle.operatingHours && vehicle.nextServiceHours) {
    const hoursUntilService = vehicle.nextServiceHours - vehicle.operatingHours;
    if (hoursUntilService <= 0) {
      alerts.push('Hour-based maintenance overdue');
    } else if (hoursUntilService <= 50) {
      alerts.push(`Hour-based maintenance due in ${hoursUntilService} hours`);
    }
  }
  
  // Check fuel level if available
  if (vehicle.fuelLevel !== undefined && vehicle.fuelLevel < 20) {
    alerts.push('Low fuel level');
  }
  
  return {
    count: alerts.length,
    alerts,
  };
}