"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getMaintenanceRecords, getMaintenanceStatusLabel, getMaintenanceTypeLabel, getPriorityLabel } from "@/lib/api"
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
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MaintenanceStatus, MaintenanceType, Priority } from "@prisma/client"
import { AppLayout } from "@/components/layout/app-layout"

// Interface for the transformed maintenance data
interface DisplayMaintenance {
  id: string;
  maintenanceId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: Priority;
  scheduledDate: string;
  completedDate?: string | null;
  description: string;
  vehicle: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
  };
  assignedTechnician?: string | null;
  location?: string | null;
}

export default function MaintenancePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  // State for maintenance data
  const [maintenanceRecords, setMaintenanceRecords] = useState<DisplayMaintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState([
    { label: "Total Tasks", value: "0", icon: Wrench },
    { label: "Scheduled", value: "0", icon: Calendar, color: "text-blue-600" },
    { label: "In Progress", value: "0", icon: Clock, color: "text-yellow-600" },
    { label: "Completed", value: "0", icon: CheckCircle, color: "text-green-600" },
  ])

  // Fetch maintenance data
  useEffect(() => {
    const fetchMaintenanceData = async () => {
      try {
        setLoading(true)
        const response = await getMaintenanceRecords()
        
        // Transform API data to display format
        const displayRecords: DisplayMaintenance[] = response.data.map((record: any) => ({
          id: record.id,
          maintenanceId: record.maintenanceId,
          type: record.type,
          status: record.status,
          priority: record.priority,
          scheduledDate: new Date(record.scheduledDate).toLocaleDateString(),
          completedDate: record.completedDate ? new Date(record.completedDate).toLocaleDateString() : null,
          description: record.description,
          vehicle: record.vehicle,
          assignedTechnician: record.assignedTechnician,
          location: record.location,
        }))
        
        setMaintenanceRecords(displayRecords)
        
        // Update stats
        const total = displayRecords.length
        const scheduled = displayRecords.filter(r => r.status === MaintenanceStatus.SCHEDULED).length
        const inProgress = displayRecords.filter(r => r.status === MaintenanceStatus.IN_PROGRESS).length
        const completed = displayRecords.filter(r => r.status === MaintenanceStatus.COMPLETED).length
        
        setStats([
          { label: "Total Tasks", value: total.toString(), icon: Wrench },
          { label: "Scheduled", value: scheduled.toString(), icon: Calendar, color: "text-blue-600" },
          { label: "In Progress", value: inProgress.toString(), icon: Clock, color: "text-yellow-600" },
          { label: "Completed", value: completed.toString(), icon: CheckCircle, color: "text-green-600" },
        ])
        
        setError(null)
      } catch (err) {
        console.error("Error fetching maintenance records:", err)
        setError("Failed to load maintenance records. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchMaintenanceData()
  }, [])

  // Filter maintenance records
  const filteredRecords = maintenanceRecords.filter((record) => {
    const matchesSearch =
      record.maintenanceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.vehicle.vehicleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || record.status === statusFilter
    const matchesType = typeFilter === "all" || record.type === typeFilter
    const matchesPriority = priorityFilter === "all" || record.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesType && matchesPriority
  })

  // Helper function to get status badge
  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.SCHEDULED:
        return <Badge className="bg-blue-600 text-white">Scheduled</Badge>
      case MaintenanceStatus.IN_PROGRESS:
        return <Badge className="bg-yellow-600 text-white">In Progress</Badge>
      case MaintenanceStatus.COMPLETED:
        return <Badge className="bg-green-600 text-white">Completed</Badge>
      case MaintenanceStatus.CANCELLED:
        return <Badge className="bg-red-600 text-white">Cancelled</Badge>
      case MaintenanceStatus.OVERDUE:
        return <Badge className="bg-red-600 text-white">Overdue</Badge>
      case MaintenanceStatus.ON_HOLD:
        return <Badge className="bg-slate-600 text-white">On Hold</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Helper function to get priority badge
  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return <Badge className="bg-red-600 text-white">Critical</Badge>
      case Priority.HIGH:
        return <Badge className="bg-orange-600 text-white">High</Badge>
      case Priority.MEDIUM:
        return <Badge className="bg-yellow-600 text-white">Medium</Badge>
      case Priority.LOW:
        return <Badge className="bg-green-600 text-white">Low</Badge>
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  return (
    <AppLayout 
      activeRoute="/maintenance" 
      searchValue={searchTerm} 
      onSearch={(value) => setSearchTerm(value)}
      searchPlaceholder="Search maintenance tasks..."
    >
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Maintenance Management</h1>
          <p className="text-slate-400">Schedule and track maintenance tasks for your fleet</p>
        </div>
        <Link href="/maintenance/new">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Maintenance
          </Button>
        </Link>
      </div>

      {/* Maintenance Stats */}
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
                {Object.values(MaintenanceStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {getMaintenanceStatusLabel(status)}
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
                {Object.values(MaintenanceType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {getMaintenanceTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Priorities</SelectItem>
                {Object.values(Priority).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {getPriorityLabel(priority)}
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

      {/* Maintenance Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white">Maintenance Tasks ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
                <p className="text-sm text-slate-400">Loading maintenance records...</p>
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
                  <TableHead className="text-slate-300">ID</TableHead>
                  <TableHead className="text-slate-300">Vehicle</TableHead>
                  <TableHead className="text-slate-300">Type</TableHead>
                  <TableHead className="text-slate-300">Description</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Priority</TableHead>
                  <TableHead className="text-slate-300">Scheduled Date</TableHead>
                  <TableHead className="text-slate-300">Technician</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Wrench className="h-8 w-8 text-slate-500" />
                        <p className="text-slate-400">No maintenance records found</p>
                        <p className="text-sm text-slate-500">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id} className="border-slate-700">
                      <TableCell className="font-medium text-white">{record.maintenanceId}</TableCell>
                      <TableCell>
                        <Link href={`/vehicles/${record.vehicle.id}`} className="text-slate-300 hover:text-white hover:underline">
                          {record.vehicle.make} {record.vehicle.model}
                          <div className="text-xs text-slate-400">{record.vehicle.vehicleId}</div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-300">{getMaintenanceTypeLabel(record.type)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-300">{record.description}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>{getPriorityBadge(record.priority)}</TableCell>
                      <TableCell className="text-slate-300">{record.scheduledDate}</TableCell>
                      <TableCell className="text-slate-300">{record.assignedTechnician || "Unassigned"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-700">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                            <Link href={`/maintenance/${record.id}`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/maintenance/${record.id}/edit`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            </Link>
                            <Link href={`/vehicles/${record.vehicle.id}`}>
                              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                <Truck className="w-4 h-4 mr-2" />
                                View Vehicle
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
