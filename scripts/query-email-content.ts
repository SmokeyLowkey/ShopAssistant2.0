import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function queryEmailContent(quoteRequestId: string) {
  console.log(`Querying email content for quoteRequestId: ${quoteRequestId}`);
  
  // Query the most recent EditedEmail for this quoteRequestId
  const editedEmail = await prisma.editedEmail.findFirst({
    where: {
      quoteRequestId: quoteRequestId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log('\n--- Most Recent EditedEmail ---');
  if (editedEmail) {
    console.log(`ID: ${editedEmail.id}`);
    console.log(`Email Type: ${editedEmail.emailType}`);
    console.log(`Subject: ${editedEmail.subject}`);
    console.log(`Body (first 100 chars): ${editedEmail.body.substring(0, 100)}...`);
    console.log(`Created At: ${editedEmail.createdAt}`);
  } else {
    console.log('No EditedEmail found');
  }
  
  // Query the most recent N8nResponse for this quoteRequestId
  const n8nResponse = await prisma.n8nResponse.findFirst({
    where: {
      quoteRequestId: quoteRequestId,
      responseType: 'follow_up'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log('\n--- Most Recent N8nResponse ---');
  if (n8nResponse) {
    console.log(`ID: ${n8nResponse.id}`);
    console.log(`Response Type: ${n8nResponse.responseType}`);
    console.log(`Response Data: ${JSON.stringify(n8nResponse.responseData, null, 2).substring(0, 200)}...`);
    console.log(`Created At: ${n8nResponse.createdAt}`);
    
    // Try to extract email content from responseData
    const responseData = n8nResponse.responseData as any;
    if (responseData.emailContent) {
      console.log('\n--- Email Content from N8nResponse ---');
      console.log(`Subject: ${responseData.emailContent.subject}`);
      console.log(`Body (first 100 chars): ${responseData.emailContent.body.substring(0, 100)}...`);
    }
  } else {
    console.log('No N8nResponse found');
  }
  
  // Query all email types for this quoteRequestId
  const emailTypes = await prisma.editedEmail.findMany({
    where: {
      quoteRequestId: quoteRequestId
    },
    select: {
      emailType: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log('\n--- All Email Types ---');
  emailTypes.forEach(type => {
    console.log(`Type: ${type.emailType}, Created At: ${type.createdAt}`);
  });
}

// Replace with the actual quoteRequestId you want to query
const quoteRequestId = 'cmfh88r2h000mkwfqbfc38git';

queryEmailContent(quoteRequestId)
  .then(() => {
    console.log('\nQuery completed successfully');
    prisma.$disconnect();
  })
  .catch(error => {
    console.error('Error querying email content:', error);
    prisma.$disconnect();
    process.exit(1);
  });