# Supplier Creation Page Update

We need to update the supplier creation page to support adding auxiliary emails with name and phone fields during the creation process. This document outlines the changes needed in `app/suppliers/new/page.tsx`.

## State Management Updates

First, we need to add state management for auxiliary emails:

```typescript
// Add state for auxiliary emails
const [auxiliaryEmails, setAuxiliaryEmails] = useState<Array<{
  email: string;
  name: string;
  phone: string;
  id: string; // Temporary ID for UI purposes
}>>([]);
const [newEmail, setNewEmail] = useState("");
const [newEmailName, setNewEmailName] = useState("");
const [newEmailPhone, setNewEmailPhone] = useState("");
const [emailError, setEmailError] = useState<string | null>(null);
const [isAddingEmail, setIsAddingEmail] = useState(false);
```

## Email Management Handlers

Add handlers for managing auxiliary emails:

```typescript
// Handle adding a new auxiliary email
const handleAddEmail = () => {
  if (!newEmail) return;
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    setEmailError("Please enter a valid email address");
    return;
  }
  
  // Check if email already exists
  if (form.getValues("email") === newEmail || auxiliaryEmails.some(aux => aux.email === newEmail)) {
    setEmailError("This email is already associated with this supplier");
    return;
  }
  
  // Add to local state
  setAuxiliaryEmails([
    ...auxiliaryEmails, 
    { 
      id: `temp-${Date.now()}`, 
      email: newEmail, 
      name: newEmailName, 
      phone: newEmailPhone 
    }
  ]);
  
  // Clear inputs
  setNewEmail("");
  setNewEmailName("");
  setNewEmailPhone("");
  setEmailError(null);
};

// Handle removing an auxiliary email
const handleRemoveEmail = (id: string) => {
  setAuxiliaryEmails(auxiliaryEmails.filter(aux => aux.id !== id));
};
```

## Form Submission Update

Update the form submission handler to include auxiliary emails:

```typescript
// Form submission handler
const onSubmit = async (data: SupplierFormValues) => {
  setIsSubmitting(true);
  setSubmitError(null);
  
  try {
    // Create a properly typed object for the API
    const supplierData = {
      name: data.name,
      supplierId: data.supplierId,
      type: data.type,
      status: data.status,
      contactPerson: data.contactPerson || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      website: data.website || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      zipCode: data.zipCode || undefined,
      country: data.country || undefined,
      rating: data.rating,
      paymentTerms: data.paymentTerms || undefined,
      taxId: data.taxId || undefined,
      notes: data.notes || undefined,
      // Add auxiliary emails data
      auxiliaryEmailsData: auxiliaryEmails.map(aux => ({
        email: aux.email,
        name: aux.name || null,
        phone: aux.phone || null,
      })),
    };
    
    // Submit to API
    await createSupplier(supplierData);
    
    setSubmitSuccess(true);
    toast({
      title: "Supplier created",
      description: "The supplier has been successfully added.",
    });
    
    // Redirect after a short delay
    setTimeout(() => {
      router.push("/suppliers");
    }, 1500);
  } catch (error) {
    console.error("Error creating supplier:", error);
    setSubmitError("Failed to create supplier. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
};
```

## UI Component Addition

Add a UI component for managing auxiliary emails:

```tsx
{/* Add this after the primary email field in the Contact Information section */}
{/* Auxiliary Emails */}
<div>
  <h4 className="text-sm font-medium mb-2">Additional Emails</h4>
  {auxiliaryEmails.length > 0 ? (
    <div className="space-y-2 mb-4">
      {auxiliaryEmails.map((auxEmail) => (
        <div key={auxEmail.id} className="p-3 bg-slate-100 rounded">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">{auxEmail.email}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleRemoveEmail(auxEmail.id)}
              disabled={isAddingEmail}
              type="button"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                placeholder="Contact Name"
                value={auxEmail.name || ""}
                onChange={(e) => {
                  const updatedEmails = auxiliaryEmails.map(aux => 
                    aux.id === auxEmail.id ? { ...aux, name: e.target.value } : aux
                  );
                  setAuxiliaryEmails(updatedEmails);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input
                placeholder="Contact Phone"
                value={auxEmail.phone || ""}
                onChange={(e) => {
                  const updatedEmails = auxiliaryEmails.map(aux => 
                    aux.id === auxEmail.id ? { ...aux, phone: e.target.value } : aux
                  );
                  setAuxiliaryEmails(updatedEmails);
                }}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground mb-4">No additional emails</p>
  )}
  
  <div className="flex gap-2">
    <div className="flex-1">
      <Input
        placeholder="additional@supplier.com"
        value={newEmail}
        onChange={(e) => {
          setNewEmail(e.target.value);
          setEmailError(null);
        }}
        className={emailError ? "border-red-500" : ""}
      />
      {emailError && (
        <p className="text-xs text-red-500 mt-1">{emailError}</p>
      )}
    </div>
    <Button 
      onClick={handleAddEmail} 
      disabled={!newEmail || isAddingEmail}
      type="button"
    >
      <Plus className="h-4 w-4 mr-1" />
      Add
    </Button>
  </div>
  
  {/* New Email Contact Info (shown only when adding a new email) */}
  {newEmail && (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <div>
        <label className="text-xs text-muted-foreground">Name</label>
        <Input
          placeholder="Contact Name"
          value={newEmailName}
          onChange={(e) => setNewEmailName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Phone</label>
        <Input
          placeholder="Contact Phone"
          value={newEmailPhone}
          onChange={(e) => setNewEmailPhone(e.target.value)}
          className="mt-1"
        />
      </div>
    </div>
  )}
</div>
```

## API Client Update

We also need to update the `createSupplier` function in `lib/api/suppliers.ts` to handle the auxiliary emails data:

```typescript
// Update the CreateSupplierData interface
export interface CreateSupplierData {
  // ... existing fields ...
  auxiliaryEmailsData?: Array<{
    email: string;
    name: string | null;
    phone: string | null;
  }>;
}

// Update the createSupplier function
export const createSupplier = async (data: CreateSupplierData): Promise<Supplier> => {
  try {
    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create supplier');
    }

    return response.json();
  } catch (error) {
    console.error('Error creating supplier:', error);
    throw error;
  }
};
```

## API Route Update

Finally, we need to update the supplier creation API route in `app/api/suppliers/route.ts` to handle the auxiliary emails data:

```typescript
// POST /api/suppliers
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const data = await request.json();
    
    // Extract auxiliary emails data
    const { auxiliaryEmailsData, ...supplierData } = data;
    
    // Create the supplier
    const supplier = await prisma.supplier.create({
      data: {
        ...supplierData,
        organizationId: session.user.organizationId,
      },
    });
    
    // Create auxiliary emails if provided
    if (auxiliaryEmailsData && auxiliaryEmailsData.length > 0) {
      await Promise.all(
        auxiliaryEmailsData.map(auxEmail => 
          prisma.auxiliaryEmail.create({
            data: {
              email: auxEmail.email,
              name: auxEmail.name,
              phone: auxEmail.phone,
              supplierId: supplier.id,
            },
          })
        )
      );
    }
    
    // Return the created supplier with auxiliary emails
    const supplierWithEmails = await prisma.supplier.findUnique({
      where: { id: supplier.id },
      include: { auxiliaryEmails: true },
    });
    
    return NextResponse.json(supplierWithEmails);
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}
```

This update allows users to add auxiliary emails with name and phone fields during the supplier creation process. The UI provides a clean interface for managing these emails, and the backend is updated to handle the new data structure.