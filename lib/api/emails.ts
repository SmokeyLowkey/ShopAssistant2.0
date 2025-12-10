import { apiRequest, buildQueryString, QueryParams } from './client';

// Email interfaces
export interface EmailThread {
  id: string;
  subject: string;
  status: string;
  externalThreadId?: string;
  supplierId?: string;
  quoteRequestId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  direction: string;
  from: string;
  to: string;
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  externalMessageId?: string;
  sentAt?: string;
  receivedAt?: string;
  expectedResponseBy?: string;
  followUpSentAt?: string;
  inReplyTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrphanedEmail {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  bodyHtml?: string;
  receivedAt: string;
  supplier: {
    id: string;
    name: string;
    email?: string;
    auxiliaryEmails?: string[];
  };
  externalThreadId?: string;
  messages: EmailMessage[];
}

export interface OrphanedEmailsResponse {
  data: OrphanedEmail[];
}

export interface AssignEmailResponse {
  success: boolean;
  merged?: boolean;
  thread: EmailThread;
}

export interface MergeEmailThreadsResponse {
  success: boolean;
  thread: EmailThread;
}

/**
 * Fetch orphaned emails (emails with supplier but no quote request)
 */
export async function getOrphanedEmails(search?: string): Promise<OrphanedEmailsResponse> {
  const queryParams: QueryParams = {};
  if (search) {
    queryParams.search = search;
  }
  const queryString = buildQueryString(queryParams);
  return apiRequest<OrphanedEmailsResponse>(`/api/emails/orphaned${queryString}`);
}

/**
 * Assign an orphaned email to a quote request
 */
export async function assignOrphanedEmail(threadId: string, quoteRequestId: string): Promise<AssignEmailResponse> {
  try {
    return await apiRequest<AssignEmailResponse>('/api/emails/orphaned/assign', {
      method: 'POST',
      body: JSON.stringify({ threadId, quoteRequestId }),
    });
  } catch (error) {
    console.error('Error in assignOrphanedEmail:', error);
    // Re-throw the error to be handled by the component
    throw error;
  }
}

/**
 * Merge two email threads
 * Moves all messages from the source thread to the target thread and deletes the source thread
 */
export async function mergeEmailThreads(sourceThreadId: string, targetThreadId: string): Promise<MergeEmailThreadsResponse> {
  try {
    return await apiRequest<MergeEmailThreadsResponse>('/api/emails/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceThreadId, targetThreadId }),
    });
  } catch (error) {
    console.error('Error in mergeEmailThreads:', error);
    // Re-throw the error to be handled by the component
    throw error;
  }
}