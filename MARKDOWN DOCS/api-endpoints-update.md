# API Endpoints Update for Auxiliary Emails

We need to update the API endpoints in `app/api/suppliers/[id]/emails/route.ts` to support the new AuxiliaryEmail model with name and phone fields.

## GET Endpoint

Update the GET endpoint to return auxiliary emails with their name and phone:

```typescript
// GET /api/suppliers/[id]/emails
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
      include: {
        auxiliaryEmails: true, // Include the auxiliary emails relation
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Return the primary email and auxiliary emails
    return NextResponse.json({
      success: true,
      primaryEmail: supplier.email,
      auxiliaryEmails: supplier.auxiliaryEmails,
    });
  } catch (error) {
    console.error("Error fetching supplier emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier emails" },
      { status: 500 }
    );
  }
}
```

## POST Endpoint

Update the POST endpoint to accept name and phone fields:

```typescript
// POST /api/suppliers/[id]/emails
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { email, name, phone } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
      include: {
        auxiliaryEmails: true,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Check if the email already exists in auxiliaryEmails
    const existingAuxEmail = supplier.auxiliaryEmails.find(aux => aux.email === email);
    if (existingAuxEmail) {
      return NextResponse.json(
        { error: "Email already exists for this supplier" },
        { status: 400 }
      );
    }
    
    // Check if the email is the same as the primary email
    if (supplier.email === email) {
      return NextResponse.json(
        { error: "Email is already the primary email for this supplier" },
        { status: 400 }
      );
    }
    
    // Add the new auxiliary email
    const newAuxiliaryEmail = await prisma.auxiliaryEmail.create({
      data: {
        email,
        name: name || null,
        phone: phone || null,
        supplierId,
      },
    });
    
    return NextResponse.json({
      success: true,
      auxiliaryEmail: newAuxiliaryEmail,
    });
  } catch (error) {
    console.error("Error adding supplier email:", error);
    return NextResponse.json(
      { error: "Failed to add supplier email" },
      { status: 500 }
    );
  }
}
```

## DELETE Endpoint

Update the DELETE endpoint to use the email ID instead of the email address:

```typescript
// DELETE /api/suppliers/[id]/emails/[emailId]
// Note: We're changing the route to include the email ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, emailId: string } }
) {
  try {
    const supplierId = params.id;
    const emailId = params.emailId;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Find and delete the auxiliary email
    const auxiliaryEmail = await prisma.auxiliaryEmail.findFirst({
      where: {
        id: emailId,
        supplierId,
      },
    });
    
    if (!auxiliaryEmail) {
      return NextResponse.json(
        { error: "Auxiliary email not found" },
        { status: 404 }
      );
    }
    
    // Delete the auxiliary email
    await prisma.auxiliaryEmail.delete({
      where: {
        id: emailId,
      },
    });
    
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error removing supplier email:", error);
    return NextResponse.json(
      { error: "Failed to remove supplier email" },
      { status: 500 }
    );
  }
}
```

## PATCH Endpoint (New)

Add a new PATCH endpoint to update name and phone for existing auxiliary emails:

```typescript
// PATCH /api/suppliers/[id]/emails/[emailId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string, emailId: string } }
) {
  try {
    const supplierId = params.id;
    const emailId = params.emailId;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { name, phone } = await request.json();
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Find and update the auxiliary email
    const auxiliaryEmail = await prisma.auxiliaryEmail.findFirst({
      where: {
        id: emailId,
        supplierId,
      },
    });
    
    if (!auxiliaryEmail) {
      return NextResponse.json(
        { error: "Auxiliary email not found" },
        { status: 404 }
      );
    }
    
    // Update the auxiliary email
    const updatedAuxiliaryEmail = await prisma.auxiliaryEmail.update({
      where: {
        id: emailId,
      },
      data: {
        name: name !== undefined ? name : auxiliaryEmail.name,
        phone: phone !== undefined ? phone : auxiliaryEmail.phone,
      },
    });
    
    return NextResponse.json({
      success: true,
      auxiliaryEmail: updatedAuxiliaryEmail,
    });
  } catch (error) {
    console.error("Error updating supplier email:", error);
    return NextResponse.json(
      { error: "Failed to update supplier email" },
      { status: 500 }
    );
  }
}
```

## Route Configuration

Since we're changing the DELETE endpoint to use the email ID, we need to update the route configuration. We'll need to create a new file structure:

```
app/
  api/
    suppliers/
      [id]/
        emails/
          route.ts           # GET, POST endpoints
          [emailId]/
            route.ts         # DELETE, PATCH endpoints
```

This will allow us to handle the routes:
- GET /api/suppliers/[id]/emails
- POST /api/suppliers/[id]/emails
- DELETE /api/suppliers/[id]/emails/[emailId]
- PATCH /api/suppliers/[id]/emails/[emailId]