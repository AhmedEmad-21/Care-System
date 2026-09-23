# 🩺 دليل تكامل إدارة وتحليلات المرضى للوحة تحكم الـ Staff
## Frontend Integration Guide: Patients Management & Analytics

> **موجه إلى:** مطوري ومصممي الـ Frontend (Next.js / React / Flutter)  
> **تاريخ التحديث:** سبتمبر 2026  
> **الإصدار:** v1.2.0  
> **المسار الأساسي (Base URL):** `http://localhost:5000/api/staff` (أو رابط السيرفر السحابي)

---

## 📑 الفهرس (Table of Contents)
1. [نظرة عامة والمسارات المتاحة (API Cheat Sheet)](#1-نظرة-عامة-والمسارات-المتاحة-api-cheat-sheet)
2. [التوثيق التفصيلي لمسارات الـ Backend](#2-التوثيق-التفصيلي-لمسارات-الـ-backend)
   - [2.1 عرض قائمة المرضى مع البحث والفلترة والترقيم](#21-عرض-قائمة-المرضى-get-apistaffpatients)
   - [2.2 عرض تفاصيل المريض وملخص وسجل حجوزاته](#22-عرض-تفاصيل-المريض-get-apistaffpatientsid)
   - [2.3 تحليلات وإحصائيات المرضى والنمو](#23-تحليلات-وإحصائيات-المرضى-get-apistaffpatientsanalytics)
   - [2.4 تفعيل أو إيقاف حساب المريض](#24-تفعيل-أو-إيقاف-حساب-المريض-patch-apistaffpatientsidstatus)
3. [المطلوب تنفيذه في واجهات الفرونت إند (UI/UX Blueprint)](#3-المطلوب-تنفيذه-في-واجهات-الفرونت-إند-uiux-blueprint)
   - [الشاشة الأولى: صفحة قائمة المرضى (`/dashboard/patients`)](#الشاشة-الأولى-صفحة-قائمة-المرضى-dashboardpatients)
   - [المكون الثاني: دروار تفاصيل المريض وحجوزاته (`Patient Summary Drawer`)](#المكون-الثاني-دروار-تفاصيل-المريض-وحجوزاته-patient-summary-drawer)
   - [الشاشة الثالثة: صفحة تحليلات ونمو المرضى (`/dashboard/patients/analytics`)](#الشاشة-الثالثة-صفحة-تحليلات-ونمو-المرضى-dashboardpatientsanalytics)
4. [نماذج TypeScript Interfaces الجاهزة](#4-نماذج-typescript-interfaces-الجاهزة)
5. [أكواد استدعاء الـ API (API Client Functions)](#5-أكواد-استدعاء-الـ-api-api-client-functions)

---

## 1. نظرة عامة والمسارات المتاحة (API Cheat Sheet)

تتطلب جميع المسارات إرسال الـ `Authorization: Bearer <accessToken>` الخاص بمستخدم ذو صلاحية `Staff` أو `Admin`.

| الطريقة (Method) | المسار (Endpoint) | الوصف | المعلمات الرئيسية (Key Params) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/staff/patients` | استرجاع قائمة المرضى مع ترقيم الصفحات والبحث والفلترة وملخص حجوزات كل مريض | `page`, `limit`, `search`, `accountStatus`, `startDate`, `endDate`, `sortBy`, `order` |
| `GET` | `/api/staff/patients/:id` | جلب الملف الشخصي الكامل للمريض + إحصائيات حجوزاته + سجل كافة حجوزاته أطباء وتمريض | `:id` (Mongo ObjectId للمريض) |
| `GET` | `/api/staff/patients/:id/summary` | مسار بديل متطابق مع السابق لسهولة التكامل | `:id` |
| `GET` | `/api/staff/patients/analytics` | إحصائيات شاملة: إجمالي المرضى، المسجلين اليوم/الأسبوع/الشهر، معدل التحويل، أعلى المرضى حجزاً، ومنحنى النمو | لا يتطلب معلمات |
| `PATCH` | `/api/staff/patients/:id/status` | تجميد أو إعادة تفعيل حساب المريض مع تسجيل الحدث في سجل المراقبة | `accountStatus` (`active` \| `suspended`), `reason` |

---

## 2. التوثيق التفصيلي لمسارات الـ Backend

### 2.1 عرض قائمة المرضى (`GET /api/staff/patients`)

مسار سريع وفعال يستعرض المرضى بشكل مقسّم لصفحات (Paginated) مع حساب ملخص حجوزات كل مريض مباشرة.

* **Headers:**
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

* **Query Parameters:**
  * `page` *(number, optional)*: رقم الصفحة الحالية (الافتراضي: `1`).
  * `limit` *(number, optional)*: عدد السجلات بالصفحة (الافتراضي: `20`، الحد الأقصى: `100`).
  * `search` أو `query` *(string, optional)*: بحث بالاسم أو الهاتف أو البريد الإلكتروني أو العنوان.
  * `accountStatus` *(string, optional)*: `active` أو `suspended`.
  * `startDate` *(string ISO, optional)*: بداية تاريخ تسجيل الحساب (مثل `2026-01-01`).
  * `endDate` *(string ISO, optional)*: نهاية تاريخ تسجيل الحساب (مثل `2026-12-31`).
  * `sortBy` *(string, optional)*: حقل الترتيب (`createdAt` أو `name`، الافتراضي: `createdAt`).
  * `order` *(string, optional)*: اتجاه الترتيب (`desc` أو `asc`، الافتراضي: `desc`).

#### 📤 نموذج الاستجابة الناجحة (200 OK):
```json
{
  "success": true,
  "count": 2,
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
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
    },
    {
      "_id": "64a1b2c3d4e5f6789012345b",
      "name": "مروة حسن السيد",
      "email": "marwa@example.com",
      "phoneNumber": "01123456789",
      "address": "الفيوم - سنورس",
      "profileImage": null,
      "accountStatus": "active",
      "createdAt": "2026-09-18T09:15:00.000Z",
      "stats": {
        "totalBookings": 0,
        "completedBookings": 0,
        "totalSpent": 0,
        "lastBookingDate": null
      }
    }
  ]
}
```

---

### 2.2 عرض تفاصيل المريض (`GET /api/staff/patients/:id`)

يُطلب عند الضغط على اسم المريض أو زر "عرض الملف" لفتح دروار أو مودال تفصيلي يعرض بطاقة بياناته الشخصية، ملخص أرقام حجوزاته، وسجل الحجوزات مجمعة وموحدة بين حجوزات الأطباء والتمريض المنزلي.

* **Headers:**
  ```http
  Authorization: Bearer <accessToken>
  ```

#### 📤 نموذج الاستجابة الناجحة (200 OK):
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

### 2.3 تحليلات وإحصائيات المرضى (`GET /api/staff/patients/analytics`)

يُطلب لتغذية شاشة تحليلات المرضى أو لوحة الـ Dashboard الرئيسية ببيانات النمو والتسجيلات الحديثة.

* **Headers:**
  ```http
  Authorization: Bearer <accessToken>
  ```

#### 📤 نموذج الاستجابة الناجحة (200 OK):
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

### 2.4 تفعيل أو إيقاف حساب المريض (`PATCH /api/staff/patients/:id/status`)

يستخدمه الستاف أو الأدمن لتجميد حساب المريض أو إعادة تفعيله.

* **Headers:**
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
* **Body:**
  ```json
  {
    "accountStatus": "suspended",
    "reason": "ملاحظات إدارية: تكرار طلب حجوزات وهمية"
  }
  ```
  *(ملاحظة: إذا تُرك الـ body فارغاً أو بدون `accountStatus`، فسيتم عكس الحالة الحالية تلقائياً Toggle).*

#### 📤 نموذج الاستجابة الناجحة (200 OK):
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

## 3. المطلوب تنفيذه في واجهات الفرونت إند (UI/UX Blueprint)

لتقديم تجربة مستخدم استثنائية وعصرية تليق بلوحة تحكم الرعاية الصحية، نوصي بتنفيذ الهيكل التالي:

### الشاشة الأولى: صفحة قائمة المرضى (`/dashboard/patients`)

#### 1. شريط الإحصائيات العلوي السريع (Quick Stat Cards)
أعلى الجدول، اعرض 4 كروت صغيرة جذابة (يمكن جلب أرقامها من `GET /api/staff/patients/analytics`):
- **إجمالي المرضى (Total Patients):** مع أيقونة مستخدمين ولون أزرق مريح.
- **مسجلين هذا الشهر (New This Month):** يوضح وتيرة التسجيلات.
- **مرضى نشطين (Active Accounts):** مع شارة خضراء.
- **حسابات موقوفة (Suspended):** مع شارة حمراء/برتقالية للانتباه.

#### 2. شريط البحث والتصفية (Search & Filters Bar)
- **مربع البحث (Search Input):** بحث حي (مع Debounce 400ms) يبحث في الاسم، رقم الهاتف، والبريد.
- **فلتر الحالة (Account Status Dropdown):** خيارات: الكل (All) / نشط (Active) / موقوف (Suspended).
- **فلتر تاريخ التسجيل (Date Range Picker):** لاختيار `startDate` و `endDate`.
- **زر إعادة ضبط الفلاتر (Reset Filters):** لمسح كافة الشروط والعودة للصفحة 1.

#### 3. جدول المرضى التفاعلي (Patients Data Table)
أعمدة الجدول المقترحة:
1. **المريض (Patient Info):** صورة رمزية (Avatar) + الاسم بالكامل + البريد الإلكتروني بخط صغير.
2. **رقم الهاتف (Phone Number):** مع زر نسخ سريع ورابط `tel:`.
3. **العنوان (Address):** مع أيقونة الموقع الجغرافي.
4. **تاريخ التسجيل (Joined Date):** تنسيق تاريخ مقروء (مثال: `15 أغسطس 2026`).
5. **نشاط الحجوزات (Bookings Badge):**
   - كبسولة رقمية توضح إجمالي الحجوزات: `X حجز (Y مكتمل)`.
   - لو `totalBookings === 0` تظهر شارة رمادية لطيفة: "لم يحجز بعد".
6. **حالة الحساب (Status):**
   - Badge أخضر: `نشط (Active)`
   - Badge أحمر/رمادي: `موقوف (Suspended)`
7. **الإجراءات (Actions):**
   - **زر رئيسي:** "عرض التفاصيل والحجوزات" (يفتح الـ Drawer).
   - **زر قائمة منسدلة (Three Dots Menu):**
     - تجميد الحساب / إعادة التفعيل.
     - مراسلة عبر واتساب أو الهاتف.

#### 4. أدوات الترقيم (Pagination Controls)
- عرض: "عرض 1 إلى 20 من إجمالي 45 مريض".
- أزرار السابق والتالي وأرقام الصفحات الحالية.

---

### المكون الثاني: دروار تفاصيل المريض وحجوزاته (`Patient Summary Drawer`)

عند النقر على مريض في الجدول، يفتح درج جانبي (Slide-over Drawer من اليمين في الشاشات العربية RTL):

#### 1. هيدر الدروار (Header)
- صورة البروفايل الكبيرة، اسم المريض، ورقم تعريفه.
- شارة الحالة (Active/Suspended) مع زر تبديل فوري لتجميد/تفعيل الحساب.

#### 2. بطاقة معلومات الاتصال (Contact Card)
- رقم الهاتف (مع زر اتصال مباشر وزر واتساب).
- البريد الإلكتروني.
- العنوان التفصيلي مع رابط لعرض الإحداثيات على الخريطة إن وُجدت.
- تاريخ التسجيل منذ كم يوم/شهر.

#### 3. شريط مؤشرات الحجوزات السريع (Booking KPI Grid)
شبكة من 4 كروت صغيرة داخل الدروار:
- **إجمالي الحجوزات:** (مثلاً: 6) مع توضيح (4 كشف دكتور + 2 تمريض منزلي).
- **المكتملة بنجاح:** (مثلاً: 5).
- **إجمالي المدفوعات:** (مثلاً: `2,150 ج.م`).
- **تاريخ آخر حجز:** (مثلاً: `أمس الساعة 4 عصراً`).

#### 4. سجل الحجوزات الكامل (Bookings History Timeline / Table)
قائمة بالحجوزات مرتبة من الأحدث:
- **شارة نوع الحجز:** 
  - 🩺 `كشف طبيب` (Doctor Booking)
  - 💉 `تمريض منزلي` (Nursing Booking)
- **رقم الحجز:** `#1042`
- **اسم مزود الخدمة:** د. فلان / ممرض فلان مع تخصصه.
- **اسم الخدمة / التخصص:** مثل "كشف باطنة" أو "تركيب كانيولا".
- **الموعد والتاريخ:** `25 سبتمبر 2026 - 11:00 ص`.
- **التكلفة:** `350 ج.م`.
- **شارة الحالة بالألوان المعتمدة:**
  - `completed`: أخضر (مكتمل)
  - `confirmed`: أزرق (مؤكد وقادم)
  - `pending`: برتقالي (معلق وبانتظار الموافقة)
  - `cancelled`: أحمر (ملغي)
- **ملاحظة الاستاف (Staff Note):** في حال وجود ملاحظات مسجلة على الحجز.

---

### الشاشة الثالثة: صفحة تحليلات ونمو المرضى (`/dashboard/patients/analytics`)

صفحة إحصائية غنية بالرسوم البيانية والمؤشرات لمتابعة نمو قاعدة عملاء المنصة:

#### 1. كروت النمو الرئيسية (Growth & Performance Metrics)
- **المسجلين اليوم (Today):** يظهر حركة اليوم الحالية.
- **المسجلين آخر 7 أيام (This Week):** يوضح زخم الأسبوع.
- **المسجلين آخر 30 يوماً (This Month):** مؤشر النمو الشهري.
- **معدل التحويل (Booking Conversion Rate):** نسبة المرضى الذين أتموا حجزاً من إجمالي المسجلين (مثلاً: `70%`).
- **إجمالي إنفاق المرضى (Total Patients Spend):** إجمالي ما تم إنفاقه على المنصة (مثلاً: `185,400 ج.م`).
- **متوسط إنفاق المريض (Average Spend Per Patient):** مقياس القيمة الدورية للعميل (LTV).

#### 2. الرسوم البيانية (Charts)
- **منحنى التسجيلات اليومية (Line Chart):** يعرض التسجيلات اليومية لآخر 14 يوماً من `trends.dailyLast14Days`.
- **شريط النمو الشهري (Bar Chart):** يعرض التسجيلات الشهرية لآخر 6 شهور من `trends.monthlyLast6Months`.
- **الرسم الدائري لنشاط المرضى (Donut Chart):** نسبة المرضى الذين قاموا بحجوزات فعلياً مقابل الذين سجلوا ولم يحجزوا بعد (`bookedPatients` vs `unbookedPatients`).

#### 3. جداول إضافية بالصفحة (Quick Lists)
- **قائمة أحدث المسجلين (Recently Registered Patients):** جدول مصغر بآخر 8 مرضى سجلوا للتواصل الترحيبي معهم.
- **أعلى المرضى نشاطاً وحجزاً (Top Booking Patients Leaderboard):** قائمة بأكثر المرضى ولاءً وحجزاً مع عدد حجوزاتهم وإجمالي ما أنفقوه.

---

## 4. نماذج TypeScript Interfaces الجاهزة

يمكنك نسخ هذا الملف مباشرة إلى مشروع الفرونت إند في مسار `types/patient.ts`:

```typescript
// types/patient.ts

export type AccountStatus = 'active' | 'suspended';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';

export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface PatientStats {
  totalBookings: number;
  completedBookings: number;
  totalSpent: number;
  lastBookingDate: string | null;
}

export interface Patient {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  profileImage: string | null;
  accountStatus: AccountStatus;
  createdAt: string;
  stats?: PatientStats;
  location?: GeoLocation;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PatientsListResponse {
  success: boolean;
  count: number;
  pagination: PaginationMeta;
  data: Patient[];
}

export interface BookingProvider {
  _id: string;
  name: string;
  type: 'Doctor' | 'Nurse';
  specialization: string;
  phoneNumber: string;
  profileImage: string | null;
}

export interface PatientBookingItem {
  _id: string;
  bookingNumber?: number;
  type: 'doctor' | 'nursing';
  provider: BookingProvider | null;
  serviceName: string;
  appointmentTime: string;
  requestLocation?: GeoLocation;
  totalCost: number;
  status: BookingStatus;
  isReviewed: boolean;
  staffNote?: string;
  createdAt: string;
}

export interface DetailedPatientStats {
  totalBookings: number;
  doctorBookingsCount: number;
  nursingBookingsCount: number;
  byStatus: Record<BookingStatus, number>;
  totalSpent: number;
  lastBookingDate: string | null;
  firstBookingDate: string | null;
}

export interface PatientDetailsResponse {
  success: boolean;
  data: {
    patient: Patient;
    stats: DetailedPatientStats;
    bookings: PatientBookingItem[];
  };
}

export interface TopPatientItem {
  _id: string;
  name: string;
  phoneNumber: string;
  email: string;
  profileImage: string | null;
  bookingsCount: number;
  completedBookings: number;
  totalSpent: number;
}

export interface DailyTrendItem {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface MonthlyTrendItem {
  month: string; // YYYY-MM
  count: number;
}

export interface PatientAnalyticsResponse {
  success: boolean;
  data: {
    overview: {
      totalPatients: number;
      activePatients: number;
      suspendedPatients: number;
      bookedPatients: number;
      unbookedPatients: number;
      conversionRate: number;
    };
    growth: {
      registeredToday: number;
      registeredThisWeek: number;
      registeredThisMonth: number;
    };
    financials: {
      totalPatientSpend: number;
      averageSpendPerPatient: number;
    };
    recentPatients: Patient[];
    trends: {
      dailyLast14Days: DailyTrendItem[];
      monthlyLast6Months: MonthlyTrendItem[];
    };
    topPatients: TopPatientItem[];
  };
}
```

---

## 5. أكواد استدعاء الـ API (API Client Functions)

يمكنك وضع هذه الدوال في ملف `services/patientService.ts`:

```typescript
// services/patientService.ts
import {
  PatientsListResponse,
  PatientDetailsResponse,
  PatientAnalyticsResponse,
  AccountStatus,
} from '@/types/patient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * دالة مساعدة لجلب التوكن
 */
function getAuthHeaders(token?: string): HeadersInit {
  const accessToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : '');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * 1. استرجاع قائمة المرضى مع البحث والفلترة والترقيم
 */
export async function getPatients(params?: {
  page?: number;
  limit?: number;
  search?: string;
  accountStatus?: AccountStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}): Promise<PatientsListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.limit) query.append('limit', params.limit.toString());
  if (params?.search) query.append('search', params.search);
  if (params?.accountStatus) query.append('accountStatus', params.accountStatus);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.sortBy) query.append('sortBy', params.sortBy);
  if (params?.order) query.append('order', params.order);

  const res = await fetch(`${API_BASE_URL}/staff/patients?${query.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'فشل في استرجاع قائمة المرضى');
  }

  return res.json();
}

/**
 * 2. جلب تفاصيل مريض محدد مع ملخص وإحصائيات وسجل كافة حجوزاته
 */
export async function getPatientDetails(patientId: string): Promise<PatientDetailsResponse> {
  const res = await fetch(`${API_BASE_URL}/staff/patients/${patientId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'فشل في جلب بيانات المريض');
  }

  return res.json();
}

/**
 * 3. جلب تحليلات وإحصائيات مجتمع المرضى والمسجلين الجدد
 */
export async function getPatientsAnalytics(): Promise<PatientAnalyticsResponse> {
  const res = await fetch(`${API_BASE_URL}/staff/patients/analytics`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'فشل في جلب تحليلات المرضى');
  }

  return res.json();
}

/**
 * 4. تفعيل أو تجميد حساب مريض
 */
export async function updatePatientAccountStatus(
  patientId: string,
  accountStatus: AccountStatus,
  reason?: string
): Promise<{ success: boolean; message: string; data: { _id: string; accountStatus: AccountStatus } }> {
  const res = await fetch(`${API_BASE_URL}/staff/patients/${patientId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ accountStatus, reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'فشل في تغيير حالة الحساب');
  }

  return res.json();
}
```

---

## 6. نصائح لتحسين تجربة المستخدم (UX Best Practices)

1. **التحميل التفاعلي (Skeleton Loaders):**
   - اعرض صفوف رمادية وامضة (Table Skeletons) أثناء تحميل الصفحة الأولى أو عند تغيير رقم الصفحة بدلاً من الشاشات الفارغة.
2. **البحث السريع الذكي (Debounced Search):**
   - استخدم `useDebounce` لمدة `400ms` على حقل البحث لمنع إرسال طلبات متعددة غير ضرورية للسيرفر مع كل حرف يكتبه المستخدم.
3. **التحديث الفوري لحالة الحساب (Optimistic UI Update):**
   - عند الضغط على تجميد أو تفعيل حساب مريض، قم بتحديث الشارة فورياً في الـ UI مع إظهار Toast إشعار بنجاح العملية، وأعد الحالة السابقة فقط إذا حدث خطأ غير متوقع.
4. **ألوان الحالات الموحدة (Consistent Status Colors):**
   - **أخضر (Emerald):** الحجوزات المكتملة (`completed`) والحسابات النشطة (`active`).
   - **أزرق (Indigo/Sky):** الحجوزات المؤكدة القادمة (`confirmed`).
   - **كهرماني/أصفر (Amber):** الحجوزات المعلقة (`pending`).
   - **أحمر (Rose):** الحجوزات الملغاة (`cancelled`) أو الحسابات الموقوفة (`suspended`).
