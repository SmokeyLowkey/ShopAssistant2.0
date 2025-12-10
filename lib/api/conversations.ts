import { ConversationContext } from "@prisma/client";

// Types for chat conversation API
export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  messageType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  context: ConversationContext;
  isActive: boolean;
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pickLists: any[]; // Will be populated with PickList[] when needed
}

// API functions for chat conversations
export async function getConversations() {
  const response = await fetch("/api/conversations");
  
  if (!response.ok) {
    throw new Error(`Failed to fetch conversations: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getConversation(id: string) {
  const response = await fetch(`/api/conversations/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch conversation: ${response.statusText}`);
  }
  
  return response.json();
}

export async function createConversation(data: { 
  title?: string; 
  context?: ConversationContext;
  vehicleId?: string;
}) {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updateConversation(
  id: string, 
  data: { 
    title?: string; 
    isActive?: boolean;
  }
) {
  const response = await fetch(`/api/conversations/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update conversation: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deleteConversation(id: string) {
  const response = await fetch(`/api/conversations/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
  
  return response.json();
}

// API functions for chat messages
export async function getMessages(conversationId: string) {
  const response = await fetch(`/api/conversations/${conversationId}/messages`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getConversationMessages(conversationId: string) {
  const response = await fetch(`/api/conversations/${conversationId}/messages`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.statusText}`);
  }
  
  return response.json();
}

export async function sendMessage(
  conversationId: string,
  data: {
    content: string;
    context?: any;
  }
) {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }
  
  return response.json();
}