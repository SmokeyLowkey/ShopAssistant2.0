import { apiRequest } from './client';

/**
 * Save an edited email to the database
 * @param quoteRequestId The ID of the quote request
 * @param emailType The type of email (e.g., "follow_up_no_response", "follow_up_needs_revision")
 * @param emailContent The edited email content
 * @param supplierId Optional supplier ID for multi-supplier quotes
 * @returns The saved edited email
 */
export async function saveEditedEmail(
  quoteRequestId: string,
  emailType: string,
  emailContent: {
    subject: string;
    body: string;
    bodyHtml?: string;
  },
  supplierId?: string
) {
  const response = await apiRequest<{ data: any }>(`/api/quote-requests/${quoteRequestId}/edited-emails`, {
    method: 'POST',
    body: JSON.stringify({
      emailType,
      subject: emailContent.subject,
      body: emailContent.body,
      bodyHtml: emailContent.bodyHtml,
      supplierId
    })
  });

  return response;
}

/**
 * Get the latest edited email of a specific type
 * @param quoteRequestId The ID of the quote request
 * @param emailType The type of email (e.g., "follow_up_no_response", "follow_up_needs_revision")
 * @param supplierId Optional supplier ID for multi-supplier quotes
 * @returns The latest edited email of the specified type
 */
export async function getLatestEditedEmail(
  quoteRequestId: string,
  emailType: string,
  supplierId?: string
) {
  const url = `/api/quote-requests/${quoteRequestId}/edited-emails/latest?type=${emailType}${supplierId ? `&supplierId=${supplierId}` : ''}`;
  const response = await apiRequest<{ data: any }>(url);
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

/**
 * Delete edited emails for a quote request
 * @param quoteRequestId The ID of the quote request
 * @param emailType The type of email to delete (e.g., "follow_up_no_response", "follow_up_needs_revision")
 * @param supplierId Optional supplier ID for multi-supplier quotes
 * @returns Success response
 */
export async function deleteEditedEmail(
  quoteRequestId: string,
  emailType: string,
  supplierId?: string
) {
  const url = `/api/quote-requests/${quoteRequestId}/edited-emails?type=${emailType}${supplierId ? `&supplierId=${supplierId}` : ''}`;
  const response = await apiRequest<{ success: boolean }>(url, {
    method: 'DELETE'
  });
  return response;
}