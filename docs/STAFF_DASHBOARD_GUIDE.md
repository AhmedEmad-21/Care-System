# 🩺 Staff & Admin Dashboard — Complete Frontend Integration Guide (`STAFF_DASHBOARD_GUIDE.md`)

> **إلى فريق التطوير والـ Frontend (Flutter & Web):**  
> هذا المستند يمثل الدليل الشامل والمكتمل لجميع الـ Endpoints الخاصة بـ **لوحة تحكم الإدارة (Staff & Admin Panel)**، **لوحة المزودين (Provider Dashboard)**، و**نظام الإشعارات (Notifications System)**.  
> يحتوي كل مسار على تفاصيل الصلاحيات المطلوبة، العناوين، معلمات الاستعلام (Query Parameters)، الهيكل التفصيلي للـ Request، وأمثلة استجابة واقعية لكافة الحالات الناجحة وحالات الأخطاء.

---

## 📋 جدول المحتويات (Table of Contents)

1. [قواعد عامة والتوثيق (General Conventions)](#1-قواعد-عامة-والتوثيق-general-conventions)
2. [إدارة ومتابعة الحجوزات (Bookings Management)](#2-إدارة-ومتابعة-الحجوزات-bookings-management)
3. [التسويات المالية والحجوزات المكتملة (Settlements & Financials)](#3-التسويات-المالية-والحجوزات-المكتملة-settlements--financials)
4. [إدارة مزودي الخدمة والمرضى والمستخدمين (Providers & Patients Management)](#4-إدارة-مزودي-الخدمة-والمستخدمين-providers--users-management) *(دليل مفصل: [`PATIENT_MANAGEMENT_FRONTEND_GUIDE.md`](./PATIENT_MANAGEMENT_FRONTEND_GUIDE.md))*
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
    "totalCommission": 150,
    "settledCommission": 75,
    "pendingCommission": 75,
    "settledAmount": 75,
    "pendingSettlementAmount": 75
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
      "providerEarnings": 425,
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

### 3.2 تنفيذ التسوية الأسبوعية (تحصيل نسبة المنصة من المزود)
* **Method & Path:** `PATCH /api/staff/settlements/settle` (أو `PATCH /api/staff/settlements/pay`)
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** عند الضغط على تسوية الحجوزات، يعني ذلك أن إدارة المنصة قامت بتحصيل عمولتها المستحقة من الطبيب/الممرض وتمت تسوية الحساب. يُحدّث كل من حجوزات الأطباء والتمريض المنزلي.

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
  "message": "تم تسوية وتحصيل نسبة المنصة لـ 2 حجز بنجاح",
  "modifiedCount": 2
}
```

---

## 4. إدارة مزودي الخدمة والمستخدمين (Providers & Users Management)

### 4.0 البحث عن المستخدمين/المرضى للإشعارات الموجهة (Search Users API)
* **Method & Path:** `GET /api/staff/users/search`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `query` *(optional)*: البحث بالاسم أو البريد الإلكتروني أو رقم الهاتف
  * `role` *(optional)*: فلترة حسب نوع الحساب (`Patient`, `Doctor`, `Nurse`, `Staff`, `Admin`)
  * `limit` *(optional)*: أقصى عدد نتائج (الافتراضي: 30)

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345a",
      "name": "أحمد محمد",
      "email": "ahmed@example.com",
      "role": "Patient",
      "phoneNumber": "01012345678",
      "profileImage": null
    }
  ]
}
```

---

### 4.0.1 عرض قائمة كافة المرضى والبحث والفلترة (Patients Directory)
* **Method & Path:** `GET /api/staff/patients`
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** يسترجع هذا المسار قائمة كاملة بالمرضى المسجلين على التطبيق مع دعم الترقيم والبحث الفوري والفلترة بالحالة ونطاق تاريخ التسجيل، ويحسب تلقائياً لكل مريض ملخصاً سريعاً لحجوزاته (إجمالي الحجوزات، المكتملة، وتاريخ آخر حجز).
* **Query Params:**
  * `page` *(optional)*: رقم الصفحة (الافتراضي: `1`).
  * `limit` *(optional)*: عدد العناصر بالصفحة (الافتراضي: `20`، الحد الأقصى: `100`).
  * `query` أو `search` *(optional)*: البحث بالاسم، البريد الإلكتروني، رقم الهاتف، أو العنوان.
  * `accountStatus` *(optional)*: `active` | `suspended`.
  * `startDate` *(optional)*: فلترة تاريخ التسجيل من (مثال: `2026-01-01`).
  * `endDate` *(optional)*: فلترة تاريخ التسجيل إلى (مثال: `2026-12-31`).
  * `sortBy` *(optional)*: حقل الترتيب (`createdAt` أو `name`، الافتراضي: `createdAt`).
  * `order` *(optional)*: اتجاه الترتيب (`desc` أو `asc`، الافتراضي: `desc`).

#### 📥 Request Example:
```http
GET /api/staff/patients?page=1&limit=10&accountStatus=active&search=أحمد HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 1,
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  },
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345a",
      "name": "أحمد محمد محمود",
      "email": "ahmed.patient@example.com",
      "phoneNumber": "01012345678",
      "address": "الفيوم - المسلة - شارع الحرية",
      "profileImage": "https://res.cloudinary.com/care/image/upload/v1/patients/avatar1.jpg",
      "accountStatus": "active",
      "createdAt": "2026-08-15T12:30:00.000Z",
      "stats": {
        "totalBookings": 4,
        "completedBookings": 3,
        "totalSpent": 1250,
        "lastBookingDate": "2026-09-20T14:00:00.000Z"
      }
    }
  ]
}
```

---

### 4.0.2 عرض تفاصيل المريض وملخص وسجل كافة حجوزاته (Patient Details & Bookings Summary)
* **Method & Path:** `GET /api/staff/patients/:id` (أو `GET /api/staff/patients/:id/summary`)
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** يُستخدم هذا المسار عند فتح نافذة أو صفحة بروفايل المريض؛ حيث يعرض بيانات المريض الشخصية، إحصائيات دقيقة لكافة عملياته (أطباء وتمريض منزلي)، وقائمة الحجوزات كاملة مرتبة زمنياً من الأحدث للأقدم.

#### 📥 Request Example:
```http
GET /api/staff/patients/64a1b2c3d4e5f6789012345a HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "patient": {
      "_id": "64a1b2c3d4e5f6789012345a",
      "name": "أحمد محمد محمود",
      "email": "ahmed.patient@example.com",
      "phoneNumber": "01012345678",
      "address": "الفيوم - المسلة - شارع الحرية",
      "location": {
        "type": "Point",
        "coordinates": [30.8428, 29.3084]
      },
      "profileImage": "https://res.cloudinary.com/care/image/upload/v1/patients/avatar1.jpg",
      "accountStatus": "active",
      "createdAt": "2026-08-15T12:30:00.000Z"
    },
    "stats": {
      "totalBookings": 4,
      "doctorBookingsCount": 2,
      "nursingBookingsCount": 2,
      "byStatus": {
        "pending": 0,
        "confirmed": 1,
        "completed": 2,
        "cancelled": 1,
        "rejected": 0
      },
      "totalSpent": 1250,
      "lastBookingDate": "2026-09-20T14:00:00.000Z",
      "firstBookingDate": "2026-08-20T10:00:00.000Z"
    },
    "bookings": [
      {
        "_id": "64b1c2d3e4f5a67890123411",
        "bookingNumber": 1042,
        "type": "doctor",
        "provider": {
          "_id": "64a7b2c1f1a2b3c4d5e6f7a1",
          "name": "د. حازم القاضي",
          "type": "Doctor",
          "specialization": "باطنة وجهاز هضمي",
          "phoneNumber": "01099887766",
          "profileImage": null
        },
        "serviceName": "باطنة وجهاز هضمي",
        "appointmentTime": "2026-09-25T11:00:00.000Z",
        "requestLocation": {
          "type": "Point",
          "coordinates": [30.8428, 29.3084]
        },
        "totalCost": 350,
        "status": "confirmed",
        "isReviewed": false,
        "staffNote": "تم الاتصال بالمريض وتأكيد الموعد",
        "createdAt": "2026-09-20T14:00:00.000Z"
      },
      {
        "_id": "64b1c2d3e4f5a67890123412",
        "bookingNumber": 1025,
        "type": "nursing",
        "provider": {
          "_id": "64a7b2c1f1a2b3c4d5e6f7a9",
          "name": "م. كريم سعيد",
          "type": "Nurse",
          "specialization": "تمريض منزلي",
          "phoneNumber": "01198765432",
          "profileImage": null
        },
        "serviceName": "تركيب كانيولا ومحاليل وريدية",
        "appointmentTime": "2026-09-02T16:00:00.000Z",
        "requestLocation": {
          "type": "Point",
          "coordinates": [30.8428, 29.3084]
        },
        "totalCost": 400,
        "status": "completed",
        "isReviewed": true,
        "staffNote": "",
        "createdAt": "2026-09-02T12:00:00.000Z"
      }
    ]
  }
}
```

---

### 4.0.3 تحليلات وإحصائيات شاملة للمرضى والنمو (Patients Analytics & Insights)
* **Method & Path:** `GET /api/staff/patients/analytics`
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** يقدم هذا المسار لوحة تحليلات متكاملة عن مجتمع المرضى بالمنصة، بما في ذلك: إجمالي الأعداد، المسجلين الجدد (اليوم، هذا الأسبوع، هذا الشهر)، نسب التحويل من تسجيل إلى حجز فعلي، إجمالي إنفاق المرضى ومتوسط الإنفاق، منحنى النمو الزمني (يومي وشهري)، وقائمة بأعلى المرضى طلباً للحجوزات.

#### 📥 Request Example:
```http
GET /api/staff/patients/analytics HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPatients": 350,
      "activePatients": 342,
      "suspendedPatients": 8,
      "bookedPatients": 245,
      "unbookedPatients": 105,
      "conversionRate": 70.0
    },
    "growth": {
      "registeredToday": 6,
      "registeredThisWeek": 28,
      "registeredThisMonth": 94
    },
    "financials": {
      "totalPatientSpend": 185400,
      "averageSpendPerPatient": 757
    },
    "recentPatients": [
      {
        "_id": "64a1b2c3d4e5f67890123499",
        "name": "يوسف خالد رضوان",
        "email": "youssef.k@example.com",
        "phoneNumber": "01099881122",
        "address": "الفيوم - دمو",
        "accountStatus": "active",
        "profileImage": null,
        "createdAt": "2026-09-23T06:15:00.000Z"
      }
    ],
    "trends": {
      "dailyLast14Days": [
        { "date": "2026-09-10", "count": 4 },
        { "date": "2026-09-11", "count": 5 },
        { "date": "2026-09-12", "count": 3 },
        { "date": "2026-09-23", "count": 6 }
      ],
      "monthlyLast6Months": [
        { "month": "2026-04", "count": 35 },
        { "month": "2026-05", "count": 48 },
        { "month": "2026-06", "count": 62 },
        { "month": "2026-07", "count": 78 },
        { "month": "2026-08", "count": 85 },
        { "month": "2026-09", "count": 94 }
      ]
    },
    "topPatients": [
      {
        "_id": "64a1b2c3d4e5f6789012345a",
        "name": "أحمد محمد محمود",
        "phoneNumber": "01012345678",
        "email": "ahmed.patient@example.com",
        "profileImage": null,
        "bookingsCount": 12,
        "completedBookings": 11,
        "totalSpent": 4800
      }
    ]
  }
}
```

---

### 4.0.4 تفعيل أو تجميد حساب مريض (Toggle Patient Account Status)
* **Method & Path:** `PATCH /api/staff/patients/:id/status`
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** يتيح للاستاف تجميد حساب مريض (في حال إساءة الاستخدام أو تكرار الإلغاءات الوهمية) أو إعادة تفعيله، مع تسجيل الحدث بالكامل في الـ `AuditLog`.
* **Request Body:**
  * `accountStatus` *(optional)*: `active` | `suspended` (في حال تركه فارغاً سيتم عكس الحالة الحالية تلقائياً Toggle).
  * `reason` *(optional)*: سبب الإيقاف أو التفعيل للتوثيق الإداري.

#### 📥 Request Example:
```http
PATCH /api/staff/patients/64a1b2c3d4e5f6789012345a/status HTTP/1.1
Host: localhost:3000
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "accountStatus": "suspended",
  "reason": "تكرار طلب كشوفات وهمية وعدم التواجد بالعنوان"
}
```

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "message": "تم تغيير حالة حساب المريض بنجاح إلى موقوف (Suspended)",
  "data": {
    "_id": "64a1b2c3d4e5f6789012345a",
    "name": "أحمد محمد محمود",
    "phoneNumber": "01012345678",
    "accountStatus": "suspended"
  }
}
```

---

### 4.0.1 عرض قائمة الأطباء لوحة التحكم (Staff Doctors List)
* **Method & Path:** `GET /api/staff/doctors`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `query` *(optional)*: البحث بالاسم، التخصص، أو الهاتف
  * `isAvailable` *(optional)*: `true` | `false`
  * `specialization` *(optional)*: التخصص
  * `limit` *(optional)*: الافتراضي 50

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "64a7b2c1f1a2b3c4d5e6f7a1",
      "name": "د. أحمد محمود",
      "specialization": "باطنة",
      "phoneNumber": "01012345678",
      "basePrice": 300,
      "urgentPrice": 450,
      "commissionRate": 12,
      "isAvailable": true,
      "rating": 4.8
    }
  ]
}
```

---

### 4.0.2 عرض قائمة الممرضين لوحة التحكم (Staff Nurses List)
* **Method & Path:** `GET /api/staff/nurses`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `query` *(optional)*: البحث بالاسم أو الهاتف
  * `isAvailable` *(optional)*: `true` | `false`
  * `limit` *(optional)*: الافتراضي 50

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "64a7b2c1f1a2b3c4d5e6f7a9",
      "name": "م. كريم سعيد",
      "phoneNumber": "01198765432",
      "commissionRate": 10,
      "isAvailable": true,
      "rating": 4.9
    }
  ]
}
```

---

### 4.0.3 عرض الحالة المباشرة لجميع الأطباء (Doctors Status)
* **Method & Path:** `GET /api/staff/doctors/status`
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** جلب قائمة بجميع الأطباء المسجلين وحالة توافرهم الحالية.

---

### 4.0.4 عرض الحالة المباشرة لجميع الممرضين (Nurses Status)
* **Method & Path:** `GET /api/staff/nurses/status`
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** جلب قائمة بجميع الممرضين المسجلين وحالة توافرهم الحالية.

---

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
* **الوصف:** يعرض هذا المسار ملخص الحسابات المالية للمزود من منظور إدارة المنصة؛ حيث يستلم المزود قيمة الكشف كاش من المريض، وتقوم المنصة بتحصيل عمولتها منه:
  * `totalRevenue`: إجمالي المبالغ النقدية المحصلة من المرضى بواسطة المزود (مثلاً: 500 ج.م).
  * `totalPlatformCommission`: إجمالي عمولة المنصة المستحقة على المزود (مثلاً 10% = 50 ج.م).
  * `settledAmount` (أو `settledPlatformCommission`): عمولة المنصة التي تم تحصيلها وتسويتها بالفعل من الطبيب (50 ج.م).
  * `pendingSettlementAmount` (أو `pendingPlatformCommission`): عمولة المنصة المعلقة المطلوب تحصيلها من الطبيب (0 ج.م).
  * `totalEarnings`: إجمالي أرباح المنصة من هذا المزود (50 ج.م).
  * `providerEarnings`: صافي ما يتبقى للطبيب بعد استقطاع عمولة المنصة (450 ج.م).

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
    "totalEarnings": 50,
    "settledAmount": 50,
    "pendingSettlementAmount": 0,
    "providerEarnings": 450
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

### 5.0 عرض قائمة حسابات الـ Staff (List Staff Accounts)
* **Method & Path:** `GET /api/staff/accounts`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:**
  * `role` *(optional)*: الافتراضي `Staff`. يقبل `Staff` أو `Admin` أو `all`.
  * `query` *(optional)*: البحث بالاسم، الإيميل، أو الهاتف.
  * `accountStatus` *(optional)*: `active` | `suspended`.
  * `limit` *(optional)*: أقصى عدد نتائج (الافتراضي: 50).

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "64a999887766554433221100",
      "name": "محمود الإداري",
      "email": "staff.mahmoud@clinic.com",
      "phoneNumber": "01099887766",
      "role": "Staff",
      "accountStatus": "active",
      "vettingStatus": "approved",
      "address": "الإدارة",
      "createdAt": "2026-07-24T10:00:00.000Z"
    }
  ]
}
```

---

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

### 7.1 تحليلات وإحصائيات لوحة التحكم (Platform Analytics)
* **Method & Path:** `GET /api/staff/analytics`
* **Auth:** Required (`Staff` or `Admin`)
* **الوصف:** تُرجع الإحصائيات الشاملة للكروت العلوية في صفحة الـ Dashboard الرئيسية:
  * `totalBookings`: إجمالي الحجوزات (الطبية والتمريضية).
  * `completedBookings`: الحجوزات المكتملة.
  * `pendingBookings`, `confirmedBookings`, `cancelledBookings`: تفصيل الحالات.
  * `totalDoctors`: إجمالي الأطباء المسجلين.
  * `activeDoctors`: الأطباء المتاحين حالياً.
  * `totalNurses`: إجمالي الممرضين المسجلين.
  * `activeNurses`: الممرضين المتاحين حالياً.
  * `totalPatients`: إجمالي المرضى المسجلين في المنصة.
  * `pendingSettlementsCount`: عدد الحجوزات المكتملة المعلقة التي لم تسو بعد.
  * `byStatus`: توزيع الحجوزات حسب الحالة لكافة الحالات.
  * `financials`: ملخص مالي كامل لأرباح وعمولات المنصة والتسويات.

#### 📤 Response Example (200 OK):
```json
{
  "success": true,
  "data": {
    "totalBookings": 31,
    "completedBookings": 1,
    "pendingBookings": 30,
    "confirmedBookings": 0,
    "cancelledBookings": 0,
    "totalDoctors": 22,
    "activeDoctors": 22,
    "totalNurses": 26,
    "activeNurses": 26,
    "totalPatients": 13,
    "pendingSettlementsCount": 0,
    "byStatus": [
      { "_id": "pending", "count": 30 },
      { "_id": "confirmed", "count": 0 },
      { "_id": "completed", "count": 1 },
      { "_id": "cancelled", "count": 0 },
      { "_id": "rejected", "count": 0 }
    ],
    "financials": {
      "totalRevenue": 500,
      "totalPlatformCommission": 50,
      "settledPlatformCommission": 50,
      "pendingPlatformCommission": 0,
      "settledAmount": 50,
      "pendingSettlementAmount": 0
    }
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