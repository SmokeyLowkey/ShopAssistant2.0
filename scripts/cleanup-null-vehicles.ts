import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking for quote requests with null vehicleId...')
  
  // Use raw SQL since Prisma client doesn't allow null queries on required fields
  const quotesWithoutVehicle = await prisma.$queryRaw<Array<{ id: string; quoteNumber: string; title: string }>>`
    SELECT id, "quoteNumber", title 
    FROM quote_requests 
    WHERE "vehicleId" IS NULL
  `
  
  console.log(`Found ${quotesWithoutVehicle.length} quote request(s) without a vehicle:`)
  quotesWithoutVehicle.forEach((quote) => {
    console.log(`  - ${quote.quoteNumber}: ${quote.title}`)
  })
  
  if (quotesWithoutVehicle.length > 0) {
    console.log('\nDeleting quote request items...')
    const deletedItems = await prisma.$executeRaw`
      DELETE FROM quote_request_items
      WHERE "quoteRequestId" IN (
        SELECT id FROM quote_requests WHERE "vehicleId" IS NULL
      )
    `
    console.log(`Deleted ${deletedItems} quote request item(s)`)
    
    console.log('\nDeleting quote requests...')
    const deletedQuotes = await prisma.$executeRaw`
      DELETE FROM quote_requests
      WHERE "vehicleId" IS NULL
    `
    console.log(`Deleted ${deletedQuotes} quote request(s)`)
    
    console.log('\n✅ Cleanup complete! You can now run the migration.')
  } else {
    console.log('\n✅ No cleanup needed. Safe to proceed with migration.')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
