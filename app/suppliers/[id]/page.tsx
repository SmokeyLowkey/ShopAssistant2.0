"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getSupplier } from "@/lib/api/suppliers"
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Edit,
  Package,
  Truck,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  X,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { SupplierStatus, SupplierType } from "@prisma/client"

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [supplier, setSupplier] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Email management state
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
  })
  const [newEmail, setNewEmail] = useState("")
  const [isAddingEmail, setIsAddingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Fetch supplier data
  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        setLoading(true)
        const data = await getSupplier(params.id)
        setSupplier(data)
        
        // Set email data
        setEmails({
          primary: data.email || null,
          auxiliary: Array.isArray((data as any).auxiliaryEmails) ? (data as any).auxiliaryEmails : []
        })
      } catch (err) {
        console.error("Error fetching supplier:", err)
        setError("Failed to load supplier details. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchSupplier()
  }, [params.id])

  // Helper function to get status badge
  const getStatusBadge = (status: SupplierStatus) => {
    switch (status) {
      case SupplierStatus.ACTIVE:
        return <Badge className="bg-green-600 text-white">Active</Badge>
      case SupplierStatus.INACTIVE:
        return <Badge className="bg-red-600 text-white">Inactive</Badge>
      case SupplierStatus.PENDING_APPROVAL:
        return <Badge className="bg-yellow-600 text-white">Pending</Badge>
      case SupplierStatus.SUSPENDED:
        return <Badge className="bg-orange-600 text-white">Suspended</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Helper function to get type badge
  const getTypeBadge = (type: SupplierType) => {
    switch (type) {
      case SupplierType.OEM_DIRECT:
        return <Badge className="bg-blue-600 text-white">OEM Direct</Badge>
      case SupplierType.DISTRIBUTOR:
        return <Badge className="bg-purple-600 text-white">Distributor</Badge>
      case SupplierType.AFTERMARKET:
        return <Badge className="bg-orange-600 text-white">Aftermarket</Badge>
      case SupplierType.LOCAL_DEALER:
        return <Badge className="bg-green-600 text-white">Local Dealer</Badge>
      case SupplierType.ONLINE_RETAILER:
        return <Badge className="bg-indigo-600 text-white">Online Retailer</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  // Helper function to format website URL for display
  const formatWebsiteForDisplay = (url: string | undefined): string => {
    if (!url) return "";
    // Remove http:// or https:// for display
    return url.replace(/^https?:\/\//, "");
  };

  // Helper function to render rating stars
  const renderRatingStars = (rating: number | null | undefined) => {
    if (!rating) return <span className="text-slate-400">Not rated</span>

    const fullStars = Math.floor(rating)
    const emptyStars = 5 - fullStars

    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-4 h-4 text-slate-500" />
        ))}
      </div>
    )
  }

  // Handle adding a new auxiliary email
  const handleAddEmail = async () => {
    if (!newEmail) return
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }
    
    // Check if email already exists
    if (emails.primary === newEmail || emails.auxiliary.some(aux => aux.email === newEmail)) {
      setEmailError("This email is already associated with this supplier")
      return
    }
    
    setIsAddingEmail(true)
    setEmailError(null)
    
    try {
      const response = await fetch(`/api/suppliers/${params.id}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setEmails({
          ...emails,
          auxiliary: [...emails.auxiliary, data.auxiliaryEmail]
        })
        setNewEmail("")
        toast({
          title: "Email added",
          description: "The email address has been added successfully.",
        })
      } else {
        setEmailError(data.error || "Failed to add email address")
      }
    } catch (error) {
      console.error("Error adding email:", error)
      setEmailError("An error occurred while adding the email address")
    } finally {
      setIsAddingEmail(false)
    }
  }

  // Handle removing an auxiliary email
  const handleRemoveEmail = async (emailId: string) => {
    try {
      const response = await fetch(`/api/suppliers/${params.id}/emails/${emailId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setEmails({
          ...emails,
          auxiliary: emails.auxiliary.filter(aux => aux.id !== emailId)
        })
        toast({
          title: "Email removed",
          description: "The email address has been removed successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to remove email address",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error removing email:", error)
      toast({
        title: "Error",
        description: "An error occurred while removing the email address",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading supplier details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="bg-red-900/20 p-6 rounded-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-500 mb-2">{error}</h3>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-red-500 text-red-500 hover:bg-red-900/20"
            onClick={() => router.refresh()}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="bg-slate-800 p-6 rounded-md text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Supplier Not Found</h3>
          <p className="text-slate-400 mb-4">The supplier you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link href="/suppliers">Back to Suppliers</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/suppliers">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Suppliers
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/orders/new?supplierId=${supplier.id}`}>
              <Package className="w-4 h-4 mr-2" />
              Create Order
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Supplier Overview */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{supplier.name}</CardTitle>
              <CardDescription>{supplier.supplierId}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(supplier.status)}
              {getTypeBadge(supplier.type)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium mb-4">Contact Information</h3>
              <div className="space-y-3">
                {supplier.contactPerson && (
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span>{supplier.contactPerson}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {formatWebsiteForDisplay(supplier.website)}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-lg font-medium mb-4">Address</h3>
              {supplier.address ? (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <p>{supplier.address}</p>
                    {supplier.city && supplier.state && (
                      <p>
                        {supplier.city}, {supplier.state} {supplier.zipCode}
                      </p>
                    )}
                    {supplier.country && <p>{supplier.country}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No address information available</p>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Overall Rating</h3>
              <div className="flex items-center gap-2">
                {renderRatingStars(supplier.rating)}
                {supplier.rating && <span className="text-lg font-medium">{supplier.rating}/5</span>}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Business Information</h3>
              <div className="space-y-2">
                {supplier.paymentTerms && (
                  <div>
                    <span className="text-sm text-slate-400">Payment Terms:</span>
                    <p>{supplier.paymentTerms}</p>
                  </div>
                )}
                {supplier.taxId && (
                  <div>
                    <span className="text-sm text-slate-400">Tax ID:</span>
                    <p>{supplier.taxId}</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Statistics</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-slate-400">Parts Supplied:</span>
                  <p>{supplier._count?.parts || 0}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-400">Orders:</span>
                  <p>{supplier._count?.orders || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Management */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Email Addresses</CardTitle>
          <CardDescription>
            Manage email addresses for this supplier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Primary Email */}
            {emails.primary && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{emails.primary}</p>
                  <p className="text-xs text-muted-foreground">Primary Email</p>
                </div>
                <Badge>Primary</Badge>
              </div>
            )}
            
            {/* Auxiliary Emails */}
            {emails.auxiliary.length > 0 && (
              <>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Additional Emails</h4>
                  <div className="space-y-2">
                    {emails.auxiliary.map((auxEmail) => (
                      <div key={auxEmail.id} className="p-3 bg-slate-50 rounded mb-3">
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
            
            {/* Add New Email */}
            <div className={emails.auxiliary.length > 0 ? "border-t pt-4" : ""}>
              <h4 className="text-sm font-medium mb-2">Add New Email</h4>
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
                >
                  {isAddingEmail ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      {supplier.orders && supplier.orders.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              The most recent orders from this supplier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/orders/${order.id}`}>
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {supplier.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}