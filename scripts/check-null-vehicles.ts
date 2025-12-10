import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find quote requests with null vehicleId
  const nullVehicleQuotes = await prisma.quoteRequest.findMany({
    where: {
      vehicleId: null,
    },
    select: {
      id: true,
      quoteNumber: true,
      title: true,
      createdAt: true,
      status: true,
    },
  })

  console.log('Quote requests with null vehicleId:', nullVehicleQuotes)
  console.log(`Total: ${nullVehicleQuotes.length}`)

  // Get the first available vehicle
  const firstVehicle = await prisma.vehicle.findFirst()
  
  if (firstVehicle) {
    console.log('\nFirst available vehicle:', {
      id: firstVehicle.id,
      vehicleId: firstVehicle.vehicleId,
      make: firstVehicle.make,
      model: firstVehicle.model,
      year: firstVehicle.year,
    })
  } else {
    console.log('\nNo vehicles found in database!')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
