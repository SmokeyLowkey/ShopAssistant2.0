import { PrismaClient, VehicleType, IndustryCategory, VehicleStatus, SupplierType, SupplierStatus, ConversationContext, MessageRole, MessageType, PickListStatus } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-organization' },
    update: {},
    create: {
      name: 'Demo Construction Co.',
      slug: 'demo-organization',
      domain: 'demo-construction.com',
      subscriptionTier: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      billingEmail: 'billing@demo-construction.com',
      maxUsers: 20,
      maxVehicles: 100,
      settings: {
        dashboardLayout: 'default',
        notificationsEnabled: true,
        defaultCurrency: 'USD',
      },
      logo: '/placeholder-logo.svg',
      primaryColor: '#0072B8',
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 90,
      },
      sessionTimeoutMinutes: 60,
      requireTwoFactor: false,
      allowedEmailDomains: ['demo-construction.com'],
    },
  })

  console.log(`Created organization: ${organization.name}`)

  // Create admin user
  const adminPassword = await hash('Admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo-construction.com' },
    update: {},
    create: {
      email: 'admin@demo-construction.com',
      name: 'Admin User',
      role: 'ADMIN',
      password: adminPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 123-4567',
      avatar: '/placeholder-user.jpg',
      organizationId: organization.id,
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      theme: 'light',
      timezone: 'America/New_York',
    },
  })

  console.log(`Created admin user: ${admin.email}`)

  // Create manager user
  const managerPassword = await hash('Manager123!', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'yuriykondakov04@gmail.com' },
    update: {},
    create: {
      email: 'yuriykondakov04@gmail.com',
      name: 'Manager User',
      role: 'MANAGER',
      password: managerPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 234-5678',
      avatar: '/placeholder-user.jpg',
      organizationId: organization.id,
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      theme: 'light',
      timezone: 'America/Chicago',
    },
  })

  console.log(`Created manager user: ${manager.email}`)

  // Create technician user
  const technicianPassword = await hash('Tech123!', 12)
  const technician = await prisma.user.upsert({
    where: { email: 'tech@demo-construction.com' },
    update: {},
    create: {
      email: 'tech@demo-construction.com',
      name: 'Technician User',
      role: 'TECHNICIAN',
      password: technicianPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 345-6789',
      avatar: '/placeholder-user.jpg',
      organizationId: organization.id,
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
      theme: 'dark',
      timezone: 'America/Denver',
    },
  })

  console.log(`Created technician user: ${technician.email}`)

  // Create sample vehicles
  const vehicles = [
    {
      vehicleId: 'CAT-001',
      serialNumber: 'CAT320D2019001',
      make: 'Caterpillar',
      model: '320D',
      year: 2019,
      type: VehicleType.EXCAVATOR,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      currentLocation: 'Site A - Downtown',
      operatingHours: 2847,
      healthScore: 85,
      engineModel: 'CAT C6.6',
      specifications: {
        weight: 22800,
        horsePower: 148,
        bucketCapacity: '1.0 m³',
        maxDigDepth: '6.7 m',
      },
      ownerId: admin.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'JD-002',
      serialNumber: 'JD850K2020002',
      make: 'John Deere',
      model: '850K',
      year: 2020,
      type: VehicleType.DOZER,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.MAINTENANCE,
      currentLocation: 'Shop - Main',
      operatingHours: 1923,
      healthScore: 72,
      engineModel: 'JD 6068',
      specifications: {
        weight: 20246,
        horsePower: 205,
        bladeCapacity: '3.7 m³',
      },
      ownerId: manager.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'KOM-003',
      serialNumber: 'KOM200PC2018003',
      make: 'Komatsu',
      model: 'PC200',
      year: 2018,
      type: VehicleType.EXCAVATOR,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      currentLocation: 'Site B - Highway',
      operatingHours: 3421,
      healthScore: 91,
      engineModel: 'Komatsu SAA6D107E-1',
      specifications: {
        weight: 20000,
        horsePower: 155,
        bucketCapacity: '0.8 m³',
      },
      ownerId: technician.id,
      organizationId: organization.id,
    },
  ]

  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: {
        organizationId_vehicleId: {
          organizationId: organization.id,
          vehicleId: vehicle.vehicleId,
        },
      },
      update: {},
      create: vehicle,
    })
  }

  console.log(`Created ${vehicles.length} vehicles`)

  // Create sample suppliers
  const suppliers = [
    {
      supplierId: 'SUP-001',
      name: 'Miller Parts Co.',
      type: SupplierType.DISTRIBUTOR,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Sarah Miller',
      email: 'orders@millerparts.com',
      phone: '+1 (555) 123-4567',
      website: 'https://millerparts.com',
      address: '123 Parts Ave',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA',
      rating: 4.8,
      deliveryRating: 4.7,
      qualityRating: 4.9,
      avgDeliveryTime: 3,
      paymentTerms: 'Net 30',
      taxId: '12-3456789',
      certifications: ['ISO 9001', 'ISO 14001'],
      specialties: ['Caterpillar', 'John Deere', 'Hydraulics'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-002',
      name: 'Johnson Heavy Parts',
      type: SupplierType.AFTERMARKET,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Mike Johnson',
      email: 'sales@johnsonheavy.com',
      phone: '+1 (555) 987-6543',
      website: 'https://johnsonheavy.com',
      address: '456 Industrial Blvd',
      city: 'Houston',
      state: 'TX',
      zipCode: '77002',
      country: 'USA',
      rating: 4.6,
      deliveryRating: 4.8,
      qualityRating: 4.5,
      avgDeliveryTime: 2,
      paymentTerms: 'Net 45',
      taxId: '98-7654321',
      certifications: ['ISO 9001'],
      specialties: ['Komatsu', 'Volvo', 'Filters'],
      organizationId: organization.id,
    },
  ]

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: {
        organizationId_supplierId: {
          organizationId: organization.id,
          supplierId: supplier.supplierId,
        },
      },
      update: {},
      create: supplier,
    })
  }

  console.log(`Created ${suppliers.length} suppliers`)

  // Create sample parts
  const parts = [
    {
      partNumber: '1R-0750',
      description: 'Hydraulic Filter',
      category: 'Hydraulic',
      subcategory: 'Filters',
      price: 89.99,
      cost: 65.50,
      stockQuantity: 15,
      minStockLevel: 5,
      maxStockLevel: 30,
      weight: 1.2,
      dimensions: { length: 15, width: 10, height: 5 },
      location: 'A-12-3',
      compatibility: ['CAT 320D', 'CAT 325D'],
      specifications: {
        filterType: 'Spin-on',
        micronRating: 10,
        pressureRating: '300 psi',
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'JD-6068-F',
      description: 'Fuel Filter',
      category: 'Engine',
      subcategory: 'Filters',
      price: 45.99,
      cost: 32.75,
      stockQuantity: 22,
      minStockLevel: 8,
      maxStockLevel: 40,
      weight: 0.8,
      dimensions: { length: 12, width: 8, height: 4 },
      location: 'B-05-2',
      compatibility: ['John Deere 850K', 'John Deere 750K'],
      specifications: {
        filterType: 'Cartridge',
        micronRating: 5,
        waterSeparation: true,
      },
      organizationId: organization.id,
    },
  ]

  for (const part of parts) {
    await prisma.part.upsert({
      where: {
        organizationId_partNumber: {
          organizationId: organization.id,
          partNumber: part.partNumber,
        },
      },
      update: {},
      create: part,
    })
  }

  console.log(`Created ${parts.length} parts`)

  // Create system settings
  const systemSettings = [
    {
      key: 'auth.allowSignup',
      value: 'true',
      description: 'Allow new user registrations',
      category: 'authentication',
    },
    {
      key: 'auth.defaultSessionTimeout',
      value: '60',
      description: 'Default session timeout in minutes',
      category: 'authentication',
    },
    {
      key: 'auth.passwordResetExpiry',
      value: '24',
      description: 'Password reset token expiry in hours',
      category: 'authentication',
    },
    {
      key: 'system.maintenanceMode',
      value: 'false',
      description: 'System maintenance mode',
      category: 'system',
    },
  ]

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  console.log(`Created ${systemSettings.length} system settings`)

  // Create sample chat conversations
  const conversations = [
    {
      title: 'CAT 320D Hydraulic Filter',
      context: ConversationContext.PARTS_SEARCH,
      isActive: true,
      userId: admin.id,
      organizationId: organization.id,
    },
    {
      title: 'John Deere 850K Parts',
      context: ConversationContext.PARTS_SEARCH,
      isActive: true,
      userId: manager.id,
      organizationId: organization.id,
    },
    {
      title: 'Komatsu PC200 Maintenance',
      context: ConversationContext.MAINTENANCE_HELP,
      isActive: true,
      userId: technician.id,
      organizationId: organization.id,
    },
  ]

  const createdConversations = []
  for (const conversation of conversations) {
    const createdConversation = await prisma.chatConversation.create({
      data: conversation,
    })
    createdConversations.push(createdConversation)
  }

  console.log(`Created ${conversations.length} chat conversations`)

  // Create sample chat messages
  const messages = [
    // Messages for first conversation
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Parts Assistant. I can help you find parts, check compatibility, get pricing information, and answer technical questions about your construction equipment. What can I help you with today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[0].id,
    },
    {
      role: MessageRole.USER,
      content: "I need a hydraulic filter for my CAT 320D excavator",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[0].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "For your CAT 320D excavator, I recommend the **Hydraulic Filter 1R-0750**. Here are the details:\n\n• **Part Number:** 1R-0750\n• **Compatibility:** CAT 320D, CAT 325D\n• **Current Stock:** 15 units available\n• **Price:** $89.99\n• **Supplier:** Miller Parts Co.\n• **Location:** A-12-3\n\nThis filter provides excellent filtration for your hydraulic system. Would you like me to check if we have any alternatives or help you place an order?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[0].id,
      context: { partNumber: "1R-0750" },
    },
    
    // Messages for second conversation
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Parts Assistant. I see you're looking for parts for your John Deere 850K. How can I help you today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[1].id,
    },
    {
      role: MessageRole.USER,
      content: "I need a fuel filter for the 850K dozer",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[1].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "For your John Deere 850K dozer, I recommend the **Fuel Filter JD-6068-F**. Here are the details:\n\n• **Part Number:** JD-6068-F\n• **Compatibility:** John Deere 850K, John Deere 750K\n• **Current Stock:** 22 units available\n• **Price:** $45.99\n• **Supplier:** Johnson Heavy Parts\n• **Location:** B-05-2\n\nThis fuel filter has excellent water separation capabilities. Would you like to add this to your pick list?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[1].id,
      context: { partNumber: "JD-6068-F" },
    },
    
    // Messages for third conversation
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Maintenance Assistant. I see you're looking for help with your Komatsu PC200. How can I assist you today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[2].id,
    },
    {
      role: MessageRole.USER,
      content: "What's the recommended maintenance schedule for the PC200?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[2].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "For your Komatsu PC200 excavator, here's the recommended maintenance schedule:\n\n• **Every 250 hours:** Change engine oil and filter\n• **Every 500 hours:** Change fuel filter and hydraulic return filter\n• **Every 1000 hours:** Change hydraulic suction filter and transmission oil\n• **Every 2000 hours:** Change hydraulic oil and coolant\n\nWould you like me to help you schedule your next maintenance service?",
      messageType: MessageType.MAINTENANCE_SCHEDULE,
      conversationId: createdConversations[2].id,
    },
  ]

  for (const message of messages) {
    await prisma.chatMessage.create({
      data: message,
    })
  }

  console.log(`Created ${messages.length} chat messages`)

  // Create sample pick lists
  const pickLists = [
    {
      name: "CAT 320D Parts",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[0].id,
    },
    {
      name: "John Deere 850K Parts",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[1].id,
    },
    {
      name: "Komatsu PC200 Maintenance Parts",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[2].id,
    },
  ]

  const createdPickLists = []
  for (const pickList of pickLists) {
    const createdPickList = await prisma.chatPickList.create({
      data: pickList,
    })
    createdPickLists.push(createdPickList)
  }

  console.log(`Created ${pickLists.length} pick lists`)

  // Create sample pick list items
  const pickListItems = [
    {
      partNumber: "1R-0750",
      description: "Hydraulic Filter",
      quantity: 2,
      estimatedPrice: 89.99,
      pickListId: createdPickLists[0].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "JD-6068-F",
      description: "Fuel Filter",
      quantity: 3,
      estimatedPrice: 45.99,
      pickListId: createdPickLists[1].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "KOM-PC200-OIL",
      description: "Engine Oil Filter",
      quantity: 1,
      estimatedPrice: 35.50,
      pickListId: createdPickLists[2].id,
      messageId: null,
      addedFromChat: true,
    },
  ]

  for (const item of pickListItems) {
    await prisma.chatPickListItem.create({
      data: item,
    })
  }

  console.log(`Created ${pickListItems.length} pick list items`)

  // Update conversation lastMessageAt timestamps
  for (const conversation of createdConversations) {
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })