# Construction Dashboard Implementation Plan

## 1. Authentication & Security Implementation

### 1.1 Authentication Pages Setup

#### Login Page
- Create `/app/auth/login/page.tsx` with:
  - Email/password form using React Hook Form
  - Remember me functionality
  - Error handling for invalid credentials
  - Redirect to dashboard on success
  - Link to password reset

#### Signup Page
- Create `/app/auth/signup/page.tsx` with:
  - Registration form (name, email, password, company)
  - Email verification step
  - Terms of service acceptance
  - Organization creation flow
  - Role selection (for initial admin)

#### Password Reset Flow
- Create `/app/auth/forgot-password/page.tsx`
- Create `/app/auth/reset-password/[token]/page.tsx`
- Implement email sending functionality
- Add token validation and password update logic

### 1.2 Authentication Backend

#### NextAuth.js Integration
- Install dependencies: `npm install next-auth@beta @auth/prisma-adapter`
- Configure NextAuth with Prisma adapter
- Create `/app/api/auth/[...nextauth]/route.ts`
- Set up session provider in layout

```typescript
// /app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { compare } from "bcrypt"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true }
        })
        
        if (!user || !(await compare(credentials.password, user.password))) {
          return null
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.organizationId = token.organizationId
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
      }
      return token
    }
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
    newUser: "/auth/new-user"
  },
  session: {
    strategy: "jwt"
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

#### Password Hashing
- Install bcrypt: `npm install bcrypt @types/bcrypt`
- Create password utility functions in `/lib/auth.ts`

```typescript
// /lib/auth.ts
import { hash, compare } from "bcrypt"

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}
```

#### Email Service for Verification/Reset
- Install nodemailer: `npm install nodemailer @types/nodemailer`
- Create email service in `/lib/email.ts`
- Configure templates for verification and password reset

### 1.3 Role-Based Access Control

#### Role Definition
- Define role enum in Prisma schema (already done)
- Create role-based middleware

#### Permission System
- Create `/lib/permissions.ts` for permission checks
- Implement resource-based permission matrix

```typescript
// /lib/permissions.ts
import { UserRole } from "@prisma/client"

type Resource = 
  | "vehicles"
  | "parts"
  | "suppliers"
  | "orders"
  | "maintenance"
  | "reports"
  | "settings"
  | "users"

type Action = "create" | "read" | "update" | "delete" | "manage"

const permissionMatrix: Record<UserRole, Record<Resource, Action[]>> = {
  ADMIN: {
    vehicles: ["create", "read", "update", "delete", "manage"],
    parts: ["create", "read", "update", "delete", "manage"],
    suppliers: ["create", "read", "update", "delete", "manage"],
    orders: ["create", "read", "update", "delete", "manage"],
    maintenance: ["create", "read", "update", "delete", "manage"],
    reports: ["create", "read", "update", "delete", "manage"],
    settings: ["create", "read", "update", "delete", "manage"],
    users: ["create", "read", "update", "delete", "manage"],
  },
  MANAGER: {
    vehicles: ["create", "read", "update", "manage"],
    parts: ["create", "read", "update", "manage"],
    suppliers: ["create", "read", "update"],
    orders: ["create", "read", "update", "manage"],
    maintenance: ["create", "read", "update", "manage"],
    reports: ["read"],
    settings: ["read"],
    users: ["read"],
  },
  TECHNICIAN: {
    vehicles: ["read", "update"],
    parts: ["read"],
    suppliers: ["read"],
    orders: ["read", "create"],
    maintenance: ["create", "read", "update"],
    reports: ["read"],
    settings: [],
    users: [],
  },
  USER: {
    vehicles: ["read"],
    parts: ["read"],
    suppliers: ["read"],
    orders: ["read"],
    maintenance: ["read"],
    reports: ["read"],
    settings: [],
    users: [],
  },
}

export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  return permissionMatrix[role][resource].includes(action)
}
```

#### Protected Routes
- Create middleware for route protection in `/middleware.ts`
- Implement role-based redirects

```typescript
// /middleware.ts
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"
import { hasPermission } from "./lib/permissions"

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  
  // Public paths that don't require authentication
  const publicPaths = ["/auth/login", "/auth/signup", "/auth/forgot-password"]
  
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  
  // Redirect to login if accessing protected route without auth
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }
  
  // Redirect to dashboard if accessing auth pages while logged in
  if (token && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url))
  }
  
  // Check permissions for specific routes
  if (token?.role) {
    const path = request.nextUrl.pathname
    
    // Map paths to resources
    const resourceMap: Record<string, { resource: string, action: string }> = {
      "/vehicles": { resource: "vehicles", action: "read" },
      "/suppliers": { resource: "suppliers", action: "read" },
      // Add more mappings as needed
    }
    
    // Check if current path requires permission check
    for (const [pathPrefix, { resource, action }] of Object.entries(resourceMap)) {
      if (path.startsWith(pathPrefix)) {
        const hasAccess = hasPermission(token.role, resource, action)
        if (!hasAccess) {
          return NextResponse.redirect(new URL("/unauthorized", request.url))
        }
      }
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
```

### 1.4 Session Management

#### Session Configuration
- Configure session lifetime and refresh strategy
- Implement session storage with database

#### Session Context
- Create session context provider in `/providers/session-provider.tsx`
- Add to root layout for global access

#### Logout Functionality
- Create `/app/auth/logout/page.tsx`
- Implement session cleanup

## 2. Backend Infrastructure

### 2.1 Database Setup

#### Prisma Configuration
- Install Prisma: `npm install prisma @prisma/client`
- Initialize Prisma: `npx prisma init`
- Configure database connection in `.env`
- Create Prisma client instance in `/lib/prisma.ts`

```typescript
// /lib/prisma.ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

#### Database Migration
- Generate migration: `npx prisma migrate dev --name init`
- Apply migration to development database
- Set up seed script for initial data

### 2.2 API Routes

#### Core API Structure
- Create route handlers for each entity:
  - `/app/api/vehicles/route.ts`
  - `/app/api/parts/route.ts`
  - `/app/api/suppliers/route.ts`
  - `/app/api/orders/route.ts`
  - `/app/api/maintenance/route.ts`
  - `/app/api/reports/route.ts`
  - `/app/api/users/route.ts`

#### CRUD Operations
- Implement standard CRUD operations for each entity
- Example for vehicles:

```typescript
// /app/api/vehicles/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { hasPermission } from "@/lib/permissions"

// GET all vehicles for organization
export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  if (!hasPermission(session.user.role, "vehicles", "read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    return NextResponse.json(vehicles)
  } catch (error) {
    console.error("Error fetching vehicles:", error)
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    )
  }
}

// POST create new vehicle
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  if (!hasPermission(session.user.role, "vehicles", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    
    // Validate input
    // ...validation logic here
    
    const vehicle = await prisma.vehicle.create({
      data: {
        ...body,
        organizationId: session.user.organizationId,
        ownerId: session.user.id
      }
    })
    
    return NextResponse.json(vehicle, { status: 201 })
  } catch (error) {
    console.error("Error creating vehicle:", error)
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 }
    )
  }
}
```

#### Dynamic Routes
- Create dynamic route handlers for individual resources:
  - `/app/api/vehicles/[id]/route.ts`
  - `/app/api/parts/[id]/route.ts`
  - etc.

```typescript
// /app/api/vehicles/[id]/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { hasPermission } from "@/lib/permissions"

// GET single vehicle
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  if (!hasPermission(session.user.role, "vehicles", "read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        maintenanceRecords: true,
        alerts: true
      }
    })
    
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }
    
    return NextResponse.json(vehicle)
  } catch (error) {
    console.error("Error fetching vehicle:", error)
    return NextResponse.json(
      { error: "Failed to fetch vehicle" },
      { status: 500 }
    )
  }
}

// PATCH update vehicle
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  if (!hasPermission(session.user.role, "vehicles", "update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    
    // Validate input
    // ...validation logic here
    
    // Ensure vehicle belongs to user's organization
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId
      }
    })
    
    if (!existingVehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }
    
    const updatedVehicle = await prisma.vehicle.update({
      where: {
        id: params.id
      },
      data: body
    })
    
    return NextResponse.json(updatedVehicle)
  } catch (error) {
    console.error("Error updating vehicle:", error)
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    )
  }
}

// DELETE vehicle
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  if (!hasPermission(session.user.role, "vehicles", "delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  try {
    // Ensure vehicle belongs to user's organization
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId
      }
    })
    
    if (!existingVehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }
    
    await prisma.vehicle.delete({
      where: {
        id: params.id
      }
    })
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting vehicle:", error)
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 }
    )
  }
}
```

### 2.3 Server Actions

#### Form Handling
- Create server actions for form submissions
- Implement in `/actions` directory

```typescript
// /actions/vehicles.ts
"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { hasPermission } from "@/lib/permissions"
import { z } from "zod"

const vehicleSchema = z.object({
  vehicleId: z.string().min(3),
  serialNumber: z.string().min(5),
  make: z.string().min(2),
  model: z.string().min(2),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  type: z.enum(["EXCAVATOR", "DOZER", "DUMP_TRUCK", "LOADER", "CRANE", "GRADER", "COMPACTOR", "OTHER"]),
  industryCategory: z.enum(["CONSTRUCTION", "AGRICULTURE", "FORESTRY"]),
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE", "RETIRED"]),
  currentLocation: z.string().optional(),
  operatingHours: z.number().int().default(0),
  healthScore: z.number().int().min(0).max(100).default(100),
  engineModel: z.string().optional(),
  specifications: z.any().optional(),
})

export async function createVehicle(formData: FormData) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return { error: "Unauthorized" }
  }
  
  if (!hasPermission(session.user.role, "vehicles", "create")) {
    return { error: "Forbidden" }
  }
  
  try {
    // Parse and validate form data
    const rawData = Object.fromEntries(formData.entries())
    const parsedData = {
      ...rawData,
      year: parseInt(rawData.year as string),
      operatingHours: parseInt(rawData.operatingHours as string || "0"),
      healthScore: parseInt(rawData.healthScore as string || "100"),
      specifications: rawData.specifications ? JSON.parse(rawData.specifications as string) : undefined
    }
    
    const validatedData = vehicleSchema.parse(parsedData)
    
    const vehicle = await prisma.vehicle.create({
      data: {
        ...validatedData,
        organizationId: session.user.organizationId,
        ownerId: session.user.id
      }
    })
    
    revalidatePath("/vehicles")
    return { success: true, data: vehicle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Validation error", details: error.errors }
    }
    
    console.error("Error creating vehicle:", error)
    return { error: "Failed to create vehicle" }
  }
}

// Similar functions for update, delete, etc.
```

#### Data Fetching
- Create data fetching functions in `/lib/data.ts`
- Implement caching and revalidation strategies

```typescript
// /lib/data.ts
import { prisma } from "./prisma"
import { cache } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export const getVehicles = cache(async () => {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return []
  }
  
  return prisma.vehicle.findMany({
    where: {
      organizationId: session.user.organizationId
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
})

export const getVehicleById = cache(async (id: string) => {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return null
  }
  
  return prisma.vehicle.findUnique({
    where: {
      id,
      organizationId: session.user.organizationId
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      maintenanceRecords: true,
      alerts: true
    }
  })
})

// Similar functions for other entities
```

### 2.4 Data Validation and Error Handling

#### Validation Library
- Install Zod: `npm install zod`
- Create validation schemas for all entities

#### Error Handling Utilities
- Create error handling utilities in `/lib/errors.ts`
- Implement consistent error responses

```typescript
// /lib/errors.ts
import { NextResponse } from "next/server"
import { ZodError } from "zod"

export type ApiError = {
  message: string
  code: string
  details?: any
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error)
  
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Validation error",
          code: "VALIDATION_ERROR",
          details: error.errors
        }
      },
      { status: 400 }
    )
  }
  
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: "INTERNAL_SERVER_ERROR"
        }
      },
      { status: 500 }
    )
  }
  
  return NextResponse.json(
    {
      error: {
        message: "An unexpected error occurred",
        code: "INTERNAL_SERVER_ERROR"
      }
    },
    { status: 500 }
  )
}

export function createErrorResponse(
  message: string,
  code: string,
  status: number = 400,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code,
        ...(details && { details })
      }
    },
    { status }
  )
}
```

#### Client-Side Error Handling
- Create error boundary components
- Implement toast notifications for errors

## 3. Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Set up Prisma and database connection
- Implement basic authentication (login/signup)
- Create core API routes for vehicles and parts

### Phase 2: Core Features (Weeks 3-4)
- Complete authentication system with password reset
- Implement role-based access control
- Add remaining API routes for all entities
- Create server actions for form handling

### Phase 3: Integration (Weeks 5-6)
- Connect frontend components to API
- Implement data fetching and state management
- Add error handling and validation
- Test and debug authentication flow

### Phase 4: Refinement (Weeks 7-8)
- Optimize performance
- Implement advanced security features
- Add comprehensive testing
- Prepare for production deployment

## 4. Security Considerations

### Data Protection
- Implement proper data sanitization
- Use parameterized queries with Prisma
- Validate all user inputs with Zod

### API Security
- Rate limiting for API routes
- CSRF protection
- Proper error handling to prevent information leakage

### Authentication Security
- Secure password storage with bcrypt
- JWT token security
- Session management and timeout
- Multi-factor authentication (future enhancement)

### Multi-Tenant Security
- Strict data isolation between organizations
- Row-level security in database queries
- Validation of organization access in all operations