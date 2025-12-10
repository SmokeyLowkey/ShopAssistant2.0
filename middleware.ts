import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

/**
 * Middleware for authentication and route protection
 * Runs before each request to protected routes
 */
export async function middleware(request: NextRequest) {
  // Get the pathname from the request
  const path = request.nextUrl.pathname
  
  // Define public paths that don't require authentication
  const publicPaths = [
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/error",
  ]
  
  // Check if the current path is public
  const isPublicPath = publicPaths.some(publicPath => 
    path.startsWith(publicPath)
  )
  
  // API routes that don't require authentication
  const publicApiPaths = [
    "/api/auth",
  ]
  
  // Check if the current path is a public API route
  const isPublicApiPath = publicApiPaths.some(publicPath => 
    path.startsWith(publicPath)
  )
  
  // Get the authentication token
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })
  
  // If the path is public or a public API route, allow access
  if (isPublicPath || isPublicApiPath) {
    // If user is already logged in and trying to access auth pages, redirect to dashboard
    if (token && isPublicPath) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    
    return NextResponse.next()
  }
  
  // If no token and trying to access protected route, redirect to login
  if (!token) {
    // Store the original URL to redirect back after login
    const url = new URL("/auth/login", request.url)
    url.searchParams.set("callbackUrl", encodeURI(request.url))
    
    return NextResponse.redirect(url)
  }
  
  // Check for organization-specific routes
  if (path.startsWith("/org/")) {
    // Extract organization slug from URL
    const orgSlug = path.split("/")[2]
    
    // If the user doesn't belong to this organization, redirect to unauthorized
    if (token.organizationSlug !== orgSlug) {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }
  }
  
  // Role-based access control for specific routes
  const adminOnlyPaths = [
    "/settings/users",
    "/settings/organization",
    "/settings/billing",
  ]
  
  const isAdminOnlyPath = adminOnlyPaths.some(adminPath => 
    path.startsWith(adminPath)
  )
  
  if (isAdminOnlyPath && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  
  // Manager or admin only paths
  const managerPaths = [
    "/reports",
    "/settings/vehicles",
    "/settings/suppliers",
  ]
  
  const isManagerPath = managerPaths.some(managerPath => 
    path.startsWith(managerPath)
  )
  
  if (isManagerPath && token.role !== "ADMIN" && token.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  
  // Allow access to the requested resource
  return NextResponse.next()
}

/**
 * Configure which routes use this middleware
 */
export const config = {
  matcher: [
    // Match all routes except static files, api routes we want to exclude, and _next
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}