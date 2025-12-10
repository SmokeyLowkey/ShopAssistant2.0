# Supplier Detail Page UI Update

We need to update the supplier detail page UI to display the enhanced auxiliary emails with name and phone fields. This document outlines the changes needed in `app/suppliers/[id]/page.tsx`.

## State Management Updates

First, we need to update the state management to handle the new auxiliary email structure:

```typescript
// Current state management
const [emails, setEmails] = useState<{ primary: string | null, auxiliary: string[] }>({
  primary: null,
  auxiliary: []
});

// Updated state management
const [emails, setEmails] = useState<{
  primary: string | null,
  auxiliary: Array<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
  }>
}>({
  primary: null,
  auxiliary: []
});
```

## Data Fetching Update

Update the data fetching logic to handle the new auxiliary email structure:

```typescript
// In the useEffect for fetching supplier data
useEffect(() => {
  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const data = await getSupplier(params.id);
      setSupplier(data);
      
      // Set email data
      setEmails({
        primary: data.email || null,
        auxiliary: Array.isArray((data as any).auxiliaryEmails) ? (data as any).auxiliaryEmails : []
      });
    } catch (err) {
      console.error("Error fetching supplier:", err);
      setError("Failed to load supplier details. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  fetchSupplier();
}, [params.id]);
```

## Remove Email Handler Update

Update the handler for removing an auxiliary email:

```typescript
// Handle removing an auxiliary email
const handleRemoveEmail = async (emailId: string) => {
  try {
    const response = await fetch(`/api/suppliers/${params.id}/emails/${emailId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update local state
      setEmails({
        ...emails,
        auxiliary: emails.auxiliary.filter(aux => aux.id !== emailId)
      });
      toast({
        title: "Email removed",
        description: "The email address has been removed successfully.",
      });
    } else {
      toast({
        title: "Error",
        description: data.error || "Failed to remove email address",
        variant: "destructive",
      });
    }
  } catch (error) {
    console.error("Error removing email:", error);
    toast({
      title: "Error",
      description: "An error occurred while removing the email address",
      variant: "destructive",
    });
  }
};
```

## Add Email Handler Update

Update the handler for adding a new auxiliary email:

```typescript
// Handle adding a new auxiliary email
const handleAddEmail = async () => {
  if (!newEmail) return;
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    setEmailError("Please enter a valid email address");
    return;
  }
  
  // Check if email already exists
  if (emails.primary === newEmail || emails.auxiliary.some(aux => aux.email === newEmail)) {
    setEmailError("This email is already associated with this supplier");
    return;
  }
  
  setIsAddingEmail(true);
  setEmailError(null);
  
  try {
    const response = await fetch(`/api/suppliers/${params.id}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: newEmail }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update local state
      setEmails({
        ...emails,
        auxiliary: [...emails.auxiliary, data.auxiliaryEmail]
      });
      setNewEmail("");
      toast({
        title: "Email added",
        description: "The email address has been added successfully.",
      });
    } else {
      setEmailError(data.error || "Failed to add email address");
    }
  } catch (error) {
    console.error("Error adding email:", error);
    setEmailError("An error occurred while adding the email address");
  } finally {
    setIsAddingEmail(false);
  }
};
```

## UI Component Update

Update the UI component for displaying auxiliary emails:

```tsx
{/* Auxiliary Emails */}
{emails.auxiliary.length > 0 && (
  <>
    <div className="border-t pt-4">
      <h4 className="text-sm font-medium mb-2">Additional Emails</h4>
      <div className="space-y-3">
        {emails.auxiliary.map((auxEmail) => (
          <div key={auxEmail.id} className="p-3 bg-slate-50 rounded">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{auxEmail.email}</p>
                {(auxEmail.name || auxEmail.phone) && (
                  <div className="text-sm text-slate-500 mt-1">
                    {auxEmail.name && <span>{auxEmail.name}</span>}
                    {auxEmail.name && auxEmail.phone && <span> • </span>}
                    {auxEmail.phone && <span>{auxEmail.phone}</span>}
                  </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleRemoveEmail(auxEmail.id)}
                disabled={isAddingEmail}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
)}
```

This UI update enhances the display of auxiliary emails by showing the associated name and phone information. The layout is clean and organized, with each email displayed in a card-like container. The name and phone are shown below the email address when they are available, separated by a bullet point for better readability.

The UI maintains the existing functionality for adding and removing auxiliary emails, but now it works with the enhanced data structure that includes name and phone fields.