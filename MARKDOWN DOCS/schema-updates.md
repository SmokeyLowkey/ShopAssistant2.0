# Schema Updates for Authentication & Backend Infrastructure

After comparing the implementation plan with the existing database schema, I've identified several additions needed to fully support the authentication system and backend infrastructure. These updates maintain the multi-tenant architecture while enhancing security and functionality.

## 1. User Model Updates

The current User model needs additional fields for authentication:

```prisma
model User {
  // Existing fields...
  
  # Authentication
  password         String?         // Hashed password (null for OAuth users)
  emailVerified    DateTime?       // When email was verified
  isEmailVerified  Boolean         @default(false)
  
  # OAuth Providers
  accounts         Account[]       // For social login connections
  
  # Security
  twoFactorEnabled Boolean         @default(false)
  twoFactorSecret  String?         // For TOTP-based 2FA
  
  # Session Management
  sessions         Session[]       // Active sessions
  
  # Password Reset
  resetToken       PasswordReset?
}
```

## 2. New Authentication Tables

### Account Model (for OAuth)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // oauth, email, etc.
  provider          String  // google, github, etc.
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}
```

### Session Model

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  
  # Device Information
  userAgent    String?
  ipAddress    String?
  lastActive   DateTime @default(now())
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}
```

### Password Reset Model

```prisma
model PasswordReset {
  id          String    @id @default(cuid())
  token       String    @unique
  expires     DateTime
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String    @unique
  createdAt   DateTime  @default(now())
  
  @@map("password_resets")
}
```

### Verification Token Model

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  
  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

## 3. API Integration Tables

### API Key Model

```prisma
model ApiKey {
  id              String       @id @default(cuid())
  name            String       // Descriptive name for the key
  key             String       @unique // Hashed API key
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationId  String
  
  # Permissions
  scopes          String[]     // Array of allowed scopes
  
  # Usage Tracking
  lastUsed        DateTime?
  usageCount      Int          @default(0)
  
  # Status
  isActive        Boolean      @default(true)
  expiresAt       DateTime?    // Optional expiration
  
  # Timestamps
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  # Relations
  apiRequests     ApiRequest[]
  
  @@map("api_keys")
}
```

### API Request Log Model

```prisma
model ApiRequest {
  id              String   @id @default(cuid())
  apiKey          ApiKey   @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)
  apiKeyId        String
  
  # Request Details
  method          String   // GET, POST, etc.
  path            String   // API endpoint path
  statusCode      Int      // Response status code
  
  # Context
  ipAddress       String?
  userAgent       String?
  
  # Performance
  duration        Int      // Request duration in ms
  
  # Timestamps
  timestamp       DateTime @default(now())
  
  @@map("api_requests")
}
```

## 4. Security Audit Log

```prisma
model SecurityAuditLog {
  id              String            @id @default(cuid())
  organization    Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationId  String
  
  # Event Details
  eventType       SecurityEventType
  userId          String?           // Optional, may be system event
  ipAddress       String?
  userAgent       String?
  
  # Context
  description     String
  metadata        Json?             // Additional event details
  
  # Timestamps
  timestamp       DateTime          @default(now())
  
  @@map("security_audit_logs")
}

enum SecurityEventType {
  LOGIN_SUCCESS
  LOGIN_FAILURE
  LOGOUT
  PASSWORD_CHANGE
  PASSWORD_RESET_REQUEST
  PASSWORD_RESET_COMPLETE
  EMAIL_CHANGE
  ACCOUNT_LOCKED
  ACCOUNT_UNLOCKED
  TWO_FACTOR_ENABLED
  TWO_FACTOR_DISABLED
  API_KEY_CREATED
  API_KEY_DELETED
  ROLE_CHANGED
  SUSPICIOUS_ACTIVITY
}
```

## 5. Organization Model Updates

The Organization model should be extended with additional fields for authentication and security:

```prisma
model Organization {
  // Existing fields...
  
  # Security Settings
  passwordPolicy          Json?     // Password requirements
  sessionTimeoutMinutes   Int       @default(60)
  requireTwoFactor        Boolean   @default(false)
  allowedEmailDomains     String[]  // Restrict signups to specific domains
  
  # API Integration
  apiKeys                 ApiKey[]
  
  # Security Logs
  securityAuditLogs       SecurityAuditLog[]
}
```

## 6. System Settings Updates

Add authentication-specific system settings:

```prisma
// Add to SystemSetting model's data:
// - "auth.allowSignup" (boolean)
// - "auth.defaultSessionTimeout" (number)
// - "auth.jwtSecret" (string)
// - "auth.passwordResetExpiry" (number)
// - "auth.verificationTokenExpiry" (number)
```

## 7. Activity Log Updates

Add authentication-related activity types to the ActivityType enum:

```prisma
enum ActivityType {
  // Existing types...
  
  // Authentication events
  USER_REGISTERED
  USER_VERIFIED
  USER_PASSWORD_CHANGED
  USER_PROFILE_UPDATED
  USER_ROLE_CHANGED
  USER_DEACTIVATED
  USER_REACTIVATED
}
```

## 8. Index Additions

Add performance indexes for authentication queries:

```prisma
// @@index([email]) on User
// @@index([organizationId, email]) on User
// @@index([sessionToken]) on Session
// @@index([userId]) on Session
// @@index([organizationId, eventType]) on SecurityAuditLog
```

## Implementation Notes

1. **Password Storage**: All passwords must be hashed using bcrypt before storage.
2. **Sensitive Data**: API keys and tokens should be stored hashed, not in plaintext.
3. **Multi-Tenancy**: All authentication tables maintain the multi-tenant architecture with organizationId references.
4. **Data Isolation**: Security measures ensure users can only access data within their organization.
5. **Migration Strategy**: These schema changes should be applied incrementally to avoid disrupting existing data.