import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { PrismaClient, Prisma } from "@prisma/client"
import crypto from "crypto"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for signup request
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
})

/**
 * POST /api/auth/signup
 * Creates a new user and organization
 */
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = signupSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const { name, email, password, companyName } = validationResult.data
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      )
    }
    
    // Generate a slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    
    // Check if slug already exists
    const existingOrganization = await prisma.organization.findUnique({
      where: { slug },
    })
    
    // If slug exists, append a random string
    const finalSlug = existingOrganization
      ? `${slug}-${Math.random().toString(36).substring(2, 7)}`
      : slug
    
    // Hash the password
    const hashedPassword = await hashPassword(password)
    
    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: companyName,
          slug: finalSlug,
          subscriptionTier: "BASIC",
          subscriptionStatus: "TRIAL",
          billingEmail: email,
          maxUsers: 5,
          maxVehicles: 20,
          settings: {
            dashboardLayout: "default",
            notificationsEnabled: true,
            defaultCurrency: "USD",
          },
        },
      })
      
      // Create user
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "ADMIN", // First user is always admin
          organizationId: organization.id,
          isEmailVerified: false, // Requires verification
        },
      })
      
      // Create verification token
      const token = crypto.randomUUID()
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      
      await tx.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "ORGANIZATION_CREATED",
          title: "Organization created",
          description: `Organization ${companyName} created`,
          organizationId: organization.id,
          userId: user.id,
          metadata: {
            organizationName: companyName,
            organizationSlug: finalSlug,
            userEmail: email,
          },
        },
      })
      
      await tx.activityLog.create({
        data: {
          type: "USER_REGISTERED",
          title: "User registered",
          description: `User ${email} registered`,
          organizationId: organization.id,
          userId: user.id,
          metadata: {
            userName: name,
            userEmail: email,
          },
        },
      })
      
      return { organization, user, verificationToken: token }
    })
    
    // TODO: Send verification email with token
    
    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        organizationSlug: result.organization.slug,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    )
  }
}