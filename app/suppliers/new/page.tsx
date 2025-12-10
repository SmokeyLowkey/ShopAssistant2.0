"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SupplierType, SupplierStatus } from "@prisma/client"
import { createSupplier, CreateSupplierData } from "@/lib/api/suppliers"
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  CreditCard,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"

// Form schema
const supplierFormSchema = z.object({
  supplierId: z.string().min(3, "Supplier ID must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.nativeEnum(SupplierType, {
    required_error: "Please select a supplier type",
  }),
  status: z.nativeEnum(SupplierStatus).default(SupplierStatus.ACTIVE),
  
  // Contact Information
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional().or(z.literal("")).transform(val => {
    if (!val) return val;
    // If the value doesn't start with http:// or https://, add https://
    return val.match(/^https?:\/\//) ? val : `https://${val}`;
  }),
  
  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default("USA").optional(),
  
  // Performance Metrics
  rating: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0).max(5).optional()
  ),
  
  // Business Information
  paymentTerms: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
})

type SupplierFormValues = z.infer<typeof supplierFormSchema>

export default function NewSupplierPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  
  // Email management state
  const [auxiliaryEmails, setAuxiliaryEmails] = useState<Array<{
    id?: string;
    email: string;
    name: string | null;
    phone: string | null;
  }>>([])
  const [newEmail, setNewEmail] = useState("")
  const [newEmailName, setNewEmailName] = useState("")
  const [newEmailPhone, setNewEmailPhone] = useState("")
  const [isAddingEmail, setIsAddingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Initialize form
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      supplierId: "",
      name: "",
      type: undefined,
      status: SupplierStatus.ACTIVE,
      contactPerson: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
      rating: undefined,
      paymentTerms: "",
      taxId: "",
      notes: "",
    },
  })

  // Handle adding a new auxiliary email
  const handleAddEmail = () => {
    if (!newEmail) return
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }
    
    // Check if email already exists
    if (form.getValues("email") === newEmail || auxiliaryEmails.some(aux => aux.email === newEmail)) {
      setEmailError("This email is already associated with this supplier")
      return
    }
    
    setEmailError(null)
    
    // Add to local state
    setAuxiliaryEmails([
      ...auxiliaryEmails,
      {
        email: newEmail,
        name: newEmailName || null,
        phone: newEmailPhone || null
      }
    ])
    
    // Clear input fields
    setNewEmail("")
    setNewEmailName("")
    setNewEmailPhone("")
  }
  
  // Handle removing an auxiliary email
  const handleRemoveEmail = (index: number) => {
    setAuxiliaryEmails(auxiliaryEmails.filter((_, i) => i !== index))
  }

  // Form submission handler
  const onSubmit = async (data: SupplierFormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    
    try {
      // Create a properly typed object for the API
      // Using 'as any' to bypass type checking temporarily
      // This is necessary because there's a mismatch between our form schema and the API interface
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
        certifications: [],
        specialties: [],
        auxiliaryEmails: auxiliaryEmails.map(aux => ({
          email: aux.email,
          name: aux.name,
          phone: aux.phone
        }))
      } as any;
      
      // Submit to API
      const createdSupplier = await createSupplier(supplierData)
      
      setSubmitSuccess(true)
      toast({
        title: "Supplier created",
        description: "The supplier has been successfully added.",
      })
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push("/suppliers")
      }, 1500)
    } catch (error) {
      console.error("Error creating supplier:", error)
      setSubmitError("Failed to create supplier. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/suppliers">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Suppliers
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add New Supplier</CardTitle>
          <CardDescription>
            Create a new supplier record in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitSuccess ? (
            <div className="bg-green-50 p-6 rounded-lg text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-green-800">Supplier Created Successfully</h3>
              <p className="text-green-600 mt-2">Redirecting to suppliers list...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {submitError && (
                  <div className="bg-destructive/10 p-4 rounded-md flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="text-destructive font-medium">Error</p>
                      <p className="text-destructive/80 text-sm">{submitError}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplier ID*</FormLabel>
                              <FormControl>
                                <Input placeholder="SUP-001" {...field} />
                              </FormControl>
                              <FormDescription>
                                A unique identifier for this supplier
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name*</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Parts Inc." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplier Type*</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select supplier type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.values(SupplierType).map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.values(SupplierStatus).map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Contact Information</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="contactPerson"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Person</FormLabel>
                              <FormControl>
                                <Input placeholder="John Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="contact@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Auxiliary Emails */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Additional Emails</h4>
                          {auxiliaryEmails.length > 0 ? (
                            <div className="space-y-2 mb-4">
                              {auxiliaryEmails.map((auxEmail, index) => (
                                <div key={index} className="p-3 bg-slate-100 rounded">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium">{auxEmail.email}</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveEmail(index)}
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
                                          const updatedEmails = [...auxiliaryEmails];
                                          updatedEmails[index].name = e.target.value;
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
                                          const updatedEmails = [...auxiliaryEmails];
                                          updatedEmails[index].phone = e.target.value;
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

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="+1 (555) 123-4567" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl>
                                <Input placeholder="example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Address</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Street Address</FormLabel>
                              <FormControl>
                                <Input placeholder="123 Main St" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input placeholder="New York" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State/Province</FormLabel>
                                <FormControl>
                                  <Input placeholder="NY" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Zip/Postal Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="10001" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Country</FormLabel>
                                <FormControl>
                                  <Input placeholder="USA" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Additional Information</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="rating"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rating (0-5)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="5" 
                                  step="0.1" 
                                  placeholder="4.5" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="paymentTerms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Terms</FormLabel>
                              <FormControl>
                                <Input placeholder="Net 30" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="taxId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax ID / VAT Number</FormLabel>
                              <FormControl>
                                <Input placeholder="12-3456789" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Additional information about this supplier" 
                                  className="min-h-[100px]" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button variant="outline" type="button" asChild>
                    <Link href="/suppliers">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Supplier
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}