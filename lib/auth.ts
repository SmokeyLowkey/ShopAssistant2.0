import { hash, compare } from "bcrypt"
import { auth } from "../auth"
import { UserRole } from "@prisma/client"

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword)
}

/**
 * Get the current session from the server
 */
export async function getSession() {
  return auth()
}

/**
 * Check if the current user is authenticated
 */
export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(role: UserRole | UserRole[]) {
  const user = await getCurrentUser()
  
  if (!user) {
    return false
  }
  
  if (Array.isArray(role)) {
    return role.includes(user.role)
  }
  
  return user.role === role
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin() {
  return hasRole(UserRole.ADMIN)
}

/**
 * Check if the current user is a manager or admin
 */
export async function isManagerOrAdmin() {
  return hasRole([UserRole.ADMIN, UserRole.MANAGER])
}

/**
 * Types for authentication
 */
export interface AuthUser {
  id: string
  name?: string | null
  email: string
  role: UserRole
  organizationId: string
  organizationName: string
  organizationSlug: string
}

// Extend the next-auth session type
declare module "next-auth" {
  interface Session {
    user: AuthUser
  }
}

// Extend the JWT type
declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    organizationId: string
    organizationName: string
    organizationSlug: string
  }
}