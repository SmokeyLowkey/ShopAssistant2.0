# Pick Lists Implementation

This document provides information about the database-backed pick lists implementation for the Construction Dashboard application.

## Overview

The pick list functionality has been updated to use database storage instead of local storage. This provides several benefits:

- Pick lists persist across devices and sessions
- Pick lists are associated with specific chat conversations
- Multiple users can access and modify the same pick lists
- Pick lists can be tracked and managed through the database

## Database Schema

The following tables have been added to the database schema:

- `ChatConversation` - Represents a chat conversation with the AI assistant
- `ChatMessage` - Represents messages in a chat conversation
- `ChatPickList` - Represents a pick list associated with a chat conversation
- `ChatPickListItem` - Represents items in a pick list

## API Endpoints

The following API endpoints have been implemented:

### Pick Lists

- `GET /api/picklists` - Get all pick lists for the current user
- `GET /api/picklists/:id` - Get a specific pick list
- `POST /api/picklists` - Create a new pick list
- `PUT /api/picklists/:id` - Update a pick list
- `DELETE /api/picklists/:id` - Delete a pick list

### Pick List Items

- `GET /api/picklists/:id/items` - Get all items in a pick list
- `POST /api/picklists/:id/items` - Add an item to a pick list
- `PUT /api/picklists/:id/items/:itemId` - Update an item in a pick list
- `DELETE /api/picklists/:id/items/:itemId` - Remove an item from a pick list

### Conversations

- `GET /api/conversations` - Get all conversations for the current user
- `GET /api/conversations/:id` - Get a specific conversation
- `POST /api/conversations` - Create a new conversation
- `PUT /api/conversations/:id` - Update a conversation
- `DELETE /api/conversations/:id` - Delete a conversation

### Messages

- `GET /api/conversations/:id/messages` - Get all messages in a conversation
- `POST /api/conversations/:id/messages` - Send a message in a conversation

## Frontend Integration

The pick list functionality has been integrated into the following pages:

- **Parts Page** - Users can create and manage pick lists while chatting with the AI assistant
- **Orders Page** - Users can create orders from pick lists

## How to Reset the Database

To reset the database with the new schema and seed data, run:

```bash
npm run db:reset
```

This will:
1. Drop the existing database
2. Create a new database
3. Apply the Prisma schema
4. Run the seed script to populate the database with sample data

## Sample Data

The seed script creates the following sample data:

- 3 chat conversations (one for each user)
- 9 chat messages across the conversations
- 3 pick lists (one for each conversation)
- 3 pick list items (one for each pick list)

## Backward Compatibility

The implementation maintains backward compatibility with the local storage approach:

- If a pick list exists in local storage, it will be used
- If a pick list exists in the database, it will be used instead
- When creating an order, the pick list is saved to both local storage and the database

## Future Improvements

Potential future improvements include:

- Real-time synchronization of pick lists across devices
- Ability to share pick lists with other users
- Advanced filtering and sorting of pick lists
- Integration with inventory management system
- Analytics on pick list usage and conversion to orders