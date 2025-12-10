"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getSuppliers, formatSupplierAddress } from "@/lib/api"
import {
  Search,
  Truck,
  Settings,
  BarChart3,
  Package,
  Users,
  Wrench,
  FileText,
  Plus,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Edit,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SupplierStatus, SupplierType } from "@prisma/client"
import { AppLayout } from "@/components/layout/app-layout"

// Interface for the transformed supplier data
interface DisplaySupplier {
  id: string;
  supplierId: string;
  name: string;
  type: SupplierType;
  status: SupplierStatus;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string;
  rating?: number | null;
}

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  // State for suppliers data
  const [suppliers, setSuppliers] = useState<DisplaySupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState([
    { label: "Total Suppliers", value: "0", icon: Users },
    { label: "Active", value: "0", icon: Users, color: "text-green-600" },
    { label: "Pending", value: "0", icon: Users, color: "text-yellow-600" },
    { label: "Inactive", value: "0", icon: Users, color: "text-red-600" },
  ])

  // Fetch suppliers data
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true)
        const response = await getSuppliers()
        
        // Transform API data to display format
        const displaySuppliers: DisplaySupplier[] = response.data.map((supplier: any) => ({
          id: supplier.id,
          supplierId: supplier.supplierId,
          name: supplier.name,
          type: supplier.type,
          status: supplier.status,
          contactPerson: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone,
          website: supplier.website,
          address: formatSupplierAddress(supplier),
          rating: supplier.rating,
        }))
        
        setSuppliers(displaySuppliers)
        
        // Update stats
        const total = displaySuppliers.length
        const active = displaySuppliers.filter(s => s.status === SupplierStatus.ACTIVE).length
        const pending = displaySuppliers.filter(s => s.status === SupplierStatus.PENDING_APPROVAL).length
        const inactive = displaySuppliers.filter(s => s.status === SupplierStatus.INACTIVE).length
        
        setStats([
          { label: "Total Suppliers", value: total.toString(), icon: Users },
          { label: "Active", value: active.toString(), icon: Users, color: "text-green-600" },
          { label: "Pending", value: pending.toString(), icon: Users, color: "text-yellow-600" },
          { label: "Inactive", value: inactive.toString(), icon: Users, color: "text-red-600" },
        ])
        
        setError(null)
      } catch (err) {
        console.error("Error fetching suppliers:", err)
        setError("Failed to load suppliers. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchSuppliers()
  }, [])

  // Filter suppliers
  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.supplierId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || supplier.status === statusFilter
    const matchesType = typeFilter === "all" || supplier.type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

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

  return (
    <AppLayout 
      activeRoute="/suppliers" 
      searchValue={searchTerm} 
      onSearch={(value) => setSearchTerm(value)}
      searchPlaceholder="Search suppliers..."
    >
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Supplier Management</h1>
          <p className="text-slate-400">Manage your parts suppliers and vendors</p>
        </div>
        <Link href="/suppliers/new">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </Link>
      </div>

      {/* Supplier Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color || "text-white"}`}>{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color || "text-slate-400"}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Status</SelectItem>
                {Object.values(SupplierStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Types</SelectItem>
                {Object.values(SupplierType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="text-orange-600 hover:bg-slate-700 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white">Suppliers ({filteredSuppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
                <p className="text-sm text-slate-400">Loading suppliers...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 p-4 rounded-md text-center">
              <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-red-500 font-medium">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-red-500 text-red-500 hover:bg-red-900/20"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Supplier</TableHead>
                  <TableHead className="text-slate-300">Type</TableHead>
                  <TableHead className="text-slate-300">Contact</TableHead>
                  <TableHead className="text-slate-300">Location</TableHead>
                  <TableHead className="text-slate-300">Rating</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-slate-500" />
                        <p className="text-slate-400">No suppliers found</p>
                        <p className="text-sm text-slate-500">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border-slate-700">
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{supplier.name}</div>
                          <div className="text-xs text-slate-400">{supplier.supplierId}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(supplier.type)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.contactPerson && (
                            <div className="text-sm text-white">{supplier.contactPerson}</div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-1 text-xs">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-300">{supplier.email}</span>
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center gap-1 text-xs">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-300">{supplier.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.address ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="text-sm text-slate-300">{supplier.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">No address</span>
                        )}
                      </TableCell>
                      <TableCell>{renderRatingStars(supplier.rating)}</TableCell>
                      <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-700">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                            <Link href={`/suppliers/${supplier.id}`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/suppliers/${supplier.id}/edit`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/orders/new?supplierId=${supplier.id}`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Package className="w-4 h-4 mr-2" />
                                Create Order
                              </DropdownMenuItem>
                            </Link>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
