/**
 * API Client Library
 *
 * This file exports all API client functions for interacting with the backend.
 */

// Base client and types
export * from './client';

// Shared utilities
export * from './utils';

// Entity-specific clients
export * from './vehicles';
export * from './parts';
export * from './suppliers';
export * from './orders';
export * from './maintenance';
export * from './quote-requests';
export * from './emails';
export * from './edited-emails';

// Add additional API clients as they are created