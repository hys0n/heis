# API Documentation

## Overview
This document provides comprehensive documentation for the API, including all available endpoints, request and response examples, authentication methods, and profile structures.

## Authentication
To access the API, you must include an authentication token in the request header. The token must be included as follows:

```
Authorization: Bearer <your_token>
```

## Endpoints

### 1. Get User Profile
- **Endpoint:** `GET /api/users/{id}`
- **Description:** Retrieve user profile details.
- **Request Example:**
```http
GET /api/users/123
Authorization: Bearer your_token
```
- **Response Example:**
```json
{
  "id": 123,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "profile": {
    "age": 30,
    "bio": "Software Developer"
  }
}
```

### 2. Update User Profile
- **Endpoint:** `PUT /api/users/{id}`
- **Description:** Update user profile details.
- **Request Example:**
```http
PUT /api/users/123
Authorization: Bearer your_token
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "profile": {
    "age": 31,
    "bio": "Senior Software Developer"
  }
}
```
- **Response Example:**
```json
{
  "message": "Profile updated successfully."
}
```

### 3. Delete User Profile
- **Endpoint:** `DELETE /api/users/{id}`
- **Description:** Delete a user profile.
- **Request Example:**
```http
DELETE /api/users/123
Authorization: Bearer your_token
```
- **Response Example:**
```json
{
  "message": "Profile deleted successfully."
}
```

## Profile Structure
- **id**: Unique identifier for the user.
- **name**: The name of the user.
- **email**: The email address of the user.
- **profile**: An object containing additional profile details.
  - **age**: User's age.
  - **bio**: A brief biography of the user.

---
Please ensure to replace the placeholder `<your_token>` with your actual authentication token when making requests.