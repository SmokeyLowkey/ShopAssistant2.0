import { PickListStatus } from "@prisma/client";

// Types for pick list API
export interface PickListItem {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  estimatedPrice?: number;
  isOrdered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PickList {
  id: string;
  name: string;
  status: PickListStatus;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  items: PickListItem[];
}

// API functions for pick lists
export async function getPickLists() {
  const response = await fetch("/api/picklists");
  
  if (!response.ok) {
    throw new Error(`Failed to fetch pick lists: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getPickList(id: string) {
  const response = await fetch(`/api/picklists/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch pick list: ${response.statusText}`);
  }
  
  return response.json();
}

export async function createPickList(data: { conversationId: string; name?: string }) {
  const response = await fetch("/api/picklists", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create pick list: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updatePickList(id: string, data: { name?: string; status?: PickListStatus }) {
  const response = await fetch(`/api/picklists/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update pick list: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deletePickList(id: string) {
  const response = await fetch(`/api/picklists/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete pick list: ${response.statusText}`);
  }
  
  return response.json();
}

// API functions for pick list items
export async function getPickListItems(pickListId: string) {
  const response = await fetch(`/api/picklists/${pickListId}/items`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch pick list items: ${response.statusText}`);
  }
  
  return response.json();
}

export async function addPickListItem(
  pickListId: string,
  data: {
    partNumber: string;
    description: string;
    quantity?: number;
    estimatedPrice?: number;
    messageId?: string;
  }
) {
  const response = await fetch(`/api/picklists/${pickListId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add item to pick list: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updatePickListItem(
  pickListId: string,
  itemId: string,
  data: { quantity?: number; isOrdered?: boolean }
) {
  const response = await fetch(`/api/picklists/${pickListId}/items/${itemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update pick list item: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deletePickListItem(pickListId: string, itemId: string) {
  const response = await fetch(`/api/picklists/${pickListId}/items/${itemId}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete pick list item: ${response.statusText}`);
  }
  
  return response.json();
}