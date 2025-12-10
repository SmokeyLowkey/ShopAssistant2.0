"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getVehicle, calculateVehicleHealth, getVehicleAlerts, deleteVehicle } from "@/lib/api"
import { 
  ChevronLeft, 
  Edit, 
  Trash2, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Calendar, 
  Info, 
  FileText,
  BarChart3,
  Truck,
  CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"

export default function VehicleDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch vehicle data
  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        setLoading(true)
        const vehicleData = await getVehicle(params.id)
        
        // Calculate health and alerts
        const health = calculateVehicleHealth(vehicleData)
        const alerts = getVehicleAlerts(vehicleData)
        
        // Add calculated fields to vehicle data
        setVehicle({
          ...vehicleData,
          health,
          alerts: alerts.count,
          alertDetails: alerts.alerts,
        })
        
        setError(null)
      } catch (err) {
        console.error("Error fetching vehicle:", err)
        setError("Failed to load vehicle details. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchVehicleData()
  }, [params.id])

  // Handle delete vehicle
  const handleDeleteVehicle = async () => {
    try {
      setIsDeleting(true)
      await deleteVehicle(params.id)
      
      toast({
        title: "Vehicle deleted",
        description: "The vehicle has been deleted successfully.",
      })
      
      router.push("/vehicles")
    } catch (err) {
      console.error("Error deleting vehicle:", err)
      
      toast({
        title: "Error",
        description: "Failed to delete vehicle. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case "maintenance":
        return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>
      case "inactive":
        return <Badge className="bg-red-100 text-red-800">Inactive</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Helper function to get health color
  const getHealthColor = (health: number) => {
    if (health >= 80) return "text-green-600"
    if (health >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  // Helper function to format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center p-8">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading vehicle details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-destructive/10 p-4 rounded-md text-center">
          <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => router.push("/vehicles")}
          >
            Back to Vehicles
          </Button>
        </div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-muted p-4 rounded-md text-center">
          <p className="text-muted-foreground">Vehicle not found</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => router.push("/vehicles")}
          >
            Back to Vehicles
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/vehicles">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{vehicle.make} {vehicle.model}</h1>
          <Badge className="ml-2">{vehicle.vehicleId}</Badge>
          {getStatusBadge(vehicle.status)}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/maintenance/new?vehicleId=${vehicle.id}`}>
            <Button variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Schedule Service
            </Button>
          </Link>
          <Link href={`/vehicles/${vehicle.id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the vehicle
                  and all associated records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteVehicle}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Basic Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Info className="mr-2 h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Serial Number</dt>
                <dd className="text-sm font-mono">{vehicle.serialNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Year</dt>
                <dd className="text-sm">{vehicle.year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                <dd className="text-sm">{vehicle.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Industry</dt>
                <dd className="text-sm">{vehicle.industryCategory || "N/A"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <MapPin className="mr-2 h-4 w-4" />
              Location & Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Current Location</dt>
                <dd className="text-sm">{vehicle.currentLocation || "Unknown"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Operating Hours</dt>
                <dd className="text-sm">{vehicle.operatingHours?.toLocaleString() || "0"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Assigned To</dt>
                <dd className="text-sm">{vehicle.assignedTo || "Unassigned"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Maintenance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Wrench className="mr-2 h-4 w-4" />
              Maintenance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Last Service</dt>
                <dd className="text-sm">{formatDate(vehicle.lastServiceDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Next Service</dt>
                <dd className="text-sm">{formatDate(vehicle.nextServiceDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Health Score</dt>
                <dd className="text-sm flex items-center gap-2">
                  <Progress value={vehicle.health} className="w-16" />
                  <span className={`font-medium ${getHealthColor(vehicle.health)}`}>
                    {vehicle.health}%
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Alerts</dt>
                <dd className="text-sm">
                  {vehicle.alerts > 0 ? (
                    <Badge variant="destructive" className="bg-red-100 text-red-800">
                      {vehicle.alerts}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed information */}
      <Tabs defaultValue="details" className="mt-6">
        <TabsList>
          <TabsTrigger value="details">
            <FileText className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="mr-2 h-4 w-4" />
            Maintenance History
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="mr-2 h-4 w-4" />
            Usage Analytics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Specifications</CardTitle>
              <CardDescription>
                Detailed specifications and information about this vehicle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">General Information</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-muted-foreground">Engine Model</dt>
                      <dd className="text-sm">{vehicle.engineModel || "N/A"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-muted-foreground">Purchase Date</dt>
                      <dd className="text-sm">{formatDate(vehicle.purchaseDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-muted-foreground">Purchase Price</dt>
                      <dd className="text-sm">{vehicle.purchasePrice ? `$${vehicle.purchasePrice.toLocaleString()}` : "N/A"}</dd>
                    </div>
                  </dl>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.notes || "No notes available for this vehicle."}
                  </p>
                </div>
              </div>
              
              {vehicle.specifications && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Technical Specifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(vehicle.specifications).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-sm font-medium text-muted-foreground">{key}</dt>
                        <dd className="text-sm">{value.toString()}</dd>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>
                Record of all maintenance activities performed on this vehicle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Maintenance history will be displayed here.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This feature is coming soon.
                </p>
                <Link href={`/maintenance/new?vehicleId=${vehicle.id}`}>
                  <Button className="mt-4">
                    <Wrench className="mr-2 h-4 w-4" />
                    Schedule New Maintenance
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Alerts</CardTitle>
              <CardDescription>
                Active alerts and warnings for this vehicle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vehicle.alerts > 0 ? (
                <div className="space-y-4">
                  {vehicle.alertDetails.map((alert: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">{alert}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts for this vehicle.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    The vehicle is operating normally.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>
                Operational statistics and usage patterns for this vehicle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Usage analytics will be displayed here.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This feature is coming soon.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}