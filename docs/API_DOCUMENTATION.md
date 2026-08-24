# Care System — API Documentation

> **Audience:** Frontend Team  
> **Version:** 1.0.0  
> **Base URL:** `http://localhost:3000` (default — configurable via `PORT`)  
> **Timezone:** `Africa/Cairo` (timestamps in responses are normalized to this timezone)

---

## Table of Contents

1. [General Conventions](#1-general-conventions)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Shared Schemas](#3-shared-schemas)
4. [Auth — `/api/auth`](#4-auth--apiauth)
5. [Doctors — `/api/doctors`](#5-doctors--apidoctors)
6. [Nurses — `/api/nurses`](#6-nurses--apinurses)
7. [Bookings — `/api/bookings`](#7-bookings--apibookings)
8. [Nursing Services — `/api/nursing-services`](#8-nursing-services--apinursing-services)
9. [AI — `/api/ai`](#9-ai--apiai)
10. [Staff (Admin Panel) — `/api/staff`](#10-staff-admin-panel--apistaff)
11. [Enums & Constants](#11-enums--constants)
12. [Error Codes Reference](#12-error-codes-reference)

---

## 1. General Conventions

### 1.1 Request Headers

| Header          | Required              | Description            |
| --------------- | --------------------- | ---------------------- |
| `Content-Type`  | Yes (for POST/PATCH)  | `application/json`     |
| `Authorization` | Protected routes only | `Bearer <accessToken>` |

### 1.2 Standard Success Response

All successful responses are wrapped by the response standardizer middleware:

```json
{
  "success": true,
  "message": "done",
  "data": {}
}
```

- If the controller returns extra top-level fields (e.g. `suggestedSpecialty`, `count`), they appear alongside `success` and `message`.
- `message` defaults to `"done"` when not explicitly set by the controller.

### 1.3 Standard Error Response

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": [{ "path": "/fieldName", "message": "validation error detail" }]
}
```

| Field     | Description                                |
| --------- | ------------------------------------------ |
| `code`    | Machine-readable error identifier          |
| `errors`  | Present on AJV validation failures (`400`) |
| `details` | Extra debug info (development mode only)   |
| `stack`   | Stack trace (development mode only)        |

### 1.4 GeoJSON Location Format

All location fields use **GeoJSON Point** format:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```

> **Important:** Coordinates are always `[longitude, latitude]` — NOT lat/lng order.

### 1.5 Date & Time

- ISO 8601 strings for input: `"2026-07-24T14:30:00.000Z"`
- `offDays` uses JavaScript weekday index: `0 = Sunday`, `1 = Monday`, … `6 = Saturday`

### 1.6 Rate Limiting

| Scope                                                        | Limit                         |
| ------------------------------------------------------------ | ----------------------------- |
| Global (all routes)                                          | 100 requests / 15 minutes     |
| Auth routes (`/register`, `/login`, `/reset-password`, etc.) | Stricter auth limiter applied |

---

## 2. Authentication & Authorization

### 2.1 JWT Tokens

After login or register, the API returns:

```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<JWT>"
}
```

| Token         | Default Expiry       | Usage                                     |
| ------------- | -------------------- | ----------------------------------------- |
| Access Token  | `15m` (configurable) | Send in `Authorization: Bearer` header    |
| Refresh Token | `7d` (configurable)  | Send in body to `/api/auth/refresh-token` |

JWT payload contains: `{ id, role, email, tokenType }`

### 2.2 Roles

| Role    | Value     | Access                                          |
| ------- | --------- | ----------------------------------------------- |
| Patient | `Patient` | Default role; bookings, profile, AI             |
| Doctor  | `Doctor`  | View bookings                                   |
| Nurse   | `Nurse`   | View bookings                                   |
| Staff   | `Staff`   | Staff panel (bookings, providers, audit)        |
| Admin   | `Admin`   | Full staff access + analytics + toggle provider |

---

## 3. Shared Schemas

### 3.1 GeoPoint

```json
{
  "type": "object",
  "required": ["type", "coordinates"],
  "properties": {
    "type": { "const": "Point" },
    "coordinates": {
      "type": "array",
      "items": { "type": "number" },
      "minItems": 2,
      "maxItems": 2
    }
  }
}
```

### 3.2 User Object (response)

```json
{
  "_id": "64a1b2c3d4e5f6789012345a",
  "role": "Patient",
  "name": "Ahmed Mohamed",
  "email": "ahmed@example.com",
  "phoneNumber": "01012345678",
  "address": "Cairo, Egypt",
  "profileImage": "https://example.com/photo.jpg",
  "location": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  },
  "accountStatus": "active",
  "vettingStatus": "approved",
  "createdAt": "2026-07-24T09:00:00.000+03:00",
  "updatedAt": "2026-07-24T09:00:00.000+03:00"
}
```

> `passwordHash` is never returned in API responses.

### 3.3 Doctor Object

```json
{
  "_id": "64a1b2c3d4e5f6789012345b",
  "name": "Dr. Sara Ali",
  "phoneNumber": "01098765432",
  "secondaryPhoneNumber": "01198765432",
  "address": "Nasr City, Cairo",
  "specialization": "قلب وأوعية دموية",
  "location": {
    "type": "Point",
    "coordinates": [31.33, 30.05]
  },
  "basePrice": 500,
  "profileImage": "https://example.com/doctor.jpg",
  "addedBy": "64a1b2c3d4e5f6789012345c",
  "workingHours": {
    "start": "09:00",
    "end": "17:00"
  },
  "offDays": [5, 6],
  "isAvailable": true,
  "createdAt": "2026-07-24T09:00:00.000+03:00",
  "updatedAt": "2026-07-24T09:00:00.000+03:00"
}
```

### 3.4 Nurse Object

```json
{
  "_id": "64a1b2c3d4e5f6789012345d",
  "name": "Nurse Fatma",
  "phoneNumber": "01055556666",
  "location": {
    "type": "Point",
    "coordinates": [31.2, 30.01]
  },
  "isAvailable": true,
  "offDays": [5],
  "createdAt": "2026-07-24T09:00:00.000+03:00",
  "updatedAt": "2026-07-24T09:00:00.000+03:00"
}
```

### 3.5 Nursing Service Object

```json
{
  "_id": "64a1b2c3d4e5f6789012345e",
  "name": "Home Injection",
  "description": "Insulin and other injections at home",
  "basePrice": 200,
  "isActive": true,
  "createdAt": "2026-07-24T09:00:00.000+03:00",
  "updatedAt": "2026-07-24T09:00:00.000+03:00"
}
```

### 3.6 Doctor Booking Object

```json
{
  "_id": "64a1b2c3d4e5f6789012345f",
  "patientId": "64a1b2c3d4e5f6789012345a",
  "doctorId": "64a1b2c3d4e5f6789012345b",
  "nurseId": null,
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  },
  "suggestedSpecialty": "قلب وأوعية دموية",
  "appointmentTime": "2026-07-25T10:00:00.000+03:00",
  "totalCost": 500,
  "status": "pending",
  "staffNote": null,
  "confirmedByStaffId": null,
  "createdAt": "2026-07-24T09:00:00.000+03:00",
  "updatedAt": "2026-07-24T09:00:00.000+03:00"
}
```

### 3.7 Nursing Booking Object

```json
{
  "_id": "64a1b2c3d4e5f6789012345g",
  "patientId": "64a1b2c3d4e5f6789012345a",
  "nurseId": "64a1b2c3d4e5f6789012345d",
  "serviceId": "64a1b2c3d4e5f6789012345e",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  },
  "appointmentTime": "2026-07-25T14:00:00.000+03:00",
  "status": "pending",
  "totalCost": 200,
  "staffNote": null,
  "createdAt": "2026-07-24T09:00:00.000+03:00",
  "updatedAt": "2026-07-24T09:00:00.000+03:00"
}
```

---

## 4. Auth — `/api/auth`

### 4.1 Register

|                |                      |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/api/auth/register` |
| **Auth**       | None                 |
| **Rate Limit** | Yes (auth limiter)   |

#### Request Body

| Field            | Type     | Required | Validation                                                                  |
| ---------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `name`           | string   | ✅       | min 1 char                                                                  |
| `email`          | string   | ✅       | valid email                                                                 |
| `password`       | string   | ✅       | min 8 chars                                                                 |
| `phoneNumber`    | string   | ✅       | Egyptian mobile: `^01[0125][0-9]{8}$`                                       |
| `address`        | string   | ✅       | —                                                                           |
| `role`           | string   | ❌       | `Patient` \| `Doctor` \| `Nurse` \| `Staff` \| `Admin` (default: `Patient`) |
| `profileImage`   | string   | ❌       | URL or path                                                                 |
| `location`       | GeoPoint | ❌\*     | Required if `role = Doctor` or `Nurse`                                      |
| `specialization` | string   | ❌\*     | Required if `role = Doctor`                                                 |
| `basePrice`      | number   | ❌\*     | Required if `role = Doctor`, min 0                                          |
| `serviceName`    | string   | ❌       | For Nurse registration                                                      |
| `workingHours`   | object   | ❌       | `{ start: string, end: string }`                                            |
| `offDays`        | number[] | ❌       | 0–6 (weekday index)                                                         |

#### Example Request

```json
{
  "name": "Ahmed Mohamed",
  "email": "ahmed@example.com",
  "password": "SecurePass123",
  "phoneNumber": "01012345678",
  "address": "Maadi, Cairo",
  "location": {
    "type": "Point",
    "coordinates": [31.28, 29.96]
  }
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "user": {
      "_id": "64a1b2c3d4e5f6789012345a",
      "role": "Patient",
      "name": "Ahmed Mohamed",
      "email": "ahmed@example.com",
      "phoneNumber": "01012345678",
      "address": "Maadi, Cairo",
      "location": { "type": "Point", "coordinates": [31.28, 29.96] },
      "accountStatus": "active",
      "vettingStatus": "approved"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

#### Error Responses

| Status | Message              |
| ------ | -------------------- |
| `409`  | Email already exists |
| `400`  | Validation failed    |
| `429`  | Too many requests    |

---

### 4.2 Login

|                |                   |
| -------------- | ----------------- |
| **Method**     | `POST`            |
| **Path**       | `/api/auth/login` |
| **Auth**       | None              |
| **Rate Limit** | Yes               |

#### Request Body

| Field      | Type   | Required | Validation  |
| ---------- | ------ | -------- | ----------- |
| `email`    | string | ✅       | valid email |
| `password` | string | ✅       | min 8 chars |

#### Example Request

```json
{
  "email": "ahmed@example.com",
  "password": "SecurePass123"
}
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "user": {
      /* User Object — see §3.2 */
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

#### Error Responses

| Status | Code           | Message             |
| ------ | -------------- | ------------------- |
| `401`  | `UNAUTHORIZED` | Invalid credentials |

---

### 4.3 Refresh Token

|            |                           |
| ---------- | ------------------------- |
| **Method** | `POST`                    |
| **Path**   | `/api/auth/refresh-token` |
| **Auth**   | None                      |

#### Request Body

| Field          | Type   | Required |
| -------------- | ------ | -------- |
| `refreshToken` | string | ✅       |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Error Responses

| Status | Message                          |
| ------ | -------------------------------- |
| `400`  | Refresh token is required        |
| `401`  | Invalid or expired refresh token |

---

### 4.4 Request Password Reset (Send OTP)

|                |                            |
| -------------- | -------------------------- |
| **Method**     | `POST`                     |
| **Path**       | `/api/auth/reset-password` |
| **Auth**       | None                       |
| **Rate Limit** | Yes                        |

#### Request Body

| Field   | Type   | Required |
| ------- | ------ | -------- |
| `email` | string | ✅       |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "If an account exists for this email, a verification code has been sent."
}
```

> The OTP is sent to the user's email via Nodemailer. It is **never** returned in the API response.

#### Error Responses

| Status | Code                  | Message                                                                    |
| ------ | --------------------- | -------------------------------------------------------------------------- |
| `429`  | `TOO_MANY_REQUESTS`   | Please wait before requesting a new code (cooldown: `OTP_RESEND_COOLDOWN`) |
| `503`  | `SERVICE_UNAVAILABLE` | Unable to send verification code                                           |

---

### 4.5 Verify OTP

|                |                        |
| -------------- | ---------------------- |
| **Method**     | `POST`                 |
| **Path**       | `/api/auth/verify-otp` |
| **Auth**       | None                   |
| **Rate Limit** | Yes                    |

#### Request Body

| Field   | Type   | Required      |
| ------- | ------ | ------------- |
| `email` | string | ✅            |
| `otp`   | string | ✅ (6 digits) |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "OTP verified"
}
```

> After successful verification, the user has **10 minutes** (configurable via `OTP_VERIFIED_WINDOW`) to complete the password reset.

#### Error Responses

| Status | Code                | Message                                                     |
| ------ | ------------------- | ----------------------------------------------------------- |
| `404`  | `NOT_FOUND`         | No reset request found                                      |
| `400`  | `BAD_REQUEST`       | Verification code expired / Invalid verification code       |
| `429`  | `TOO_MANY_REQUESTS` | Maximum verification attempts exceeded (`OTP_MAX_ATTEMPTS`) |

---

### 4.6 Reset Password (Final Step)

|                |                                  |
| -------------- | -------------------------------- |
| **Method**     | `POST`                           |
| **Path**       | `/api/auth/reset-password-final` |
| **Auth**       | None                             |
| **Rate Limit** | Yes                              |

> **Prerequisite:** Must call `/api/auth/verify-otp` successfully first.

#### Request Body

| Field         | Type   | Required         |
| ------------- | ------ | ---------------- |
| `email`       | string | ✅               |
| `newPassword` | string | ✅ (min 8 chars) |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

#### Error Responses

| Status | Message                                               |
| ------ | ----------------------------------------------------- |
| `400`  | Please verify the code before resetting your password |
| `400`  | Verification session expired                          |

### 4.7 Get Current User (Me)

|            |                 |
| ---------- | --------------- |
| **Method** | `GET`           |
| **Path**   | `/api/auth/me`  |
| **Auth**   | ✅ Bearer Token |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "_id": "64a1b2c3d4e5f6789012345a",
    "role": "Patient",
    "name": "Ahmed Mohamed",
    "email": "ahmed@example.com",
    "phoneNumber": "01012345678",
    "address": "Maadi, Cairo",
    "profileImage": null,
    "location": { "type": "Point", "coordinates": [31.28, 29.96] },
    "accountStatus": "active",
    "vettingStatus": "approved"
  }
}
```

> For `Doctor` role, `data.profile` contains the linked Doctor document.  
> For `Nurse` role, `data.profile` contains the linked Nurse document.

---

### 4.8 Update Profile

|            |                     |
| ---------- | ------------------- |
| **Method** | `PATCH`             |
| **Path**   | `/api/auth/profile` |
| **Auth**   | ✅ Bearer Token     |

#### Request Body (all fields optional)

| Field          | Type     | Description       |
| -------------- | -------- | ----------------- |
| `name`         | string   | Display name      |
| `phoneNumber`  | string   | Phone number      |
| `address`      | string   | Address           |
| `location`     | GeoPoint | User location     |
| `profileImage` | string   | Profile image URL |

#### Example Request

```json
{
  "name": "Ahmed M.",
  "phoneNumber": "01099998888",
  "location": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Updated User Object */
  }
}
```

---

### 4.9 Logout

|            |                    |
| ---------- | ------------------ |
| **Method** | `POST`             |
| **Path**   | `/api/auth/logout` |
| **Auth**   | ✅ Bearer Token    |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Logged out"
}
```

---

## 5. Doctors — `/api/doctors`

### 5.1 List Available Doctors

|            |                                            |
| ---------- | ------------------------------------------ |
| **Method** | `GET`                                      |
| **Path**   | `/api/doctors` or `/api/doctors/available` |
| **Auth**   | None                                       |

#### Query Parameters

| Param               | Type              | Required | Description                                                     |
| ------------------- | ----------------- | -------- | --------------------------------------------------------------- |
| `date`              | string (ISO date) | ❌       | Filter out doctors whose `offDays` includes this date's weekday |
| `coordinates`       | string            | ❌       | `"lng,lat"` — enables geo proximity filter                      |
| `location`          | string            | ❌       | Alias for `coordinates`                                         |
| `maxDistanceMeters` | number            | ❌       | Max search radius (default: `20000`)                            |

#### Example

```
GET /api/doctors?date=2026-07-25&coordinates=31.2357,30.0444&maxDistanceMeters=15000
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345b",
      "name": "Dr. Sara Ali",
      "specialization": "قلب وأوعية دموية",
      "basePrice": 500,
      "isAvailable": true,
      "location": { "type": "Point", "coordinates": [31.33, 30.05] },
      "offDays": [5, 6],
      "userId": { "_id": "...", "name": "Dr. Sara Ali" }
    }
  ]
}
```

---

### 5.2 Get Doctor by ID

|            |                    |
| ---------- | ------------------ |
| **Method** | `GET`              |
| **Path**   | `/api/doctors/:id` |
| **Auth**   | None               |

#### Path Parameters

| Param | Type     | Description        |
| ----- | -------- | ------------------ |
| `id`  | ObjectId | Doctor document ID |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Doctor Object — see §3.3 */
  }
}
```

---

### 5.3 Search Available Doctors (Geo + Specialty)

|            |                       |
| ---------- | --------------------- |
| **Method** | `GET`                 |
| **Path**   | `/api/doctors/search` |
| **Auth**   | ✅ Bearer Token       |

> **Note:** Route order in code may cause `:id` to intercept `/search`. Confirm with backend team or use query on list endpoint as fallback.

#### Query Parameters

| Param       | Type              | Required | Description                               |
| ----------- | ----------------- | -------- | ----------------------------------------- |
| `specialty` | string            | ✅       | Doctor specialization (Arabic or English) |
| `lat`       | number            | ✅       | Latitude                                  |
| `long`      | number            | ✅       | Longitude                                 |
| `date`      | string (ISO date) | ❌       | Target appointment date (filters offDays) |

#### Example

```
GET /api/doctors/search?specialty=قلب وأوعية دموية&lat=30.0444&long=31.2357&date=2026-07-25
Authorization: Bearer <token>
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "count": 3,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345b",
      "name": "Dr. Sara Ali",
      "specialization": "قلب وأوعية دموية",
      "basePrice": 500,
      "isAvailable": true,
      "location": { "type": "Point", "coordinates": [31.33, 30.05] },
      "dist": { "calculated": 4523.8 }
    }
  ]
}
```

---

## 6. Nurses — `/api/nurses`

### 6.1 List Available Nurses

|            |                                          |
| ---------- | ---------------------------------------- |
| **Method** | `GET`                                    |
| **Path**   | `/api/nurses` or `/api/nurses/available` |
| **Auth**   | None                                     |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345d",
      "name": "Nurse Fatma",
      "phoneNumber": "01055556666",
      "isAvailable": true,
      "location": { "type": "Point", "coordinates": [31.2, 30.01] },
      "offDays": [5],
      "userId": {
        /* populated User */
      }
    }
  ]
}
```

---

### 6.2 Get Nurse by ID

|            |                   |
| ---------- | ----------------- |
| **Method** | `GET`             |
| **Path**   | `/api/nurses/:id` |
| **Auth**   | None              |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Nurse Object — see §3.4 */
  }
}
```

#### Error Responses

| Status | Message         |
| ------ | --------------- |
| `404`  | Nurse not found |

---

### 6.3 List Nearby Nurses

|            |                      |
| ---------- | -------------------- |
| **Method** | `GET`                |
| **Path**   | `/api/nurses/nearby` |
| **Auth**   | None                 |

#### Query Parameters

| Param  | Type              | Required | Description                        |
| ------ | ----------------- | -------- | ---------------------------------- |
| `lng`  | number            | ✅       | Longitude                          |
| `lat`  | number            | ✅       | Latitude                           |
| `date` | string (ISO date) | ❌       | Filter by offDays for that weekday |

#### Example

```
GET /api/nurses/nearby?lng=31.2357&lat=30.0444&date=2026-07-25
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345d",
      "name": "Nurse Fatma",
      "isAvailable": true,
      "location": { "type": "Point", "coordinates": [31.2, 30.01] },
      "dist": 3200.5
    }
  ]
}
```

> Returns up to 20 nurses within 20 km radius.

---

## 7. Bookings — `/api/bookings`

### 7.1 Create Doctor Booking

|            |                           |
| ---------- | ------------------------- |
| **Method** | `POST`                    |
| **Path**   | `/api/bookings/doctor`    |
| **Auth**   | ✅ Bearer Token (Patient) |

#### Request Body

| Field             | Type               | Required | Validation                          |
| ----------------- | ------------------ | -------- | ----------------------------------- |
| `doctorId`        | string (ObjectId)  | ✅\*     | Doctor ID                           |
| `nurseId`         | string (ObjectId)  | ✅\*     | Alternative to doctorId             |
| `appointmentTime` | string (date-time) | ✅       | ISO 8601                            |
| `requestLocation` | GeoPoint           | ❌       | Patient location at time of booking |

> \*Either `doctorId` or `nurseId` is required (schema uses `anyOf`).

#### Example Request

```json
{
  "doctorId": "64a1b2c3d4e5f6789012345b",
  "appointmentTime": "2026-07-25T10:00:00.000Z",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Doctor Booking Object — see §3.6 */
  }
}
```

> `patientId` is automatically set from the JWT token.  
> `totalCost` is auto-calculated from doctor's `basePrice`.  
> `status` defaults to `"pending"`.

#### Error Responses

| Status | Message           |
| ------ | ----------------- |
| `400`  | Validation failed |
| `404`  | Doctor not found  |

---

### 7.2 Create Nursing Booking

|            |                           |
| ---------- | ------------------------- |
| **Method** | `POST`                    |
| **Path**   | `/api/bookings/nursing`   |
| **Auth**   | ✅ Bearer Token (Patient) |

#### Request Body

| Field             | Type               | Required | Validation                               |
| ----------------- | ------------------ | -------- | ---------------------------------------- |
| `nurseId`         | string (ObjectId)  | ✅       | Nurse ID                                 |
| `serviceId`       | string (ObjectId)  | ✅       | Nursing service ID                       |
| `requestLocation` | GeoPoint           | ✅       | Patient location (required for dispatch) |
| `appointmentTime` | string (date-time) | ❌       | Preferred appointment time               |

#### Example Request

```json
{
  "nurseId": "64a1b2c3d4e5f6789012345d",
  "serviceId": "64a1b2c3d4e5f6789012345e",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  },
  "appointmentTime": "2026-07-25T14:00:00.000Z"
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Nursing Booking Object — see §3.7 */
  }
}
```

#### Error Responses

| Status | Message                                              |
| ------ | ---------------------------------------------------- |
| `400`  | Validation failed / مطلوب تحديد الموقع لإرسال الممرض |
| `404`  | Nurse not found                                      |

---

### 7.3 Get My Bookings

|            |                             |
| ---------- | --------------------------- |
| **Method** | `GET`                       |
| **Path**   | `/api/bookings/my-bookings` |
| **Auth**   | ✅ Bearer Token             |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "doctorBookings": [
      /* Doctor Booking Object[] */
    ],
    "nursingBookings": [
      /* Nursing Booking Object[] */
    ]
  }
}
```

## 8. Nursing Services — `/api/nursing-services`

### 8.1 List Active Services

|            |                         |
| ---------- | ----------------------- |
| **Method** | `GET`                   |
| **Path**   | `/api/nursing-services` |
| **Auth**   | None                    |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345e",
      "name": "Home Injection",
      "description": "Insulin and other injections at home",
      "basePrice": 200,
      "isActive": true
    }
  ]
}
```

---

### 8.2 Get Service Details

|            |                             |
| ---------- | --------------------------- |
| **Method** | `GET`                       |
| **Path**   | `/api/nursing-services/:id` |
| **Auth**   | None                        |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Nursing Service Object — see §3.5 */
  }
}
```

---

## 9. AI — `/api/ai`

### 9.1 Analyze Symptoms & Match Doctors

|            |                                      |
| ---------- | ------------------------------------ |
| **Method** | `POST`                               |
| **Path**   | `/api/ai/analyze` or `/api/ai/match` |
| **Auth**   | ✅ Bearer Token                      |

> Both `/analyze` and `/match` call the same handler.

#### Request Body

| Field               | Type     | Required | Validation                               |
| ------------------- | -------- | -------- | ---------------------------------------- |
| `symptoms`          | string   | ✅       | min 1 char — patient symptom description |
| `appointmentDate`   | string   | ✅       | Target appointment date                  |
| `requestLocation`   | GeoPoint | ❌       | Falls back to user's saved location      |
| `maxDistanceMeters` | number   | ❌       | min 1                                    |

#### Example Request

```json
{
  "symptoms": "I have chest pain and shortness of breath",
  "appointmentDate": "2026-07-25",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "suggestedSpecialty": "قلب وأوعية دموية",
  "doctorsFound": [
    {
      "id": "64a1b2c3d4e5f6789012345b",
      "name": "Dr. Sara Ali",
      "specialization": "قلب وأوعية دموية",
      "distance": "4.5km",
      "isAvailable": true,
      "basePrice": 500
    }
  ]
}
```

#### Error Responses

| Status | Message                                    |
| ------ | ------------------------------------------ |
| `400`  | Symptoms and appointment date are required |
| `400`  | Validation failed (AJV)                    |

---

### 9.2 Suggest Doctors (Rule-Based Matching)

|            |                   |
| ---------- | ----------------- |
| **Method** | `POST`            |
| **Path**   | `/api/ai/suggest` |
| **Auth**   | ✅ Bearer Token   |

#### Request Body

Same schema as [§9.1](#91-analyze-symptoms--match-doctors).

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "specialty": "Cardiology",
    "confidence": 0.93,
    "doctors": [
      /* Doctor Object[] */
    ]
  }
}
```

---

### 9.3 Get Alternatives

|            |                        |
| ---------- | ---------------------- |
| **Method** | `GET`                  |
| **Path**   | `/api/ai/alternatives` |
| **Auth**   | ✅ Bearer Token        |

#### Description

Returns alternative provider suggestions or matching metadata used by AI handlers (convenience endpoint for staff tools).

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    /* alternative providers or matching metadata */
  ]
}
```

---

### 5.2 Specializations

|            |                                |
| ---------- | ------------------------------ |
| **Method** | `GET`                          |
| **Path**   | `/api/doctors/specializations` |
| **Auth**   | None                           |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    "باطنة",
    "صدرية",
    "نفسية",
    "قلب وأوعية دموية",
    "عظام",
    "جلدية",
    "رمد",
    "أسنان",
    "مخ وأعصاب",
    "جهاز هضمي وكبد",
    "أنف وأذن وحنجرة",
    "جراحة عامة",
    "نسا وتوليد",
    "أطفال"
  ]
}
```

---

### 5.3 Get Doctor by ID

## 10. Staff (Admin Panel) — `/api/staff`

> All staff routes require `Authorization: Bearer <token>` with role `Staff` or `Admin` (unless noted).

---

### 10.1 List Pending Bookings

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `GET`                         |
| **Path**   | `/api/staff/bookings/pending` |
| **Auth**   | ✅ Staff / Admin              |

#### Query Parameters

| Param   | Type   | Default | Description |
| ------- | ------ | ------- | ----------- |
| `limit` | number | `50`    | Max results |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345f",
      "patientId": { "name": "Ahmed Mohamed", "phoneNumber": "01012345678" },
      "doctorId": "64a1b2c3d4e5f6789012345b",
      "status": "pending",
      "appointmentTime": null,
      "totalCost": 500,
      "createdAt": "2026-07-24T09:00:00.000+03:00"
    }
  ]
}
```

---

### 10.2 Confirm Booking

|            |                                   |
| ---------- | --------------------------------- |
| **Method** | `PATCH`                           |
| **Path**   | `/api/staff/bookings/:id/confirm` |
| **Auth**   | ✅ Staff / Admin                  |

#### Path Parameters

| Param | Type     | Description |
| ----- | -------- | ----------- |
| `id`  | ObjectId | Booking ID  |

#### Request Body (all optional)

| Field             | Type               | Description                |
| ----------------- | ------------------ | -------------------------- |
| `appointmentTime` | string (date-time) | Confirmed appointment time |
| `staffNote`       | string             | Note to patient            |

#### Example Request

```json
{
  "appointmentTime": "2026-07-25T10:00:00.000Z",
  "staffNote": "Doctor will arrive between 10:00–10:30 AM"
}
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Booking confirmed",
  "data": {
    /* Updated Booking Object with status: "confirmed" */
  }
}
```

---

### 10.3 Cancel Booking

|            |                                  |
| ---------- | -------------------------------- |
| **Method** | `PATCH`                          |
| **Path**   | `/api/staff/bookings/:id/cancel` |
| **Auth**   | ✅ Staff / Admin                 |

#### Request Body

| Field       | Type   | Required |
| ----------- | ------ | -------- |
| `staffNote` | string | ❌       |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Booking cancelled",
  "data": {
    /* Booking Object with status: "cancelled" */
  }
}
```

---

### 10.6 Check Provider Availability

|            |                                     |
| ---------- | ----------------------------------- |
| **Method** | `GET`                               |
| **Path**   | `/api/staff/providers/availability` |
| **Auth**   | ✅ Staff / Admin                    |

#### Query Parameters

| Param             | Type               | Required | Description             |
| ----------------- | ------------------ | -------- | ----------------------- |
| `providerType`    | string             | ✅       | `"doctor"` or `"nurse"` |
| `providerId`      | string (ObjectId)  | ✅       | Provider ID             |
| `appointmentTime` | string (date-time) | ✅       | Time to check           |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "available": true
}
```

---

### 10.7 Doctors Status (All)

|            |                             |
| ---------- | --------------------------- |
| **Method** | `GET`                       |
| **Path**   | `/api/staff/doctors/status` |
| **Auth**   | ✅ Staff / Admin            |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    /* All Doctor Objects */
  ]
}
```

---

### 10.8 Analytics

|            |                        |
| ---------- | ---------------------- |
| **Method** | `GET`                  |
| **Path**   | `/api/staff/analytics` |
| **Auth**   | ✅ Admin only          |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "totalBookings": 142,
    "byStatus": [
      { "_id": "pending", "count": 23 },
      { "_id": "confirmed", "count": 89 },
      { "_id": "cancelled", "count": 30 }
    ]
  }
}
```

---

### 10.9 Toggle Provider Status

|            |                                                |
| ---------- | ---------------------------------------------- |
| **Method** | `PATCH`                                        |
| **Path**   | `/api/staff/providers/:type/:id/toggle-status` |
| **Auth**   | ✅ Admin only                                  |

#### Path Parameters

| Param  | Values              | Description   |
| ------ | ------------------- | ------------- |
| `type` | `doctor` \| `nurse` | Provider type |
| `id`   | ObjectId            | Provider ID   |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    "isAvailable": false
  }
}
```

---

### 10.10 Create Doctor

|            |                      |
| ---------- | -------------------- |
| **Method** | `POST`               |
| **Path**   | `/api/staff/doctors` |
| **Auth**   | ✅ Staff / Admin     |

#### Request Body

| Field                  | Type     | Required | Validation              |
| ---------------------- | -------- | -------- | ----------------------- |
| `name`                 | string   | ✅       | min 1 char              |
| `phoneNumber`          | string   | ✅       | `^01[0125][0-9]{8}$`    |
| `address`              | string   | ✅       | —                       |
| `location`             | GeoPoint | ✅       | —                       |
| `basePrice`            | number   | ✅       | min 0                   |
| `specialization`       | string   | ✅       | —                       |
| `secondaryPhoneNumber` | string   | ❌       | Egyptian mobile pattern |
| `profileImage`         | string   | ❌       | —                       |
| `workingHours`         | object   | ❌       | `{ start, end }`        |
| `offDays`              | number[] | ❌       | 0–6                     |

#### Example Request

```json
{
  "name": "Dr. Sara Ali",
  "phoneNumber": "01098765432",
  "address": "Nasr City, Cairo",
  "specialization": "قلب وأوعية دموية",
  "basePrice": 500,
  "location": {
    "type": "Point",
    "coordinates": [31.33, 30.05]
  },
  "workingHours": { "start": "09:00", "end": "17:00" },
  "offDays": [5, 6]
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Doctor Object */
  }
}
```

#### Error Responses

| Status | Message                                                 |
| ------ | ------------------------------------------------------- |
| `409`  | هذا الطبيب مسجل بالفعل بنفس رقم الهاتف                  |
| `409`  | يوجد طبيب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط |

---

### 10.11 Update Doctor

|            |                          |
| ---------- | ------------------------ |
| **Method** | `PATCH`                  |
| **Path**   | `/api/staff/doctors/:id` |
| **Auth**   | ✅ Staff / Admin         |

#### Request Body (at least one field required by schema)

| Field            | Type     | Validation                 |
| ---------------- | -------- | -------------------------- |
| `basePrice`      | number   | min 0 (required in schema) |
| `specialization` | string   | min 1 char                 |
| `profileImage`   | string   | —                          |
| `workingHours`   | object   | `{ start, end }`           |
| `offDays`        | number[] | 0–6                        |
| `isAvailable`    | boolean  | —                          |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Updated Doctor Object */
  }
}
```

---

### 10.12 List Nursing Services (Staff)

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `GET`                         |
| **Path**   | `/api/staff/nursing-services` |
| **Auth**   | ✅ Staff / Admin              |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    /* All Nursing Service Objects (including inactive) */
  ]
}
```

---

### 10.13 Create Nursing Service

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `POST`                        |
| **Path**   | `/api/staff/nursing-services` |
| **Auth**   | ✅ Staff / Admin              |

#### Request Body

| Field         | Type    | Required | Validation         |
| ------------- | ------- | -------- | ------------------ |
| `name`        | string  | ✅       | min 1 char, unique |
| `basePrice`   | number  | ✅       | min 0              |
| `description` | string  | ❌       | —                  |
| `isActive`    | boolean | ❌       | default `true`     |

#### Example Request

```json
{
  "name": "Wound Dressing",
  "description": "Professional wound care at home",
  "basePrice": 250,
  "isActive": true
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Nursing Service Object */
  }
}
```

#### Error Responses

| Status | Message                  |
| ------ | ------------------------ |
| `409`  | هذه الخدمة موجودة بالفعل |

---

### 10.14 Update Nursing Service

|            |                                   |
| ---------- | --------------------------------- |
| **Method** | `PATCH`                           |
| **Path**   | `/api/staff/nursing-services/:id` |
| **Auth**   | ✅ Staff / Admin                  |

#### Request Body

Same fields as [§10.13 Create Nursing Service](#1013-create-nursing-service).

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Updated Nursing Service Object */
  }
}
```

---

### 10.15 List Audit Logs

|            |                         |
| ---------- | ----------------------- |
| **Method** | `GET`                   |
| **Path**   | `/api/staff/audit-logs` |
| **Auth**   | ✅ Staff / Admin        |

#### Query Parameters

| Param   | Type   | Default |
| ------- | ------ | ------- |
| `limit` | number | `50`    |

#### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "done",
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345h",
      "actorId": "64a1b2c3d4e5f6789012345c",
      "actorRole": "Staff",
      "action": "CREATE_DOCTOR",
      "entityType": "Doctor",
      "entityId": "64a1b2c3d4e5f6789012345b",
      "meta": { "name": "Dr. Sara Ali" },
      "createdAt": "2026-07-24T09:00:00.000+03:00"
    }
  ]
}
```

---

### 10.16 Create Nurse

|            |                     |
| ---------- | ------------------- |
| **Method** | `POST`              |
| **Path**   | `/api/staff/nurses` |
| **Auth**   | ✅ Staff / Admin    |

#### Request Body

| Field         | Type     | Required | Validation                        |
| ------------- | -------- | -------- | --------------------------------- |
| `name`        | string   | ✅       | min 1 char                        |
| `phoneNumber` | string   | ✅       | `^01[0125][0-9]{8}$`              |
| `location`    | GeoPoint | ✅       | —                                 |
| `services`    | string[] | ❌       | Array of NursingService ObjectIds |

#### Example Request

```json
{
  "name": "Nurse Fatma",
  "phoneNumber": "01055556666",
  "location": {
    "type": "Point",
    "coordinates": [31.2, 30.01]
  },
  "services": ["64a1b2c3d4e5f6789012345e"]
}
```

#### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "done",
  "data": {
    /* Nurse Object */
  }
}
```

#### Error Responses

| Status | Message                                                 |
| ------ | ------------------------------------------------------- |
| `409`  | هذا الممرض مسجل بالفعل بنفس رقم الهاتف                  |
| `409`  | يوجد ممرض آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط |

---

## 11. Enums & Constants

### Booking Status

| Value       | Description                                          |
| ----------- | ---------------------------------------------------- |
| `pending`   | Awaiting staff confirmation                          |
| `confirmed` | Confirmed by staff or patient (negotiation accepted) |
| `cancelled` | Cancelled                                            |
| `completed` | Service completed                                    |
| `rejected`  | Rejected                                             |

### User Roles

`Patient` · `Doctor` · `Nurse` · `Staff` · `Admin`

### Account Status

`active` · `suspended`

### Vetting Status

`pending` · `approved` · `rejected`

### Weekday Index (offDays)

| Index | Day       |
| ----- | --------- |
| 0     | Sunday    |
| 1     | Monday    |
| 2     | Tuesday   |
| 3     | Wednesday |
| 4     | Thursday  |
| 5     | Friday    |
| 6     | Saturday  |

### AI Specialty Mapping (English → Arabic DB)

| English (AI output) | Arabic (DB)      |
| ------------------- | ---------------- |
| Cardiology          | قلب وأوعية دموية |
| Dermatology         | جلدية            |
| Ophthalmology       | عيون             |
| Orthopedics         | عظام             |
| Internal Medicine   | باطنة            |
| Dentistry           | أسنان            |
| Gastroenterology    | باطنة            |

---

## 12. Error Codes Reference

| HTTP Status | Code                         | When                                              |
| ----------- | ---------------------------- | ------------------------------------------------- |
| `400`       | `BAD_REQUEST`                | Invalid input, expired OTP                        |
| `400`       | `VALIDATION_ERROR`           | Mongoose validation failure                       |
| `400`       | —                            | AJV schema validation (`errors[]` array included) |
| `401`       | `UNAUTHORIZED`               | Missing/invalid/expired token                     |
| `403`       | `FORBIDDEN`                  | Insufficient role/permission                      |
| `404`       | `NOT_FOUND`                  | Resource not found                                |
| `409`       | `CONFLICT` / `DUPLICATE_KEY` | Duplicate email, phone, or location               |
| `429`       | —                            | Rate limit exceeded                               |
| `500`       | `INTERNAL_SERVER_ERROR`      | Unexpected server error                           |
| `503`       | `DATABASE_CONNECTION_ERROR`  | MongoDB unavailable                               |

---

## Quick Reference — All Endpoints

| #   | Method | Endpoint                                       | Auth | Role        |
| --- | ------ | ---------------------------------------------- | ---- | ----------- |
| 1   | POST   | `/api/auth/register`                           | —    | —           |
| 2   | POST   | `/api/auth/login`                              | —    | —           |
| 3   | POST   | `/api/auth/refresh-token`                      | —    | —           |
| 4   | POST   | `/api/auth/reset-password`                     | —    | —           |
| 5   | POST   | `/api/auth/verify-otp`                         | —    | —           |
| 6   | POST   | `/api/auth/reset-password-final`               | —    | —           |
| 7   | GET    | `/api/auth/me`                                 | ✅   | Any         |
| 8   | PATCH  | `/api/auth/profile`                            | ✅   | Any         |
| 9   | POST   | `/api/auth/logout`                             | ✅   | Any         |
| 10  | GET    | `/api/doctors`                                 | —    | —           |
| 11  | GET    | `/api/doctors/available`                       | —    | —           |
| 12  | GET    | `/api/doctors/specializations`                 | —    | —           |
| 13  | GET    | `/api/doctors/:id`                             | —    | —           |
| 14  | GET    | `/api/doctors/search`                          | ✅   | Any         |
| 15  | GET    | `/api/nurses`                                  | —    | —           |
| 16  | GET    | `/api/nurses/available`                        | —    | —           |
| 17  | GET    | `/api/nurses/nearby`                           | —    | —           |
| 18  | GET    | `/api/nurses/:id`                              | —    | —           |
| 19  | POST   | `/api/bookings/doctor`                         | ✅   | Patient     |
| 20  | POST   | `/api/bookings/nursing`                        | ✅   | Patient     |
| 21  | GET    | `/api/bookings/my-bookings`                    | ✅   | Any         |
| 22  | GET    | `/api/nursing-services`                        | —    | —           |
| 23  | GET    | `/api/nursing-services/:id`                    | —    | —           |
| 24  | POST   | `/api/ai/analyze`                              | ✅   | Any         |
| 25  | POST   | `/api/ai/match`                                | ✅   | Any         |
| 26  | POST   | `/api/ai/suggest`                              | ✅   | Any         |
| 27  | GET    | `/api/ai/alternatives`                         | ✅   | Any         |
| 28  | GET    | `/api/staff/bookings/pending`                  | ✅   | Staff/Admin |
| 29  | PATCH  | `/api/staff/bookings/:id/confirm`              | ✅   | Staff/Admin |
| 30  | PATCH  | `/api/staff/bookings/:id/cancel`               | ✅   | Staff/Admin |
| 31  | GET    | `/api/staff/providers/availability`            | ✅   | Staff/Admin |
| 32  | GET    | `/api/staff/doctors/status`                    | ✅   | Staff/Admin |
| 33  | GET    | `/api/staff/analytics`                         | ✅   | Admin       |
| 34  | PATCH  | `/api/staff/providers/:type/:id/toggle-status` | ✅   | Admin       |
| 35  | POST   | `/api/staff/doctors`                           | ✅   | Staff/Admin |
| 36  | PATCH  | `/api/staff/doctors/:id`                       | ✅   | Staff/Admin |
| 37  | GET    | `/api/staff/nursing-services`                  | ✅   | Staff/Admin |
| 38  | POST   | `/api/staff/nursing-services`                  | ✅   | Staff/Admin |
| 39  | PATCH  | `/api/staff/nursing-services/:id`              | ✅   | Staff/Admin |
| 40  | GET    | `/api/staff/audit-logs`                        | ✅   | Staff/Admin |
| 41  | POST   | `/api/staff/nurses`                            | ✅   | Staff/Admin |

---

*Generated from Care System backend source — `src/routes/`, `src/controllers/`, `src/models/`, and `src/utils/*Validate.js`\*
