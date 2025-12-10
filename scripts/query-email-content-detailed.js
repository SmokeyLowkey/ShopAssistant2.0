// Import PrismaClient
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queryEmailContent(quoteRequestId) {
  console.log(`\n=== DETAILED DATABASE QUERY FOR QUOTE REQUEST: ${quoteRequestId} ===\n`);
  
  // Query ALL EditedEmail records for this quoteRequestId
  const allEditedEmails = await prisma.editedEmail.findMany({
    where: {
      quoteRequestId: quoteRequestId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log(`\n=== ALL EDITED EMAILS (${allEditedEmails.length} records) ===\n`);
  if (allEditedEmails.length > 0) {
    allEditedEmails.forEach((email, index) => {
      console.log(`--- EDITED EMAIL #${index + 1} ---`);
      console.log(`ID: ${email.id}`);
      console.log(`Email Type: ${email.emailType}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Body (first 100 chars): ${email.body.substring(0, 100)}...`);
      console.log(`Created At: ${email.createdAt}`);
      console.log(`Updated At: ${email.updatedAt}`);
      console.log(`\n`);
    });
  } else {
    console.log('No EditedEmail records found');
  }
  
  // Query ALL N8nResponse records for this quoteRequestId
  const allN8nResponses = await prisma.n8nResponse.findMany({
    where: {
      quoteRequestId: quoteRequestId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log(`\n=== ALL N8N RESPONSES (${allN8nResponses.length} records) ===\n`);
  if (allN8nResponses.length > 0) {
    allN8nResponses.forEach((response, index) => {
      console.log(`--- N8N RESPONSE #${index + 1} ---`);
      console.log(`ID: ${response.id}`);
      console.log(`Response Type: ${response.responseType}`);
      console.log(`Message ID: ${response.messageId}`);
      console.log(`Created At: ${response.createdAt}`);
      console.log(`Updated At: ${response.updatedAt}`);
      
      // Try to extract email content from responseData
      try {
        const responseData = response.responseData;
        console.log(`\nResponse Data Keys: ${Object.keys(responseData).join(', ')}`);
        
        if (responseData.emailContent) {
          console.log(`\n--- Email Content ---`);
          console.log(`Subject: ${responseData.emailContent.subject || 'N/A'}`);
          console.log(`Body (first 100 chars): ${responseData.emailContent.body ? responseData.emailContent.body.substring(0, 100) + '...' : 'N/A'}`);
        }
        
        if (responseData.emailType) {
          console.log(`Email Type: ${responseData.emailType}`);
        }
        
        if (responseData.workflowBranch) {
          console.log(`Workflow Branch: ${responseData.workflowBranch}`);
        }
        
        if (responseData.followUpReason) {
          console.log(`Follow-up Reason: ${responseData.followUpReason}`);
        }
      } catch (error) {
        console.log(`Error parsing responseData: ${error.message}`);
      }
      
      console.log(`\n`);
    });
  } else {
    console.log('No N8nResponse records found');
  }
  
  // Query the QuoteRequest record
  const quoteRequest = await prisma.quoteRequest.findUnique({
    where: {
      id: quoteRequestId
    }
  });
  
  console.log(`\n=== QUOTE REQUEST DETAILS ===\n`);
  if (quoteRequest) {
    console.log(`ID: ${quoteRequest.id}`);
    console.log(`Quote Number: ${quoteRequest.quoteNumber || 'N/A'}`);
    console.log(`Status: ${quoteRequest.status || 'N/A'}`);
    console.log(`Created At: ${quoteRequest.createdAt}`);
    console.log(`Updated At: ${quoteRequest.updatedAt}`);
  } else {
    console.log('Quote Request not found');
  }
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