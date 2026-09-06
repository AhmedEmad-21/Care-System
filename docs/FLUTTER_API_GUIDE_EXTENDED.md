# Flutter API Guide - Extended

> **Audience:** Flutter Frontend Team  
> **Purpose:** A practical guide for integrating the latest API additions, including reviews, provider ratings, and the updated AI / booking flows.  
> **Base URL:** `http://localhost:3000`  
> **Timezone:** `Africa/Cairo`

---

## 1. Quick Rules

- Always send `Content-Type: application/json` for `POST` and `PATCH` requests.
- Protected endpoints require `Authorization: Bearer <accessToken>`.
- Geo locations must always use GeoJSON Point format: `[longitude, latitude]`.
- Provider types for reviews are only `Doctor` or `Nurse`.
- Review ratings are integers from `1` to `5`.

---

## 2. Shared Response Shape

### Success

```json
{
  "success": true,
  "message": "done",
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

---

## 3. New Review Feature

This is the main new addition for Flutter integration.

### 3.1 Create or Update a Review

**Endpoint**

- `POST /api/reviews`
- Auth required

**Request body**

```json
{
  "providerId": "66b0f8c8a7d3d3a2ef123456",
  "providerType": "Doctor",
  "rating": 5,
  "comment": "Very professional and friendly."
}
```

**Field rules**

- `providerId`: required, provider document id.
- `providerType`: required, must be `Doctor` or `Nurse`.
- `rating`: required, integer between `1` and `5`.
- `comment`: optional, plain text.

**Behavior**

- If the same logged-in user already reviewed the same provider, the review is updated instead of duplicated.
- A review is accepted only after the user has a completed booking with that provider.
- The provider's `rating` and `totalReviews` are recalculated immediately after save.

**Success response**

```json
{
  "success": true,
  "message": "Review saved successfully",
  "data": {
    "review": {
      "_id": "66b0f9a2a7d3d3a2ef123999",
      "patientId": "66b0f8c8a7d3d3a2ef123000",
      "providerModel": "Doctor",
      "providerId": "66b0f8c8a7d3d3a2ef123456",
      "bookingId": "66b0f8c8a7d3d3a2ef123777",
      "bookingModel": "Booking",
      "rating": 5,
      "comment": "Very professional and friendly.",
      "createdAt": "2026-09-05T10:00:00.000Z",
      "updatedAt": "2026-09-05T10:00:00.000Z"
    },
    "provider": {
      "id": "66b0f8c8a7d3d3a2ef123456",
      "providerModel": "Doctor",
      "rating": 4.8,
      "totalReviews": 25
    }
  }
}
```

---

### 3.2 Get Provider Reviews

**Endpoint**

- `GET /api/reviews/:providerId`
- Public endpoint

**Optional query params**

- `providerType=Doctor|Nurse` to force filtering by type.
- `limit=1..500` to control how many reviews are returned.

**Example**

- `GET /api/reviews/66b0f8c8a7d3d3a2ef123456?providerType=Doctor&limit=20`

**Success response**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66b0f9a2a7d3d3a2ef123999",
      "patientId": {
        "_id": "66b0f8c8a7d3d3a2ef123000",
        "name": "Ahmed Ali",
        "profileImage": "https://..."
      },
      "providerModel": "Doctor",
      "providerId": "66b0f8c8a7d3d3a2ef123456",
      "bookingId": "66b0f8c8a7d3d3a2ef123777",
      "bookingModel": "Booking",
      "rating": 5,
      "comment": "Very professional and friendly.",
      "createdAt": "2026-09-05T10:00:00.000Z",
      "updatedAt": "2026-09-05T10:00:00.000Z"
    }
  ]
}
```

**UI tip**

- Show the newest review first.
- Render reviewer avatar from `reviewerId.profileImage` when available.

---

## 4. Updated Provider Fields

Doctors and nurses now return these extra fields in multiple endpoints:

- `rating`
- `totalReviews`

### Endpoints that now include them

- `GET /api/doctors`
- `GET /api/doctors/available`
- `GET /api/doctors/search`
- `GET /api/doctors/:id`
- `GET /api/nurses`
- `GET /api/nurses/available`
- `GET /api/nurses/nearby`
- `GET /api/nurses/:id`
- `GET /api/bookings/my-bookings`
- `POST /api/ai/search-doctors`

### Example provider object

```json
{
  "_id": "66b0f8c8a7d3d3a2ef123456",
  "name": "Dr. Sarah",
  "specialization": "قلب وأوعية دموية",
  "basePrice": 300,
  "rating": 4.8,
  "totalReviews": 25,
  "profileImage": "https://..."
}
```

---

## 5. Authentication Flow

### 5.1 Change Password

**Endpoint**

- `PATCH /api/auth/change-password`
- Auth required

**Request body**

```json
{
  "currentPassword": "OldPass123@",
  "newPassword": "NewPass456@"
}
```

**Success response**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 6. AI Doctor Matching Flow

### 6.1 Analyze Symptoms

**Endpoint**

- `POST /api/ai/analyze-symptoms`
- Auth required

**Request body**

```json
{
  "symptoms": "ألم في الصدر ودوخة وصداع"
}
```

**Success response**

```json
{
  "success": true,
  "sessionId": "64c9e2...",
  "suggestedSpecialty": "قلب وأوعية دموية"
}
```

### 6.2 Search Doctors

**Endpoint**

- `POST /api/ai/search-doctors`
- Auth required

**Request body**

```json
{
  "specialty": "قلب وأوعية دموية",
  "appointmentDate": "2026-09-15T10:00:00.000Z",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  },
  "maxDistanceMeters": 40000
}
```

**Location fallback**

- If `requestLocation` is sent, the API uses it.
- If it is missing, the backend may use the saved user location when available.

**Success response**

```json
{
  "success": true,
  "data": {
    "specialty": "قلب وأوعية دموية",
    "appointmentDate": "2026-09-15T10:00:00.000Z",
    "requestLocation": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "doctorsFound": [
      {
        "id": "66b0f8c8a7d3d3a2ef123456",
        "name": "Dr. Sarah",
        "specialization": "قلب وأوعية دموية",
        "distance": "1.2km",
        "basePrice": 300,
        "rating": 4.8,
        "totalReviews": 25,
        "isAvailable": true
      }
    ]
  }
}
```

---

## 7. Booking Screens

### 7.1 Doctor Booking

**Endpoint**

- `POST /api/bookings/doctor`
- Auth required

**Request body**

```json
{
  "doctorId": "66b0f8c8a7d3d3a2ef123456",
  "appointmentTime": "2026-09-15T10:00:00.000Z",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

### 7.2 Nursing Booking

**Endpoint**

- `POST /api/bookings/nursing`
- Auth required

**Request body**

```json
{
  "nurseId": "66b0f8c8a7d3d3a2ef888888",
  "serviceId": "66b0f8c8a7d3d3a2ef777777",
  "appointmentTime": "2026-09-15T10:00:00.000Z",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

### 7.3 My Bookings

**Endpoint**

- `GET /api/bookings/my-bookings`
- Auth required

**Important response fields**

- `doctorId.rating`
- `doctorId.totalReviews`
- `nurseId.rating`
- `nurseId.totalReviews`

Use those fields directly in booking history cards.

---

## 8. Booking Validation Rules

The backend now blocks booking abuse before save.

### Active booking conflict

- The user cannot book the same provider again if there is already a `pending` or `confirmed` booking with that doctor or nurse.

### Same-day conflict

- The user cannot create more than one active booking on the same day, even if the second booking is for a different provider type.

### Error messages

- Same provider: `لديك طلب حجز قيد الانتظار أو مؤكد بالفعل مع هذا المزود`
- Same day: `لا يمكنك حجز أكثر من موعد في نفس اليوم`

---

## 9. Review Validation Rules

- Reviews are accepted only when the user has a `completed` booking with the same provider.
- Doctor reviews are checked against `Booking` records.
- Nurse reviews are checked against `NursingBooking` records.
- The review payload still uses `providerId`, `providerType`, `rating`, and `comment`.
- The saved review document also stores the linked `bookingId` and the patient reference.

---

## 10. Recommended Flutter UI Usage

- Show star rating next to doctor/nurse cards.
- Show `totalReviews` as the number of ratings below the stars.
- On provider detail pages, combine the provider summary with `/api/reviews/:providerId`.
- When a review is submitted, refresh both the provider details and reviews list.
- Keep location input in `[longitude, latitude]` order. Do not swap to `[latitude, longitude]`.

---

## 11. Suggested Integration Order

1. Authenticate the user.
2. Load doctor or nurse details and display `rating` and `totalReviews`.
3. Open the reviews list endpoint for the provider detail screen.
4. Submit a new review from the logged-in user.
5. Refresh the provider card and review list after save.

---

## 12. Notes for Error Handling

- If the backend returns `400`, show validation text from the API.
- If the backend returns `401`, redirect to login.
- If a provider is not found, show a not-available state instead of an empty error card.
- If the review API rejects `providerType`, check that the Flutter enum is exactly `Doctor` or `Nurse`.
