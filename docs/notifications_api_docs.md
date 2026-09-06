# Backend Notifications API Docs

> **Audience:** Flutter team and backend maintainers  
> **Scope:** Firebase Cloud Messaging, notification storage, device token management, and booking-triggered notifications  
> **Base URL:** `http://localhost:3000`  
> **Timezone:** `Africa/Cairo`

## 1. What Was Added

The backend now includes a complete notification system built around Firebase Cloud Messaging and MongoDB.

### New backend pieces

- Firebase Admin initialization in [src/config/firebase.js](src/config/firebase.js)
- Device token storage in [src/models/userDeviceTokenModel.js](src/models/userDeviceTokenModel.js)
- Notification storage in [src/models/notificationModel.js](src/models/notificationModel.js)
- Notification API controller in [src/controllers/notificationController.js](src/controllers/notificationController.js)
- Notification routes in [src/routes/notificationRoutes.js](src/routes/notificationRoutes.js)
- Central notification helper in [src/services/notificationService.js](src/services/notificationService.js)
- Booking event integration in [src/services/bookingService.js](src/services/bookingService.js)
- Broadcast and targeted notification delivery for staff/admin users

### New behavior

- The backend saves each notification in the database before attempting to send it through FCM.
- The backend stores device tokens per user and per device.
- The backend removes invalid FCM tokens automatically.
- Booking status changes now trigger notification delivery.
- Staff and admin users can now send broadcast or targeted notifications from the backend.

---

## 2. Why This Matters for Flutter

Flutter no longer needs to maintain a separate notification source.

### Flutter impact

- The notification bell screen should read from `GET /api/notifications`.
- The unread badge should use `unread_count` returned by the same endpoint.
- Device token registration must happen after login or app start.
- Logout should remove the active FCM token from the backend.
- Booking status screens can show a live notification history without relying on push payloads alone.

### UI behavior changes

- Notification list order is now newest first.
- Notification read/unread state is persisted in the database.
- A notification can be opened even if the push message was missed while the app was closed.

### Broadcast impact

- Flutter does not need any special push-specific change for broadcast delivery.
- Broadcast notifications are persisted per recipient, so the same notification center endpoint still works.
- If you later add an admin compose screen in Flutter, it can call the broadcast endpoint directly.

---

## 3. Database Models

### 3.1 `UserDeviceTokens`

Path: [src/models/userDeviceTokenModel.js](src/models/userDeviceTokenModel.js)

#### Fields

- `userId`: reference to the user
- `fcmToken`: unique FCM token
- `deviceType`: `android` or `ios`
- timestamps

#### Rules

- One token record per unique FCM token.
- Tokens are upserted, so re-registering the same token updates the record.
- Invalid tokens are removed automatically when FCM reports them.

### 3.2 `Notifications`

Path: [src/models/notificationModel.js](src/models/notificationModel.js)

#### Fields

- `userId`: notification owner
- `title`: notification title
- `body`: notification body
- `type`: `booking_status`, `nursing`, `general`, and similar categories
- `data`: extra JSON payload
- `isRead`: boolean, default `false`
- timestamps
- `isBroadcast`: boolean, marks a global or bulk notification
- `targetAudience`: stores the audience label such as `all` or `active_users`
- `createdBy`: the staff/admin user that created the notification

#### Rules

- The database is the source of truth for the notification center.
- The UI should not assume push delivery equals notification persistence.

---

## 4. Firebase Setup

Path: [src/config/firebase.js](src/config/firebase.js)

### What it does

- Initializes Firebase Admin using the service account file in `src/config/`
- Uses the modular Firebase Admin API already available in the installed package
- Exposes Firebase messaging through the shared initialized app

### Security note

- The service account JSON is added to `.gitignore`.
- Do not commit Firebase secrets to the repository.

---

## 5. API Endpoints

### 5.1 Register or Update FCM Token

**Method:** `POST`

**URL:** `/api/notifications/fcm-token`

**Auth:** Required

**Request Headers**

```json
{
  "Authorization": "Bearer <accessToken>",
  "Content-Type": "application/json"
}
```

**Request Body**

```json
{
  "fcm_token": "eXamPle_Fcm_ToKeN_StRiNg...",
  "device_type": "android"
}
```

**Success Response**

```json
{
  "status": "success",
  "message": "FCM Token registered successfully"
}
```

### Flutter impact

- Call this after login and after token refresh.
- Store the token in Flutter only as long as needed for sync.
- If the token changes, send the new one again.

---

### 5.2 Delete FCM Token

**Method:** `DELETE`

**URL:** `/api/notifications/fcm-token`

**Auth:** Required

**Request Body**

```json
{
  "fcm_token": "eXamPle_Fcm_ToKeN_StRiNg..."
}
```

**Success Response**

```json
{
  "status": "success",
  "message": "Token removed"
}
```

### Flutter impact

- Call this during logout.
- Remove the local token after a successful response.
- If the user reinstalls the app, a new token registration is expected.

---

### 5.3 Get User Notifications

**Method:** `GET`

**URL:** `/api/notifications`

**Auth:** Required

**Success Response**

```json
{
  "status": "success",
  "unread_count": 2,
  "data": [
    {
      "_id": "66b0f9a2a7d3d3a2ef123999",
      "title": "تم تأكيد الحجز",
      "body": "تم تأكيد موعدك مع د. أحمد علي",
      "type": "booking_status",
      "data": {
        "bookingId": "550",
        "status": "confirmed"
      },
      "isRead": false,
      "createdAt": "2026-09-03T20:30:00.000Z"
    }
  ]
}
```

### Flutter impact

- Use `unread_count` for the badge on the notifications icon.
- Render the list from `data`.
- Show `isRead` visually so the user can distinguish read and unread items.

---

### 5.4 Mark One Notification as Read

**Method:** `PATCH`

**URL:** `/api/notifications/:id/read`

**Auth:** Required

**Success Response**

```json
{
  "status": "success",
  "message": "Notification marked as read"
}
```

### Flutter impact

- Call this when the user taps a notification detail row.
- Update the UI locally after success and re-fetch the list if needed.

---

### 5.5 Mark All Notifications as Read

**Method:** `PATCH`

**URL:** `/api/notifications/read-all`

**Auth:** Required

**Success Response**

```json
{
  "status": "success",
  "message": "All notifications marked as read"
}
```

### Flutter impact

- Use this for a one-tap action like “Mark all as read”.
- Reset the unread badge immediately after success.

---

### 5.6 Delete a Notification

**Method:** `DELETE`

**URL:** `/api/notifications/:id`

**Auth:** Required

**Success Response**

```json
{
  "status": "success",
  "message": "Notification deleted"
}
```

### Flutter impact

- Remove deleted items from the list immediately.
- If the item is currently open, navigate back or show an empty state.

---

### 5.7 Broadcast a Notification

**Method:** `POST`

**URL:** `/api/notifications/broadcast`

**Auth:** Required

**RBAC:** Staff or Admin only

**Request Body**

```json
{
  "title": "صيانة مجدولة",
  "body": "سيتم إجراء صيانة للنظام الليلة من 1 إلى 2 صباحاً",
  "type": "general",
  "targetAudience": "all",
  "data": {
    "maintenance": "true"
  }
}
```

**Success Response**

```json
{
  "status": "success",
  "message": "Broadcast notification sent successfully",
  "data": {
    "successCount": 1200,
    "failureCount": 5,
    "recipientCount": 1200,
    "notificationCount": 1200
  }
}
```

### Flutter impact

- No Flutter change is required to receive this push.
- The notification center will show the same broadcast as a normal in-app notification.
- If you build an admin panel later, use this endpoint to send announcements.

---

### 5.8 Targeted Notification

**Method:** `POST`

**URL:** `/api/notifications/targeted`

**Auth:** Required

**RBAC:** Staff or Admin only

**Request Body**

```json
{
  "title": "متابعة الحجز",
  "body": "تم تحديث أحد الحجوزات الخاصة بك",
  "type": "booking_status",
  "userIds": ["66b0f8c8a7d3d3a2ef123000", "66b0f8c8a7d3d3a2ef123111"],
  "data": {
    "bookingId": "550"
  }
}
```

**Success Response**

```json
{
  "status": "success",
  "message": "Targeted notification sent successfully",
  "data": {
    "successCount": 2,
    "failureCount": 0,
    "recipientCount": 2,
    "notificationCount": 2
  }
}
```

### Flutter impact

- This is useful for administrative or segmented messaging.
- The notification center still reads the same records from `GET /api/notifications`.

---

## 6. Authorization Rules

- `POST /api/notifications/broadcast` is restricted to `Staff` and `Admin`.
- `POST /api/notifications/targeted` is restricted to `Staff` and `Admin`.
- Regular users can only read, mark read, and delete their own notifications.

### Flutter implication

- If you build admin/staff screens in Flutter, check the authenticated role before showing broadcast controls.
- Do not expose broadcast actions to normal users.

---

## 7. Performance Notes

- The backend currently sends FCM requests in chunks to avoid the 500-token multicast ceiling.
- That makes the implementation safer for large recipient sets.
- If `REDIS_URL` is configured, broadcast and targeted sends are queued through BullMQ and processed in the background.
- If Redis is not available, the API falls back to synchronous delivery without changing the response contract.

### Flutter impact

- None on the read side.
- Broadcast delivery may arrive slightly delayed for very large recipient sets, but the notification record is still created immediately.

---

## 8. Central Helper Function

Path: [src/services/notificationService.js](src/services/notificationService.js)

### Main helper

```js
sendNotificationToUser({ userId, title, body, type, data });
```

### What it does

1. Saves the notification in MongoDB.
2. Loads all active FCM tokens for the same user.
3. Sends the push via `sendEachForMulticast`.
4. Deletes invalid or unregistered tokens automatically.

### Important detail

- FCM `data` payload values are converted to strings.
- This is required because FCM expects string values in the `data` object.

### Why Flutter cares

- The push payload and the database notification record now stay in sync.
- Flutter can safely show the notification center even if the device was offline when the push was sent.

---

## 9. Booking Event Integration

Path: [src/services/bookingService.js](src/services/bookingService.js)

### Triggered events

The backend now sends notifications automatically when booking status changes.

### Events covered

- `confirmed`
- `cancelled`
- `completed`
- `rejected`

### Example outcome

When staff confirms a booking:

- The booking status is updated in MongoDB.
- An audit log is written.
- A booking status notification is saved.
- A push message is sent to the patient if a valid token exists.

### Flutter impact

- Booking detail screens can refresh the notification center after a status change.
- Users can rely on in-app notifications even if push delivery was delayed.
- Status labels in the UI should match the backend status values.

---

## 10. Data Contract Summary for Flutter

### Device token registration

- Register token on app start or after login.
- Send `device_type` as `android` or `ios`.

### Notification center

- Fetch with `GET /api/notifications`.
- Use `unread_count` for badge state.
- Use `isRead` to style read/unread rows.

### Push behavior

- Push can be missed.
- Database record remains available.
- The notification center is the fallback and the history source.

### Logout behavior

- Delete the token before clearing the local session.
- Do not leave stale tokens on the server.

---

## 11. Recommended Flutter Flow

1. User logs in.
2. Flutter obtains the FCM token.
3. Flutter calls `POST /api/notifications/fcm-token`.
4. Flutter loads notifications using `GET /api/notifications`.
5. When a notification is tapped, Flutter calls `PATCH /api/notifications/:id/read`.
6. On logout, Flutter calls `DELETE /api/notifications/fcm-token`.

---

## 12. Error Handling Notes

- If the backend returns `401`, redirect the user to login.
- If the backend returns `404`, show an empty or not-found state.
- If the backend returns `400`, display the validation message.
- If FCM delivery fails, the notification still exists in the database.

---

## 13. Files Most Relevant to Review

- [src/config/firebase.js](src/config/firebase.js)
- [src/models/userDeviceTokenModel.js](src/models/userDeviceTokenModel.js)
- [src/models/notificationModel.js](src/models/notificationModel.js)
- [src/services/notificationService.js](src/services/notificationService.js)
- [src/controllers/notificationController.js](src/controllers/notificationController.js)
- [src/routes/notificationRoutes.js](src/routes/notificationRoutes.js)
- [src/services/bookingService.js](src/services/bookingService.js)
- [src/controllers/staffController.js](src/controllers/staffController.js)

---

## 14. Short Conclusion

This change turns notifications into a real backend feature, not just a push-only event. Flutter now has a stable API for device registration, notification listing, read state, and deletion, while the backend guarantees persistence, push delivery, and token cleanup.
