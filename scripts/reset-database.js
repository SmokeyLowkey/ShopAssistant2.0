// Reset Database Script
// This script will drop the existing database, create a new one, apply the Prisma schema, and run the seed script

const { execSync } = require('child_process');
const path = require('path');

console.log('🗄️  Database Reset Script');
console.log('=======================');

try {
  // Step 1: Drop the existing database
  console.log('\n📦 Step 1: Dropping existing database...');
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
  console.log('✅ Database dropped successfully');

  // Step 2: Apply the Prisma schema
  console.log('\n📦 Step 2: Applying Prisma schema...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('✅ Schema applied successfully');

  // Step 3: Run the seed script
  console.log('\n📦 Step 3: Running seed script...');
  execSync('npx prisma db seed', { stdio: 'inherit' });
  console.log('✅ Seed completed successfully');

  console.log('\n🎉 Database reset and seeded successfully!');
  console.log('\nYou can now start your application with:');
  console.log('npm run dev');
} catch (error) {
  console.error('\n❌ Error resetting database:');
  console.error(error.message);
  process.exit(1);
}