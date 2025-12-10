"use client"

import { useState, useEffect } from "react"
import { getVehicles, calculateVehicleHealth, getVehicleAlerts, Vehicle } from "@/lib/api"
import Link from "next/link"
import {
  Search,
  Truck,
  Settings,
  BarChart3,
  Package,
  Users,
  Wrench,
  FileText,
  AlertTriangle,
  Plus,
  Filter,
  MoreHorizontal,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Eye,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppLayout } from "@/components/layout/app-layout"

// Interface for the transformed vehicle data
interface DisplayVehicle {
  id: string;
  vehicleId: string;
  serialNumber: string;
  make: string;
  model: string;
  type: string;
  year: number;
  industryCategory: string;
  status: string;
  location: string;
  hours: number;
  lastService: string;
  nextService: string;
  health: number;
  alerts: number;
}

export default function VehiclesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [industryCategoryFilter, setIndustryCategoryFilter] = useState("all")

  // State for vehicles data
  const [vehicles, setVehicles] = useState<DisplayVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fleetStats, setFleetStats] = useState([
    { label: "Total Vehicles", value: "0", icon: Truck },
    { label: "Active", value: "0", icon: CheckCircle, color: "text-green-600" },
    { label: "In Maintenance", value: "0", icon: Wrench, color: "text-yellow-600" },
    { label: "Inactive", value: "0", icon: XCircle, color: "text-red-600" },
  ]);

  // Fetch vehicles data
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        const response = await getVehicles();
        
        // Transform API data to display format
        const displayVehicles: DisplayVehicle[] = response.data.map((vehicle: Vehicle) => {
          const health = calculateVehicleHealth(vehicle);
          const vehicleAlerts = getVehicleAlerts(vehicle);
          
          return {
            id: vehicle.id,
            vehicleId: vehicle.vehicleId,
            serialNumber: vehicle.serialNumber || '',
            make: vehicle.make,
            model: vehicle.model,
            type: vehicle.type,
            year: vehicle.year,
            industryCategory: vehicle.industryCategory || 'CONSTRUCTION',
            status: vehicle.status,
            location: vehicle.currentLocation || 'Unknown',
            hours: vehicle.operatingHours || 0,
            lastService: vehicle.lastServiceDate ? new Date(vehicle.lastServiceDate).toISOString().split('T')[0] : 'N/A',
            nextService: vehicle.nextServiceDate ? new Date(vehicle.nextServiceDate).toISOString().split('T')[0] : 'N/A',
            health,
            alerts: vehicleAlerts.count,
          };
        });
        
        setVehicles(displayVehicles);
        
        // Update fleet stats
        const total = displayVehicles.length;
        const active = displayVehicles.filter(v => v.status === 'ACTIVE').length;
        const maintenance = displayVehicles.filter(v => v.status === 'MAINTENANCE').length;
        const inactive = displayVehicles.filter(v => v.status === 'INACTIVE').length;
        
        setFleetStats([
          { label: "Total Vehicles", value: total.toString(), icon: Truck },
          { label: "Active", value: active.toString(), icon: CheckCircle, color: "text-green-600" },
          { label: "In Maintenance", value: maintenance.toString(), icon: Wrench, color: "text-yellow-600" },
          { label: "Inactive", value: inactive.toString(), icon: XCircle, color: "text-red-600" },
        ]);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        setError('Failed to load vehicles. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVehicles();
  }, []);

  const filteredVehicles = vehicles.filter((vehicle: DisplayVehicle) => {
    const matchesSearch =
      vehicle.vehicleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || vehicle.status.toLowerCase() === statusFilter.toLowerCase()
    const matchesIndustryCategory =
      industryCategoryFilter === "all" ||
      vehicle.industryCategory.toLowerCase() === industryCategoryFilter.toLowerCase()
    return matchesSearch && matchesStatus && matchesIndustryCategory
  })

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-green-600 text-white">Active</Badge>
      case "maintenance":
        return <Badge className="bg-yellow-600 text-white">Maintenance</Badge>
      case "inactive":
        return <Badge className="bg-red-600 text-white">Inactive</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getHealthColor = (health: number) => {
    if (health >= 80) return "text-green-600"
    if (health >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getIndustryCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case "construction":
        return <Badge className="bg-orange-600 text-white">Construction</Badge>
      case "agriculture":
        return <Badge className="bg-green-600 text-white">Agriculture</Badge>
      case "forestry":
        return <Badge className="bg-emerald-600 text-white">Forestry</Badge>
      default:
        return <Badge variant="secondary">{category}</Badge>
    }
  }

  return (
    <AppLayout 
      activeRoute="/vehicles" 
      searchValue={searchTerm} 
      onSearch={(value) => setSearchTerm(value)}
      searchPlaceholder="Search vehicles..."
    >
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Fleet Management</h1>
          <p className="text-slate-400">Monitor and manage your construction vehicle fleet</p>
        </div>
        <Link href="/vehicles/new">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {fleetStats.map((stat, index) => (
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={industryCategoryFilter} onValueChange={setIndustryCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter by industry" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="construction">Construction</SelectItem>
                <SelectItem value="agriculture">Agriculture</SelectItem>
                <SelectItem value="forestry">Forestry</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="text-orange-600 hover:bg-slate-700 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white">Vehicle Fleet ({filteredVehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
                <p className="text-sm text-slate-400">Loading vehicles...</p>
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
                  <TableHead className="text-slate-300">Vehicle ID</TableHead>
                  <TableHead className="text-slate-300">S/N</TableHead>
                  <TableHead className="text-slate-300">Make/Model</TableHead>
                  <TableHead className="text-slate-300">Type</TableHead>
                  <TableHead className="text-slate-300">Industry</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Location</TableHead>
                  <TableHead className="text-slate-300">Hours</TableHead>
                  <TableHead className="text-slate-300">Health</TableHead>
                  <TableHead className="text-slate-300">Alerts</TableHead>
                  <TableHead className="text-slate-300">Next Service</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={12} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-8 w-8 text-slate-500" />
                        <p className="text-slate-400">No vehicles found</p>
                        <p className="text-sm text-slate-500">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id} className="border-slate-700">
                      <TableCell className="font-medium text-white">{vehicle.vehicleId}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-300">{vehicle.serialNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{vehicle.make}</div>
                          <div className="text-sm text-slate-400">
                            {vehicle.model} ({vehicle.year})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{vehicle.type}</TableCell>
                      <TableCell>{getIndustryCategoryBadge(vehicle.industryCategory)}</TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="text-sm text-slate-300">{vehicle.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-300">{vehicle.hours.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={vehicle.health} className="w-16 bg-slate-700" />
                          <span className={`text-sm font-medium ${getHealthColor(vehicle.health)}`}>
                            {vehicle.health}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle.alerts > 0 ? (
                          <Badge variant="destructive" className="bg-red-600 text-white">
                            {vehicle.alerts}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-300">{vehicle.nextService}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-700">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                            <Link href={`/vehicles/${vehicle.id}`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/vehicles/${vehicle.id}/edit`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Vehicle
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/maintenance/new?vehicleId=${vehicle.id}`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Wrench className="w-4 h-4 mr-2" />
                                Schedule Service
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/vehicles/${vehicle.id}/alerts`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                View Alerts
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
