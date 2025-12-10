# Testing Plan for Auxiliary Emails Enhancement

This document outlines the testing plan for the auxiliary emails enhancement, which adds name and phone fields to auxiliary emails in the supplier management system.

## 1. Database Migration Testing

### Test Case 1.1: Migration Execution
- **Objective**: Verify that the migration script executes successfully
- **Steps**:
  1. Run the migration command: `npx prisma migrate dev --name add_auxiliary_email_model`
  2. Verify that the migration completes without errors
- **Expected Result**: Migration completes successfully, creating the new `auxiliary_emails` table and updating the `Supplier` model

### Test Case 1.2: Data Migration
- **Objective**: Verify that existing auxiliary emails are migrated correctly
- **Steps**:
  1. Query the database to check if existing auxiliary emails have been migrated to the new table
  2. Verify that each email has been migrated with empty name and phone fields
- **Expected Result**: All existing auxiliary emails are present in the new table with the correct supplier association

## 2. API Endpoints Testing

### Test Case 2.1: GET Endpoint
- **Objective**: Verify that the GET endpoint returns auxiliary emails with name and phone fields
- **Steps**:
  1. Make a GET request to `/api/suppliers/[id]/emails`
  2. Check the response structure
- **Expected Result**: Response includes auxiliary emails with their id, email, name, and phone fields

### Test Case 2.2: POST Endpoint
- **Objective**: Verify that the POST endpoint creates auxiliary emails with name and phone fields
- **Steps**:
  1. Make a POST request to `/api/suppliers/[id]/emails` with email, name, and phone data
  2. Check the response structure
  3. Verify that the auxiliary email is created in the database
- **Expected Result**: Response includes the created auxiliary email with its id, email, name, and phone fields

### Test Case 2.3: DELETE Endpoint
- **Objective**: Verify that the DELETE endpoint removes auxiliary emails
- **Steps**:
  1. Make a DELETE request to `/api/suppliers/[id]/emails/[emailId]`
  2. Check the response
  3. Verify that the auxiliary email is removed from the database
- **Expected Result**: Response indicates success, and the auxiliary email is no longer in the database

### Test Case 2.4: PATCH Endpoint
- **Objective**: Verify that the PATCH endpoint updates name and phone fields
- **Steps**:
  1. Make a PATCH request to `/api/suppliers/[id]/emails/[emailId]` with updated name and phone data
  2. Check the response structure
  3. Verify that the auxiliary email is updated in the database
- **Expected Result**: Response includes the updated auxiliary email with its id, email, name, and phone fields

## 3. UI Testing

### Test Case 3.1: Supplier Edit Page
- **Objective**: Verify that the supplier edit page displays and allows editing of auxiliary emails with name and phone fields
- **Steps**:
  1. Navigate to the supplier edit page
  2. Check if existing auxiliary emails are displayed with name and phone fields
  3. Try to edit the name and phone fields
  4. Try to add a new auxiliary email with name and phone
  5. Try to remove an auxiliary email
- **Expected Result**: All operations work as expected, with proper validation and error handling

### Test Case 3.2: Supplier Detail Page
- **Objective**: Verify that the supplier detail page displays auxiliary emails with name and phone fields
- **Steps**:
  1. Navigate to the supplier detail page
  2. Check if auxiliary emails are displayed with name and phone information
  3. Try to add a new auxiliary email
  4. Try to remove an auxiliary email
- **Expected Result**: All operations work as expected, with proper validation and error handling

### Test Case 3.3: Supplier Creation Page
- **Objective**: Verify that the supplier creation page allows adding auxiliary emails with name and phone fields
- **Steps**:
  1. Navigate to the supplier creation page
  2. Try to add auxiliary emails with name and phone fields
  3. Complete the form and submit
  4. Verify that the supplier is created with the auxiliary emails
- **Expected Result**: All operations work as expected, with proper validation and error handling

## 4. Validation Testing

### Test Case 4.1: Email Validation
- **Objective**: Verify that email validation works correctly
- **Steps**:
  1. Try to add an auxiliary email with an invalid format
  2. Try to add a duplicate auxiliary email
  3. Try to add an auxiliary email that matches the primary email
- **Expected Result**: Appropriate error messages are displayed, and invalid emails are not added

### Test Case 4.2: Name and Phone Validation
- **Objective**: Verify that name and phone fields can be left empty
- **Steps**:
  1. Try to add an auxiliary email with empty name and phone fields
  2. Try to add an auxiliary email with only name
  3. Try to add an auxiliary email with only phone
- **Expected Result**: All combinations work as expected, with name and phone fields being optional

## 5. Error Handling Testing

### Test Case 5.1: API Error Handling
- **Objective**: Verify that API errors are handled correctly
- **Steps**:
  1. Simulate API errors for each endpoint
  2. Check the error responses
- **Expected Result**: Appropriate error messages are returned, with correct HTTP status codes

### Test Case 5.2: UI Error Handling
- **Objective**: Verify that UI errors are handled correctly
- **Steps**:
  1. Simulate API errors while using the UI
  2. Check the error messages displayed to the user
- **Expected Result**: User-friendly error messages are displayed, with appropriate UI feedback

## 6. Backward Compatibility Testing

### Test Case 6.1: Existing Code Compatibility
- **Objective**: Verify that existing code that uses the old auxiliary emails structure still works
- **Steps**:
  1. Identify code that uses the old auxiliary emails structure
  2. Test that code with the new structure
- **Expected Result**: Existing code continues to work without errors

### Test Case 6.2: Data Integrity
- **Objective**: Verify that data integrity is maintained
- **Steps**:
  1. Check that no data is lost during migration
  2. Verify that relationships between suppliers and auxiliary emails are maintained
- **Expected Result**: All data is preserved, and relationships are maintained

## 7. Performance Testing

### Test Case 7.1: Load Testing
- **Objective**: Verify that the system performs well with a large number of auxiliary emails
- **Steps**:
  1. Create a supplier with a large number of auxiliary emails
  2. Test the performance of the supplier detail and edit pages
- **Expected Result**: Pages load and respond quickly, even with a large number of auxiliary emails

## 8. Security Testing

### Test Case 8.1: Authorization
- **Objective**: Verify that only authorized users can access and modify auxiliary emails
- **Steps**:
  1. Test API endpoints with unauthorized users
  2. Test API endpoints with users from different organizations
- **Expected Result**: Unauthorized access is denied with appropriate error messages

## Test Execution Checklist

- [ ] Database Migration Testing
- [ ] API Endpoints Testing
- [ ] UI Testing
- [ ] Validation Testing
- [ ] Error Handling Testing
- [ ] Backward Compatibility Testing
- [ ] Performance Testing
- [ ] Security Testing

## Test Reporting

After executing the tests, document the results, including:
- Test cases that passed
- Test cases that failed
- Issues encountered
- Recommendations for improvements

This testing plan ensures that the auxiliary emails enhancement is thoroughly tested before being deployed to production.