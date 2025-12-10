import { formatDate } from "./utils";

/**
 * Generates content for a follow-up email based on the original message and additional parameters
 */
export function generateFollowUpEmailContent({
  originalMessage,
  reason,
  additionalMessage,
  expectedResponseBy
}: {
  originalMessage: any;
  reason: 'no-response' | 'additional-info' | 'other';
  additionalMessage?: string;
  expectedResponseBy?: Date;
}) {
  const quoteRequest = originalMessage.thread.quoteRequest;
  const supplierName = quoteRequest?.supplier?.name || 'Supplier';
  const projectName = quoteRequest?.title || 'our project';
  
  let subject = `Follow-up: ${originalMessage.subject}`;
  let body = `Hello ${supplierName},\n\n`;
  
  // Add reason-specific content
  if (reason === 'no-response') {
    body += `I'm following up on my previous email regarding the quote request for ${projectName}. We haven't received a response yet, and we're eager to move forward with this project.\n\n`;
  } else if (reason === 'additional-info') {
    body += `I'm following up on my previous email regarding the quote request for ${projectName}. We need some additional information to proceed with this project.\n\n`;
  } else {
    body += `I'm following up on my previous email regarding the quote request for ${projectName}.\n\n`;
  }
  
  // Add the original message for reference
  body += `For your reference, here's my original message:\n\n---\n${originalMessage.body}\n---\n\n`;
  
  // Add additional message if provided
  if (additionalMessage && additionalMessage.trim()) {
    body += `${additionalMessage}\n\n`;
  }
  
  // Add expected response time if provided
  if (expectedResponseBy) {
    body += `We would appreciate a response by ${formatDate(expectedResponseBy)}.\n\n`;
  }
  
  // Add closing
  body += `Thank you for your attention to this matter.\n\nBest regards,\n[Your Name]\n[Your Company]`;
  
  return { subject, body };
}