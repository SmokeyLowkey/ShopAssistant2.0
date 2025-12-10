import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find quote requests with null vehicleId
  const quotesWithoutVehicle = await prisma.quoteRequest.findMany({
    where: {
      vehicleId: null,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  })

  console.log(`Found ${quotesWithoutVehicle.length} quote requests without a vehicle:`)
  quotesWithoutVehicle.forEach((quote) => {
    console.log(`  - ${quote.id}: ${quote.title} (created: ${quote.createdAt})`)
  })

  if (quotesWithoutVehicle.length > 0) {
    console.log('\nTo fix this, you can either:')
    console.log('1. Delete these quote requests (they are invalid)')
    console.log('2. Assign them a default vehicle')
    console.log('\nTo delete them, uncomment the code below and run again.')
    
    // Uncomment to delete:
    // const result = await prisma.quoteRequest.deleteMany({
    //   where: {
    //     vehicleId: null,
    //   },
    // })
    // console.log(`Deleted ${result.count} quote requests`)
  } else {
    console.log('\nAll quote requests have vehicles! Safe to proceed with migration.')
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
