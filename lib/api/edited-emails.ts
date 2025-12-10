import { apiRequest } from './client';

/**
 * Save an edited email to the database
 * @param quoteRequestId The ID of the quote request
 * @param emailType The type of email (e.g., "follow_up_no_response", "follow_up_needs_revision")
 * @param emailContent The edited email content
 * @returns The saved edited email
 */
export async function saveEditedEmail(
  quoteRequestId: string,
  emailType: string,
  emailContent: {
    subject: string;
    body: string;
    bodyHtml?: string;
  }
) {
  const response = await apiRequest<{ data: any }>(`/api/quote-requests/${quoteRequestId}/edited-emails`, {
    method: 'POST',
    body: JSON.stringify({
      emailType,
      subject: emailContent.subject,
      body: emailContent.body,
      bodyHtml: emailContent.bodyHtml
    })
  });

  return response;
}

/**
 * Get the latest edited email of a specific type
 * @param quoteRequestId The ID of the quote request
 * @param emailType The type of email (e.g., "follow_up_no_response", "follow_up_needs_revision")
 * @returns The latest edited email of the specified type
 */
export async function getLatestEditedEmail(
  quoteRequestId: string,
  emailType: string
) {
  const response = await apiRequest<{ data: any }>(`/api/quote-requests/${quoteRequestId}/edited-emails/latest?type=${emailType}`);
  return response;
}

/**
 * Get all edited emails for a quote request
 * @param quoteRequestId The ID of the quote request
 * @returns All edited emails for the quote request
 */
export async function getEditedEmails(quoteRequestId: string) {
  const response = await apiRequest<{ data: any[] }>(`/api/quote-requests/${quoteRequestId}/edited-emails`);
  return response;
}