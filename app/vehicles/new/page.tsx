"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createVehicle } from "@/lib/api"
import { VehicleType, VehicleStatus } from "@prisma/client"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { ChevronLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"

// Form validation schema
const vehicleFormSchema = z.object({
  vehicleId: z.string().min(3, "Vehicle ID must be at least 3 characters"),
  serialNumber: z.string().min(3, "Serial number must be at least 3 characters"),
  make: z.string().min(2, "Make must be at least 2 characters"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  type: z.nativeEnum(VehicleType),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACTIVE),
  currentLocation: z.string().optional(),
  operatingHours: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  industryCategory: z.string().optional(),
})

type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export default function NewVehiclePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Default form values
  const defaultValues: Partial<VehicleFormValues> = {
    status: VehicleStatus.ACTIVE,
    year: new Date().getFullYear(),
    operatingHours: 0,
  }

  // Initialize form
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues,
  })

  // Form submission handler
  async function onSubmit(data: VehicleFormValues) {
    try {
      setIsSubmitting(true)
      
      // Create vehicle
      const newVehicle = await createVehicle(data)
      
      // Show success message
      toast({
        title: "Vehicle created",
        description: `Vehicle ${data.vehicleId} has been created successfully.`,
      })
      
      // Redirect to vehicle list
      router.push("/vehicles")
    } catch (error: any) {
      console.error("Error creating vehicle:", error)
      console.log("Error object:", JSON.stringify(error, null, 2))
      
      // Handle specific error messages
      let errorTitle = "Unable to Create Vehicle"
      let errorDescription = "Failed to create vehicle. Please try again."
      
      if (error?.error) {
        console.log("Error message:", error.error)
        
        // Check for duplicate vehicle ID
        if (error.error.includes("Vehicle ID already exists")) {
          errorDescription = `Vehicle ID "${data.vehicleId}" is already in use. Please choose a different Vehicle ID.`
        }
        // Check for duplicate serial number
        else if (error.error.includes("Serial number already exists")) {
          errorDescription = `Serial number "${data.serialNumber}" is already in use. Please enter a different serial number.`
        }
        // Check for authentication/organization errors
        else if (error.error.includes("organization information") || error.error.includes("Database constraint error")) {
          errorTitle = "Session Error"
          errorDescription = "Your session is missing organization information. Please log out and log back in to continue."
        }
        else if (error.error.includes("Unauthorized")) {
          errorTitle = "Authentication Required"
          errorDescription = "You need to be logged in to create vehicles. Please log in and try again."
        }
        else if (error.error.includes("Forbidden")) {
          errorTitle = "Permission Denied"
          errorDescription = "You don't have permission to create vehicles. Only Admins and Managers can create vehicles."
        }
        // Check for validation errors
        else if (error.error.includes("Validation error")) {
          errorTitle = "Validation Error"
          errorDescription = error.details 
            ? "Please check the form for validation errors." 
            : error.error
        }
        // Generic error message from API
        else {
          errorDescription = error.error
        }
      }
      
      console.log("About to show toast:", { errorTitle, errorDescription })
      
      // Show error message
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      })
      
      console.log("Toast should be visible now")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/vehicles">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Add New Vehicle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
          <CardDescription>
            Enter the details of the new vehicle to add it to your fleet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle ID */}
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle ID*</FormLabel>
                      <FormControl>
                        <Input placeholder="CAT-001" {...field} />
                      </FormControl>
                      <FormDescription>
                        A unique identifier for this vehicle
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Serial Number */}
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number*</FormLabel>
                      <FormControl>
                        <Input placeholder="CAT320D2019001" {...field} />
                      </FormControl>
                      <FormDescription>
                        The manufacturer's serial number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Make */}
                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make*</FormLabel>
                      <FormControl>
                        <Input placeholder="Caterpillar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Model */}
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model*</FormLabel>
                      <FormControl>
                        <Input placeholder="320D" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Year */}
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year*</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type*</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(VehicleType).map((type) => (
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
                          {Object.values(VehicleStatus).map((status) => (
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

                {/* Industry Category */}
                <FormField
                  control={form.control}
                  name="industryCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CONSTRUCTION">Construction</SelectItem>
                          <SelectItem value="AGRICULTURE">Agriculture</SelectItem>
                          <SelectItem value="FORESTRY">Forestry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Current Location */}
                <FormField
                  control={form.control}
                  name="currentLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Site A - Downtown" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Operating Hours */}
                <FormField
                  control={form.control}
                  name="operatingHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operating Hours</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional information about this vehicle"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <CardFooter className="flex justify-between px-0">
                <Link href="/vehicles">
                  <Button variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Vehicle
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