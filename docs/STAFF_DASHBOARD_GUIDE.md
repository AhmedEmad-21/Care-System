# 🩺 Staff & Admin Dashboard — Complete Frontend Integration Guide (`STAFF_DASHBOARD_GUIDE.md`)

> **إلى فريق التطوير والـ Frontend (Flutter & Web):**  
> هذا المستند يمثل الدليل الشامل والمكتمل لجميع الـ Endpoints الخاصة بـ **لوحة تحكم الإدارة (Staff & Admin Panel)**، **لوحة المزودين (Provider Dashboard)**، و**نظام الإشعارات (Notifications System)**.  
> يحتوي كل مسار على تفاصيل الصلاحيات المطلوبة، العناوين، معلمات الاستعلام (Query Parameters)، الهيكل التفصيلي للـ Request، وأمثلة استجابة واقعية لكافة الحالات الناجحة وحالات الأخطاء.

---

## 📋 جدول المحتويات (Table of Contents)

1. [قواعد عامة والتوثيق (General Conventions)](#1-قواعد-عامة-والتوثيق-general-conventions)
2. [إدارة ومتابعة الحجوزات (Bookings Management)](#2-إدارة-ومتابعة-الحجوزات-bookings-management)
3. [التسويات المالية والحجوزات المكتملة (Settlements & Financials)](#3-التسويات-المالية-والحجوزات-المكتملة-settlements--financials)
4. [إدارة مزودي الخدمة — الأطباء والممرضين (Providers Management)](#4-إدارة-مزودي-الخدمة--الأطباء-والممرضين-providers-management)
5. [إدارة حسابات الإدارة والاستاف (Staff & Admin Accounts)](#5-إدارة-حسابات-الإدارة-والاستاف-staff--admin-accounts)
6. [إدارة الخدمات التمريضية (Nursing Services)](#6-إدارة-الخدمات-التمريضية-nursing-services)
7. [التحليلات وسجلات المراقبة (Analytics & Audit Logs)](#7-التحليلات-وسجلات-المراقبة-analytics--audit-logs)
8. [لوحة المزودين الشخصية (Provider Self-Service Dashboard)](#8-لوحة-المزودين-الشخصية-provider-self-service-dashboard)
9. [نظام الإشعارات والـ FCM (Notifications & Push System)](#9-نظام-الإشعارات-والـ-fcm-notifications--push-system)

---

## 1. قواعد عامة والتوثيق (General Conventions)

### 1.1 العناوين المطلوبة (Headers)
```http
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### 1.2 الصلاحيات ومستويات الوصول (Roles & Permissions)
* **`Admin`**: كامل الصلاحيات (إدارة الأطباء، تعديل الحجوزات، التسويات، التحليلات، تفعيل/تعطيل المزودين، إنشاء حسابات الأدمن والستاف).
* **`Staff`**: إدارة الحجوزات، إضافة المزودين، تنفيذ التسويات المالية، إرسال الإشعارات الجماعية، واستعراض سجل المراقبة.
* **`Doctor` / `Nurse`**: الوصول حصرياً لمسارات لوحة المزودين (`/api/provider-dashboard`).

---

## 2. إدارة ومتابعة الحجوزات (Bookings Management)

### 2.1 عرض ومتابعة كافة الحجوزات مع الفلترة الشاملة
* **Method & Path:** `GET /api/staff/bookings`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `status` *(optional)*: `pending` | `confirmed` | `completed` | `cancelled`
  * `providerId` *(optional)*: Mongo ID للـ Doctor أو Nurse
  * `startDate` *(optional)*: ISO Date e.g. `2026-07-01`
  * `endDate` *(optional)*: ISO Date e.g. `2026-07-31`
  * `limit` *(optional)*: عدد النتائج (default: `50`)

#### 📥 Request Example:
```http
GET /api/staff/bookings?status=pending&limit=10 HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345f",
      "bookingNumber": 10024,
      "patientId": {
        "_id": "64a1b2c3d4e5f6789012345a",
        "name": "أحمد محمد",
        "phoneNumber": "01012345678"
      },
      "doctorId": {
        "_id": "64a1b2c3d4e5f6789012345b",
        "name": "د. سارة علي",
        "specialization": "قلب وأوعية دموية"
      },
      "nurseId": null,
      "status": "pending",
      "totalCost": 500,
      "appointmentTime": "2026-07-25T10:00:00.000Z",
      "createdAt": "2026-07-24T09:00:00.000Z"
    }
  ]
}
```

---

### 2.2 عرض تفاصيل حجز واحد بالكامل
* **Method & Path:** `GET /api/staff/bookings/:id`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Example:
```http
GET /api/staff/bookings/64a1b2c3d4e5f6789012345f HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345f",
    "bookingNumber": 10024,
    "patientId": {
      "_id": "64a1b2c3d4e5f6789012345a",
      "name": "أحمد محمد",
      "phoneNumber": "01012345678",
      "email": "ahmed@example.com"
    },
    "doctorId": {
      "_id": "64a1b2c3d4e5f6789012345b",
      "name": "د. سارة علي",
      "specialization": "قلب وأوعية دموية",
      "basePrice": 500,
      "commissionRate": 15
    },
    "requestLocation": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "status": "pending",
    "totalCost": 500,
    "isSettled": false,
    "createdAt": "2026-07-24T09:00:00.000Z"
  }
}
```

---

### 2.3 إلغاء حجز بـ ID المعرف
* **Method & Path:** `PATCH /api/staff/bookings/:id/cancel`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "staffNote": "تم الإلغاء بناءً على طلب المريض عبر الهاتف"
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "message": "Booking cancelled",
  "data": {
    "_id": "64a1b2c3d4e5f6789012345f",
    "status": "cancelled",
    "staffNote": "تم الإلغاء بناءً على طلب المريض عبر الهاتف",
    "confirmedByStaffId": "64a1b2c3d4e5f67890123499"
  }
}
```

---

### 2.4 إلغاء سريع برقم الحجز التسلسلي (Support Quick Cancel)
* **Method & Path:** `PATCH /api/staff/bookings/cancel-by-number/:bookingNumber`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "staffNote": "إلغاء من قسم خدمة العملاء برقم الحجز"
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "message": "تم إلغاء الحجز بنجاح بناءً على طلب الدعم الفني",
  "data": {
    "bookingNumber": 10024,
    "status": "cancelled"
  }
}
```

---

### 2.5 تعديل حجز يدوياً بواسطة الأدمن (Admin Booking Override)
* **Method & Path:** `PATCH /api/staff/bookings/:id/edit`
* **Auth:** Required (`Admin` Only)

#### 📥 Request Body Example:
```json
{
  "totalCost": 450,
  "status": "confirmed",
  "staffNote": "خصم إداري خاص للمريض"
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "message": "تم تحديث بيانات الحجز بنجاح",
  "data": {
    "_id": "64a1b2c3d4e5f6789012345f",
    "totalCost": 450,
    "status": "confirmed"
  }
}
```

---

## 3. التسويات المالية والحجوزات المكتملة (Settlements & Financials)

### 3.1 عرض الحجوزات المكتملة لغرض التسوية وحساب العمولات
* **Method & Path:** `GET /api/staff/settlements`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `isSettled` *(optional)*: `true` | `false`
  * `providerId` *(optional)*: Mongo ID للمزود
  * `startDate` & `endDate` *(optional)*: ISO Date filter

#### 📥 Request Example:
```http
GET /api/staff/settlements?isSettled=false HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 2,
  "summary": {
    "totalRevenue": 1000,
    "totalCommission": 150
  },
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345f",
      "bookingNumber": 10024,
      "status": "completed",
      "totalCost": 500,
      "isSettled": false,
      "calculatedCommission": 75,
      "appliedCommissionRate": 15,
      "doctorId": {
        "_id": "64a1b2c3d4e5f6789012345b",
        "name": "د. سارة علي",
        "commissionRate": 15
      }
    }
  ]
}
```

---

### 3.2 تنفيذ التسوية الأسبوعية (صرف المستحقات)
* **Method & Path:** `PATCH /api/staff/settlements/pay`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "bookingIds": [
    "64a1b2c3d4e5f6789012345f",
    "64a1b2c3d4e5f6789012345g"
  ]
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "message": "تم تسوية 2 حجز بنجاح",
  "modifiedCount": 2
}
```

---

## 4. إدارة مزودي الخدمة — الأطباء والممرضين (Providers Management)

### 4.1 إضافة طبيب جديد (Create Doctor)
* **Method & Path:** `POST /api/staff/doctors`
* **Auth:** Required (`Staff` or `Admin`)

> ⚠️ **ملاحظة هامة جداً للفرونت إند:** الإحداثيات الجغرافية `location` **إجبارية مطلوبة (Required)** عند إضافة طبيب جديد، وتتكون من GeoJSON Point بصيغة `[longitude, latitude]` (خط الطول ثم خط العرض).

#### 📋 الحقول المطلوبة (Required Fields):
* `name`, `email`, `password`, `phoneNumber`, `address`, `specialization`, `basePrice`, `commissionRate`, `location` (`type: "Point"`, `coordinates: [lng, lat]`).

#### 📥 Request Body Example:
```json
{
  "name": "د. أحمد محمود",
  "email": "dr.ahmed@clinic.com",
  "password": "Password123@",
  "phoneNumber": "01012345678",
  "address": "الفيوم - عمارة الأطباء",
  "specialization": "باطنة",
  "basePrice": 300,
  "urgentPrice": 450,
  "commissionRate": 12,
  "location": {
    "type": "Point",
    "coordinates": [30.8428, 29.3084]
  },
  "workingHours": {
    "start": "09:00",
    "end": "17:00"
  },
  "offDays": [5]
}
```

#### 📤 Response Example (201 Created):
```json
{
  "success": true,
  "data": {
    "doctor": {
      "_id": "64a7b2c1f1a2b3c4d5e6f7a1",
      "name": "د. أحمد محمود",
      "specialization": "باطنة",
      "basePrice": 300,
      "commissionRate": 12,
      "isAvailable": true
    },
    "user": {
      "email": "dr.ahmed@clinic.com",
      "role": "Doctor"
    }
  }
}
```

---

### 4.2 تعديل بيانات طبيب (Update Doctor)
* **Method & Path:** `PATCH /api/staff/doctors/:id`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "basePrice": 350,
  "commissionRate": 10,
  "isAvailable": true
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "64a7b2c1f1a2b3c4d5e6f7a1",
    "name": "د. أحمد محمود",
    "basePrice": 350,
    "commissionRate": 10
  }
}
```

---

### 4.3 إضافة ممرض جديد (Create Nurse)
* **Method & Path:** `POST /api/staff/nurses`
* **Auth:** Required (`Staff` or `Admin`)

> ⚠️ **ملاحظة هامة جداً للفرونت إند:** الإحداثيات الجغرافية `location` **إجبارية مطلوبة (Required)** عند إضافة ممرض جديد، وتتكون من GeoJSON Point بصيغة `[longitude, latitude]` (خط الطول ثم خط العرض).

#### 📋 الحقول المطلوبة (Required Fields):
* `name`, `email`, `password`, `phoneNumber`, `address`, `commissionRate`, `location` (`type: "Point"`, `coordinates: [lng, lat]`).

#### 📥 Request Body Example:
```json
{
  "name": "م. كريم سعيد",
  "email": "nurse.karim@clinic.com",
  "password": "Password123@",
  "phoneNumber": "01198765432",
  "address": "الفيوم - شارع الجمهورية",
  "commissionRate": 10,
  "location": {
    "type": "Point",
    "coordinates": [30.8428, 29.3084]
  },
  "workingHours": {
    "start": "08:00",
    "end": "20:00"
  },
  "offDays": [6]
}
```

#### 📤 Response Example (201 Created):
```json
{
  "success": true,
  "data": {
    "nurse": {
      "_id": "64a7b2c1f1a2b3c4d5e6f7a9",
      "name": "م. كريم سعيد",
      "commissionRate": 10,
      "isAvailable": true
    },
    "user": {
      "email": "nurse.karim@clinic.com",
      "role": "Nurse"
    }
  }
}
```

---

### 4.4 تعديل بيانات ممرض (Update Nurse)
* **Method & Path:** `PATCH /api/staff/nurses/:id`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "address": "الفيوم - شارع البحر",
  "commissionRate": 12,
  "isAvailable": true
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "message": "تم تحديث بيانات الممرض بنجاح",
  "data": {
    "_id": "64a7b2c1f1a2b3c4d5e6f7a9",
    "name": "م. كريم سعيد",
    "commissionRate": 12,
    "isAvailable": true
  }
}
```

---

### 4.5 عرض الملخص المالي التفصيلي لمزود الخدمة (Provider Financial Summary)
* **Method & Path:** `GET /api/staff/providers/:id/financial-summary`
* **Auth:** Required (`Staff` or `Admin`)

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "providerId": "64a7b2c1f1a2b3c4d5e6f7a1",
    "providerName": "د. أحمد محمود",
    "commissionRate": 10,
    "totalCompletedBookings": 1,
    "totalRevenue": 500,
    "totalPlatformCommission": 50,
    "settledPlatformCommission": 50,
    "pendingPlatformCommission": 0,
    "totalEarnings": 450,
    "settledAmount": 450,
    "pendingSettlementAmount": 0
  }
}
```

---

### 4.5 التحقق من إتاحة مزود خدمة (Check Availability)
* **Method & Path:** `GET /api/staff/providers/availability`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `providerType`: `doctor` | `nurse`
  * `providerId`: ID المزود
  * `appointmentTime`: ISO String e.g. `2026-07-25T10:00:00.000Z`

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "available": true
}
```

---

### 4.6 تبديل حالة تفعيل المزود (Admin Toggle Status)
* **Method & Path:** `PATCH /api/staff/providers/:type/:id/toggle-status`
* **Auth:** Required (`Admin` Only)
* **Params:** `:type` = `doctor` or `nurse`, `:id` = Provider ID

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "isAvailable": false
  }
}
```

---

## 5. إدارة حسابات الإدارة والاستاف (Staff & Admin Accounts)

### 5.1 إنشاء حساب Staff أو Admin جديد
* **Method & Path:** `POST /api/staff/accounts`
* **Auth:** Required (`Admin` Only)

#### 📥 Request Body Example:
```json
{
  "name": "محمود الإداري",
  "email": "staff.mahmoud@clinic.com",
  "password": "Password123@",
  "phoneNumber": "01099887766",
  "role": "Staff"
}
```
*(ملاحظة: `role` يقبل `Staff` أو `Admin` فقط).*

#### 📤 Response Example (201 Created):
```json
{
  "success": true,
  "message": "تم إنشاء حساب الـ Staff بنجاح",
  "data": {
    "id": "64a999887766554433221100",
    "name": "محمود الإداري",
    "email": "staff.mahmoud@clinic.com",
    "role": "Staff",
    "phoneNumber": "01099887766"
  }
}
```

---

## 6. إدارة الخدمات التمريضية (Nursing Services)

### 6.1 عرض قائمة الخدمات التمريضية
* **Method & Path:** `GET /api/staff/nursing-services`
* **Auth:** Required (`Staff` or `Admin`)

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345e",
      "name": "حقن وريدي/عضل",
      "description": "إعطاء المحاليل والحقن في المنزل",
      "basePrice": 150,
      "isActive": true
    }
  ]
}
```

---

### 6.2 إنشاء خدمة تمريض جديدة
* **Method & Path:** `POST /api/staff/nursing-services`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "name": "غيار على جرح معقم",
  "description": "تنظيف وتعقيم الجروح بعد العمليات",
  "basePrice": 250,
  "isActive": true
}
```

#### 📤 Response Example (201 Created):
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f67890123999",
    "name": "غيار على جرح معقم",
    "basePrice": 250,
    "isActive": true
  }
}
```

---

## 7. التحليلات وسجلات المراقبة (Analytics & Audit Logs)

### 7.1 تحليلات إحصائيات المنصة العامة
* **Method & Path:** `GET /api/staff/analytics`
* **Auth:** Required (`Admin` Only)

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "totalBookings": 150,
    "byStatus": [
      { "_id": "completed", "count": 110 },
      { "_id": "pending", "count": 25 },
      { "_id": "cancelled", "count": 15 }
    ]
  }
}
```

---

### 7.2 استعراض سجلات عمليات النظام (Audit Logs)
* **Method & Path:** `GET /api/staff/audit-logs`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:** `limit` (default: 50)

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "64b000112233445566778899",
      "actorId": "64a999887766554433221100",
      "actorRole": "Admin",
      "action": "CREATE_DOCTOR",
      "entityType": "Doctor",
      "createdAt": "2026-07-24T10:30:00.000Z"
    }
  ]
}
```

---

## 8. لوحة المزودين الشخصية (Provider Self-Service Dashboard)

*(المسارات المخصصة للطبيب والممرض إدارة جدولهم وحجوزاتهم الخاصة).*

### 8.1 عرض الحجوزات الخاصة بالمزود
* **Method & Path:** `GET /api/provider-dashboard/bookings`
* **Auth:** Required (`Doctor` or `Nurse`)
* **Query Params:** `status`, `date`

---

### 8.2 تأكيد موعد وتحديد وقت الزيارة
* **Method & Path:** `PATCH /api/provider-dashboard/bookings/:id/schedule`
* **Auth:** Required (`Doctor` or `Nurse`)

#### 📥 Request Body Example:
```json
{
  "appointmentTime": "2026-07-25T16:00:00.000Z",
  "status": "confirmed"
}
```

---

### 8.3 تغيير حالة الحجز (مكتمل / ملغي)
* **Method & Path:** `PATCH /api/provider-dashboard/bookings/:id/status`
* **Auth:** Required (`Doctor` or `Nurse`)

#### 📥 Request Body Example:
```json
{
  "status": "completed"
}
```

---

### 8.4 عرض التسويات والعمولات المالية للمزود (الحجوزات المسوية والمستحقة)
* **Method & Path:** `GET /api/provider-dashboard/settlements`
* **Auth:** Required (`Doctor` or `Nurse`)
* **Query Params:** 
  * `isSettled` *(optional)*: `true` (عرض المسوى فقط) | `false` (عرض المستحق وغير المسوى فقط). إذا تم إهمال الحقل، يتم عرض كافة الحجوزات المكتملة.
  * `startDate` & `endDate` *(optional)*: الفلترة بالتاريخ

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 2,
  "summary": {
    "totalRevenue": 1000,
    "totalCommission": 100,
    "settledCommission": 50,
    "pendingCommission": 50,
    "totalProviderEarnings": 900,
    "settledProviderEarnings": 450,
    "pendingProviderEarnings": 450
  },
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345f",
      "bookingNumber": 10024,
      "status": "completed",
      "totalCost": 500,
      "isSettled": false,
      "appliedCommissionRate": 10,
      "calculatedCommission": 50,
      "providerEarnings": 450,
      "patientId": {
        "_id": "64a1b2c3d4e5f6789012345a",
        "name": "أحمد محمد",
        "phoneNumber": "01012345678"
      },
      "updatedAt": "2026-07-24T12:00:00.000Z"
    },
    {
      "_id": "64a1b2c3d4e5f6789012345g",
      "bookingNumber": 10025,
      "status": "completed",
      "totalCost": 500,
      "isSettled": true,
      "appliedCommissionRate": 10,
      "calculatedCommission": 50,
      "providerEarnings": 450,
      "patientId": {
        "_id": "64a1b2c3d4e5f6789012345b",
        "name": "محمود سمير",
        "phoneNumber": "01099887766"
      },
      "updatedAt": "2026-07-20T10:00:00.000Z"
    }
  ]
}
```

---

### 8.5 تحديث أيام الإجازة الأسبوعية (Off Days)
* **Method & Path:** `PATCH /api/provider-dashboard/off-days`
* **Auth:** Required (`Doctor` or `Nurse`)

#### 📥 Request Body Example:
```json
{
  "offDays": [4, 5]
}
```

---

## 9. نظام الإشعارات والـ FCM (Notifications & Push System)

### 9.1 تسجيل رمز الجهاز (Register FCM Device Token)
* **Method & Path:** `POST /api/notifications/fcm-token`
* **Auth:** Required (Any Logged-in User)

#### 📥 Request Body Example:
```json
{
  "fcm_token": "fcm_token_sample_string_12345",
  "device_type": "android"
}
```

#### 📤 Response Example (200 OK):
```json
{
  "status": "success",
  "message": "FCM Token registered successfully"
}
```

---

### 9.2 حذف رمز الجهاز عند تسجيل الخروج
* **Method & Path:** `DELETE /api/notifications/fcm-token`
* **Auth:** Required (Any Logged-in User)

#### 📥 Request Body Example:
```json
{
  "fcm_token": "fcm_token_sample_string_12345"
}
```

---

### 9.3 جلب إشعارات المستخدم وعدد الغير مقروء
* **Method & Path:** `GET /api/notifications`
* **Auth:** Required (Any Logged-in User)

#### 📤 Response Example (200 OK):
```json
{
  "status": "success",
  "unread_count": 2,
  "data": [
    {
      "_id": "64c000112233445566778899",
      "title": "تأكيد الحجز",
      "body": "تم تأكيد حجزك بنجاح مع د. سارة علي",
      "isRead": false,
      "createdAt": "2026-07-24T11:00:00.000Z"
    }
  ]
}
```

---

### 9.4 تحديد إشعار كمقروء / تحديد الكل كمقروء
* **تحديد واحد:** `PATCH /api/notifications/:id/read`
* **تحديد الكل:** `PATCH /api/notifications/read-all`

---

### 9.5 إرسال إشعار جماعي (Broadcast Notification)
* **Method & Path:** `POST /api/notifications/broadcast`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "title": "تحديث هامة في المنصة",
  "body": "تم إضافة خدمات جديدة للتطبيق",
  "type": "general",
  "targetAudience": "all"
}
```

#### 📤 Response Example (201 Created):
```json
{
  "status": "success",
  "message": "Broadcast notification sent successfully",
  "data": {
    "title": "تحديث هامة في المنصة",
    "targetAudience": "all"
  }
}
```

---

### 9.6 إرسال إشعار موجه لعدّة مستخدمين (Targeted Notification)
* **Method & Path:** `POST /api/notifications/targeted`
* **Auth:** Required (`Staff` or `Admin`)

#### 📥 Request Body Example:
```json
{
  "title": "تذكير بالموعد",
  "body": "يرجى الحضور قبل الموعد بـ 15 دقيقة",
  "type": "booking_reminder",
  "userIds": [
    "64a1b2c3d4e5f6789012345a",
    "64a1b2c3d4e5f6789012345b"
  ],
  "data": {
    "bookingId": "64a1b2c3d4e5f6789012345f"
  }
}
```

#### 📤 Response Example (201 Created):
```json
{
  "status": "success",
  "message": "Targeted notification sent successfully",
  "data": {
    "recipientCount": 2
  }
}
```