import { PrismaClient } from '@prisma/client'

// Initialize PrismaClient
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Helper function to set the organization ID in the context
export function setOrganizationContext(organizationId: string): void {
  console.log(`Setting organization context to: ${organizationId}`)
  // In a real implementation, this would set Prisma middleware to filter by organization
}