/**
 * Base API client for making authenticated requests to the backend
 */
import { SignJWT } from 'jose';
import { TextEncoder } from 'util';

// Define common error types
export interface ApiError {
  error: string;
  details?: any;
  status?: number;
}

// Define pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Define sort parameters
export interface SortParams {
  field?: string;
  direction?: 'asc' | 'desc';
}

// Define filter parameters (generic)
export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

// Combine all query parameters
export interface QueryParams extends PaginationParams, SortParams, FilterParams {}

/**
 * Generate a JWT token for n8n webhook authentication using jose
 */
async function generateJwtToken(): Promise<string> {
  // Use environment variable or fallback to a development default
  const secret = process.env.N8N_WEBHOOK_SECRET || 'development_secret_key_for_testing';
  
  // Only log warning in production environment
  if (!process.env.N8N_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('N8N_WEBHOOK_SECRET is not defined in production environment');
  }
  
  try {
    // Convert secret to Uint8Array
    const secretKey = new TextEncoder().encode(secret);
    
    // Create a token that expires in 5 minutes
    const token = await new SignJWT({
      source: 'construction-dashboard',
      timestamp: Date.now()
    })
      .setProtectedHeader({ alg: 'HS512' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secretKey);
    
    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error);
    return '';
  }
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Check if this is an n8n webhook URL
  // Check if this is an n8n webhook URL with more reliable detection
  const isN8nWebhook = endpoint.includes('n8n') ||
                       endpoint.includes('webhook') ||
                       (process.env.N8N_BASE_URL && endpoint.includes(process.env.N8N_BASE_URL));
  
  // Prepare headers with authentication
  let headersObj: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Copy existing headers if any
  if (options.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    headersObj = { ...headersObj, ...existingHeaders };
  }
  
  // Add JWT token for n8n webhooks
  if (isN8nWebhook) {
    try {
      const token = await generateJwtToken();
      if (token) {
        headersObj['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error adding JWT token to request:', error);
    }
  }
  
  // Create final headers
  const headers = new Headers(headersObj);

  // Prepare the request
  const requestOptions: RequestInit = {
    ...options,
    headers: headers,
  };

  // Make the request
  const response = await fetch(endpoint, requestOptions);

  // Parse the response
  let data;
  try {
    const text = await response.text();
    // Check if the response is empty
    if (!text || text.trim() === '') {
      console.warn('Empty response received');
      data = {}; // Return empty object for empty responses
    } else {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        console.error('Response text:', text);
        throw {
          error: 'Failed to parse response as JSON',
          details: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          status: response.status,
        };
      }
    }
  } catch (error) {
    console.error('Error reading response:', error);
    throw {
      error: 'Failed to read response',
      details: response.statusText,
      status: response.status,
    };
  }

  // Handle errors
  if (!response.ok) {
    const error: ApiError = {
      error: data?.error || 'An unknown error occurred',
      details: data?.details || response.statusText,
      status: response.status,
    };
    throw error;
  }

  return data as T;
}

/**
 * Build a query string from query parameters
 */
export function buildQueryString(params: QueryParams = {}): string {
  const queryParams = new URLSearchParams();

  // Add pagination params
  if (params.page !== undefined) queryParams.append('page', params.page.toString());
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

  // Add sort params
  if (params.field !== undefined) queryParams.append('sortField', params.field);
  if (params.direction !== undefined) queryParams.append('sortDirection', params.direction);

  // Add all other filter params
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined && 
      key !== 'page' && 
      key !== 'limit' && 
      key !== 'field' && 
      key !== 'direction'
    ) {
      queryParams.append(key, value.toString());
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}