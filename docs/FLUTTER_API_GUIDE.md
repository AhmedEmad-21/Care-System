# Flutter API Guide

> This document focuses only on the new doctor-matching and password-change flows for frontend integration.

## 1) Change Password

### Endpoint

- PATCH `/api/auth/change-password`
- Requires: `Authorization: Bearer <accessToken>`

### Request body

```json
{
  "currentPassword": "OldPass123@",
  "newPassword": "NewPass456@"
}
```

### Validation

- `currentPassword`: required, minimum 8 chars
- `newPassword`: required, minimum 8 chars, must satisfy the same strength rules as registration/reset password

### Success response

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Error responses

```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

---

## 2) AI Flow: Step 1 - Analyze Symptoms

### Endpoint

- POST `/api/ai/analyze-symptoms`
- Requires: `Authorization: Bearer <accessToken>`

### Request body

```json
{
  "symptoms": "ألم في الصدر ودوخة وصداع",
  "appointmentDate": "2026-09-15T10:00:00.000Z",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

### Notes

- If `requestLocation` is not sent, the server automatically uses the saved user location from the database.
- This action returns a suggested specialty and a `sessionId` for the next step.

### Success response

```json
{
  "success": true,
  "sessionId": "64c9e2...",
  "suggestedSpecialty": "قلب وأوعية دموية",
  "confidence": 0.95,
  "message": "Specialty analyzed successfully"
}
```

---

## 3) AI Flow: Step 2 - Search Doctors

### Endpoint

- POST `/api/ai/search-doctors`
- Requires: `Authorization: Bearer <accessToken>`

### Request body

```json
{
  "specialty": "قلب وأوعية دموية",
  "appointmentDate": "2026-09-15T10:00:00.000Z",
  "requestLocation": {
    "type": "Point",
    "coordinates": [31.2357, 30.0444]
  }
}
```

### Location fallback logic

- If the client sends `requestLocation`, the API uses it directly for `$geoNear` distance calculation.
- If it is empty or missing, the API automatically uses the stored user location from `user.location.coordinates`.

### Success response

```json
{
  "success": true,
  "data": {
    "specialty": "قلب وأوعية دموية",
    "appointmentDate": "2026-09-15T10:00:00.000Z",
    "requestedLocation": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "doctorsFound": [
      {
        "id": "64...",
        "name": "Dr. Sara Ali",
        "specialization": "قلب وأوعية دموية",
        "distance": "2.4km",
        "basePrice": 500,
        "isAvailable": true
      }
    ]
  }
}
```

### Filtering rules

- Doctors are filtered by `specialization`
- Doctors are excluded if `isAvailable` is false
- Doctors are excluded if their `offDays` includes the chosen day of week
- Results are sorted by nearest distance first

---

## 4) Important Notes for Flutter

- Always send `Authorization` header for protected endpoints.
- Keep `GeoJSON` format consistent: `[longitude, latitude]`.
- Prefer `requestLocation` for custom user-selected location.
- For the AI flow, do not call `search-doctors` before receiving `suggestedSpecialty` from the analysis step.
- Handle `success: false` responses with a user-friendly message before retrying.
