# Supplier Edit Page UI Update

We need to update the supplier edit page UI to support name and phone fields for auxiliary emails. This document outlines the changes needed in `app/suppliers/[id]/edit/page.tsx`.

## State Management Updates

First, we need to update the state management to handle the new auxiliary email structure:

```typescript
// Current state management
const [auxiliaryEmails, setAuxiliaryEmails] = useState<string[]>([]);
const [newEmail, setNewEmail] = useState("");
const [isAddingEmail, setIsAddingEmail] = useState(false);
const [emailError, setEmailError] = useState<string | null>(null);

// Updated state management
const [auxiliaryEmails, setAuxiliaryEmails] = useState<Array<{
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}>>([]);
const [newEmail, setNewEmail] = useState("");
const [newEmailName, setNewEmailName] = useState("");
const [newEmailPhone, setNewEmailPhone] = useState("");
const [isAddingEmail, setIsAddingEmail] = useState(false);
const [emailError, setEmailError] = useState<string | null>(null);
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
      
      // Set form values
      // Use type assertion to handle the actual data structure
      const supplierData = data as any;
      
      form.reset({
        // ... existing form fields ...
      });
      
      // Set auxiliary emails
      setAuxiliaryEmails(
        Array.isArray(supplierData.auxiliaryEmails) 
          ? supplierData.auxiliaryEmails 
          : []
      );
    } catch (err) {
      console.error("Error fetching supplier:", err);
      setLoadError("Failed to load supplier details. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  fetchSupplier();
}, [params.id, form]);
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
  if (form.getValues("email") === newEmail || auxiliaryEmails.some(aux => aux.email === newEmail)) {
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
      body: JSON.stringify({ 
        email: newEmail,
        name: newEmailName || null,
        phone: newEmailPhone || null
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update local state
      setAuxiliaryEmails([...auxiliaryEmails, data.auxiliaryEmail]);
      setNewEmail("");
      setNewEmailName("");
      setNewEmailPhone("");
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
      setAuxiliaryEmails(auxiliaryEmails.filter(aux => aux.id !== emailId));
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

## Update Email Handler (New)

Add a new handler for updating auxiliary email fields:

```typescript
// Handle updating auxiliary email fields
const handleUpdateAuxEmail = async (emailId: string, field: 'name' | 'phone', value: string) => {
  try {
    // Update local state immediately for responsive UI
    setAuxiliaryEmails(auxiliaryEmails.map(aux => 
      aux.id === emailId ? { ...aux, [field]: value } : aux
    ));
    
    // Send update to server
    const response = await fetch(`/api/suppliers/${params.id}/emails/${emailId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [field]: value }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      toast({
        title: "Error",
        description: data.error || `Failed to update email ${field}`,
        variant: "destructive",
      });
      
      // Revert local state if server update failed
      const response = await fetch(`/api/suppliers/${params.id}/emails`);
      const emailData = await response.json();
      if (emailData.success) {
        setAuxiliaryEmails(emailData.auxiliaryEmails);
      }
    }
  } catch (error) {
    console.error(`Error updating email ${field}:`, error);
    toast({
      title: "Error",
      description: `An error occurred while updating the email ${field}`,
      variant: "destructive",
    });
  }
};
```

## UI Component Update

Update the UI component for displaying and managing auxiliary emails:

```tsx
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
                onChange={(e) => handleUpdateAuxEmail(auxEmail.id, "name", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input
                placeholder="Contact Phone"
                value={auxEmail.phone || ""}
                onChange={(e) => handleUpdateAuxEmail(auxEmail.id, "phone", e.target.value)}
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
          setNewEmail(e.target.value)
          setEmailError(null)
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
      {isAddingEmail ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
      ) : (
        <Plus className="h-4 w-4 mr-1" />
      )}
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

This UI update provides a clean interface for managing auxiliary emails with their associated name and phone fields. The name and phone fields are displayed for each existing auxiliary email, allowing users to edit them directly. When adding a new email, the name and phone fields appear only after the user has entered an email address, keeping the interface clean and focused.