import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcrypt"
import { prisma } from "@/lib/prisma"
import { UserRole, Prisma } from "@prisma/client"
import { JWT } from "next-auth/jwt"
import { Session } from "next-auth"
import { NextAuthConfig } from "next-auth"

/**
 * NextAuth.js configuration
 * @see https://next-auth.js.org/configuration/options
 */
export const config: NextAuthConfig = {
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
        
        // Type assertion for credentials
        const email = credentials.email as string;
        const password = credentials.password as string;
        
        try {
          // Use Prisma.validator to ensure type safety
          const user = await prisma.user.findUnique({
            where: {
              email: email
            },
            include: {
              organization: true
            }
          })
          
          if (!user) {
            console.log("User not found")
            return null
          }
          
          // Ensure password exists and is a string
          if (!user.password || typeof user.password !== 'string') {
            console.log("Invalid password format")
            return null
          }
          
          const isPasswordValid = await compare(password, user.password)
          
          if (!isPasswordValid) {
            console.log("Password invalid")
            return null
          }
          
          if (!user.isActive) {
            throw new Error("Your account has been deactivated. Please contact your administrator.")
          }
          
          // Log successful login
          await prisma.activityLog.create({
            data: {
              type: "USER_LOGIN",
              title: "User logged in",
              description: `User ${user.email} logged in successfully`,
              userId: user.id,
              organizationId: user.organizationId,
              metadata: {
                email: user.email,
                timestamp: new Date().toISOString()
              }
            }
          })
          
          // Update last login timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
          })
          
          // Get organization details
          const organization = await prisma.organization.findUnique({
            where: { id: user.organizationId }
          })

          if (!organization) {
            throw new Error("Organization not found")
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            organizationName: organization.name,
            organizationSlug: organization.slug
          }
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.organizationId = token.organizationId as string
        session.user.organizationName = token.organizationName as string
        session.user.organizationSlug = token.organizationSlug as string
      }
      return session
    },
    async jwt({ token, user }: { token: JWT; user: any }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
        token.organizationSlug = user.organizationSlug
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
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)