"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createMaintenanceRecord, getVehicle } from "@/lib/api"
import { MaintenanceType, MaintenanceStatus, Priority } from "@prisma/client"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { ChevronLeft, Save, Wrench, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Form validation schema
const maintenanceFormSchema = z.object({
  maintenanceId: z.string().optional(),
  vehicleId: z.string().min(1, "Vehicle is required"),
  type: z.nativeEnum(MaintenanceType),
  status: z.nativeEnum(MaintenanceStatus).default(MaintenanceStatus.SCHEDULED),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  
  // Scheduling
  scheduledDate: z.date(),
  estimatedHours: z.coerce.number().positive().optional(),
  
  // Cost Information
  estimatedCost: z.coerce.number().positive().optional(),
  
  // Details
  description: z.string().min(5, "Description must be at least 5 characters"),
  location: z.string().optional(),
  
  // Technician Information
  assignedTechnician: z.string().optional(),
})

type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>

export default function NewMaintenancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vehicleId = searchParams.get("vehicleId")
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false)
  const [vehicleDetails, setVehicleDetails] = useState<any>(null)

  // Default form values
  const defaultValues: Partial<MaintenanceFormValues> = {
    status: MaintenanceStatus.SCHEDULED,
    priority: Priority.MEDIUM,
    type: MaintenanceType.PREVENTIVE,
    scheduledDate: new Date(),
  }

  // Initialize form
  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues,
  })

  // Fetch vehicle details if vehicleId is provided
  useEffect(() => {
    if (vehicleId) {
      const fetchVehicleDetails = async () => {
        try {
          setIsLoadingVehicle(true)
          const vehicle = await getVehicle(vehicleId)
          setVehicleDetails(vehicle)
          
          // Set vehicle ID in form
          form.setValue("vehicleId", vehicleId)
        } catch (error) {
          console.error("Error fetching vehicle details:", error)
          toast({
            title: "Error",
            description: "Failed to load vehicle details. Please try again.",
            variant: "destructive",
          })
        } finally {
          setIsLoadingVehicle(false)
        }
      }
      
      fetchVehicleDetails()
    }
  }, [vehicleId, form])

  // Form submission handler
  async function onSubmit(data: MaintenanceFormValues) {
    try {
      setIsSubmitting(true)
      
      // Format date for API
      const formattedData = {
        ...data,
        scheduledDate: data.scheduledDate.toISOString(),
      }
      
      // Create maintenance record
      const newMaintenance = await createMaintenanceRecord(formattedData)
      
      // Show success message
      toast({
        title: "Maintenance scheduled",
        description: "The maintenance has been scheduled successfully.",
      })
      
      // Redirect to maintenance list or vehicle details
      if (vehicleId) {
        router.push(`/vehicles/${vehicleId}`)
      } else {
        router.push("/maintenance")
      }
    } catch (error) {
      console.error("Error scheduling maintenance:", error)
      
      // Show error message
      toast({
        title: "Error",
        description: "Failed to schedule maintenance. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href={vehicleId ? `/vehicles/${vehicleId}` : "/maintenance"}>
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Schedule Maintenance</h1>
        </div>
      </div>

      {vehicleDetails && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{vehicleDetails.make} {vehicleDetails.model}</h2>
                <p className="text-muted-foreground">ID: {vehicleDetails.vehicleId}</p>
              </div>
              <Link href={`/vehicles/${vehicleId}`}>
                <Button variant="outline" size="sm">View Vehicle</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Details</CardTitle>
          <CardDescription>
            Schedule a new maintenance task for a vehicle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle ID - Only show if not pre-selected */}
                {!vehicleId && (
                  <FormField
                    control={form.control}
                    name="vehicleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter vehicle ID" {...field} />
                        </FormControl>
                        <FormDescription>
                          The ID of the vehicle to service
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Maintenance Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maintenance Type*</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(MaintenanceType).map((type) => (
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

                {/* Priority */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority*</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(Priority).map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
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
                          {Object.values(MaintenanceStatus).map((status) => (
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

                {/* Scheduled Date */}
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Scheduled Date*</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className="w-full pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Estimated Hours */}
                <FormField
                  control={form.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Hours</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Estimated Cost */}
                <FormField
                  control={form.control}
                  name="estimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Cost</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Location */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Shop - Main" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assigned Technician */}
                <FormField
                  control={form.control}
                  name="assignedTechnician"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Technician</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description*</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the maintenance task"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <CardFooter className="flex justify-between px-0">
                <Link href={vehicleId ? `/vehicles/${vehicleId}` : "/maintenance"}>
                  <Button variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Schedule Maintenance
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}