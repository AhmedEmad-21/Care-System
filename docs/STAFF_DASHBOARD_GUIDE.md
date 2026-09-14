إليك الملف الشامل والمحدث `STAFF_DASHBOARD_GUIDE.md` كاملاً ومدمجاً بجميع الـ Endpoints الخاصة بإدارة الحجوزات، التسويات، مزودي الخدمة، حسابات الاستاف، والآن مضافاً إليها **قسم الإشعارات (Notifications)** بالكامل لتسليمه لفريق الفلاتر كمرجع واحد متكامل:

---

# 🩺 Staff & Admin Dashboard — Frontend Integration Guide (`STAFF_DASHBOARD_GUIDE.md`)

> **إلى فريق الفلاتر:** هذا المستند يمثل الدليل الشامل المحدث لجميع الـ Endpoints الخاصة بلوحة تحكم الإدارة (Staff & Admin Panel)، متضمنةً صلاحيات الحجوزات، التسويات المالية، إدارة مزودي الخدمة، ونظام الإشعارات بالكامل.

---

## 1. إدارة ومتابعة الحجوزات (Bookings Management & Tracking)

### أ. عرض ومتابعة جميع الحجوزات (All Bookings with Filters)

* **Endpoint:** `GET /api/staff/bookings`
* **Auth:** Required (`Staff` or `Admin`)


* **Query Params المتاحة للفلاتر:**
* `status`: تصفية حسب الحالة (`pending`, `confirmed`, `completed`, `cancelled`).


* `providerId`: معرف الطبيب أو الممرض.


* `startDate` & `endDate`: تصفية ضمن نطاق زمني.


* `limit`: الحد الأقصى للنتائج (افتراضياً 50).




* **مثال عملي للـ Request:**
```http
GET /api/staff/bookings?status=confirmed&providerId=64a7b2c1f1a2b3c4d5e6f7a1&startDate=2026-07-01&endDate=2026-07-07

```



### ب. عرض تفاصيل حجز واحد بالكامل (Get Single Booking Details)

* **Endpoint:** `GET /api/staff/bookings/:id`
* **Auth:** Required (`Staff` or `Admin`)

### ج. إلغاء حجز بالطريقة العادية (Cancel Booking)

* **Endpoint:** `PATCH /api/staff/bookings/:id/cancel`
* **Auth:** Required (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "staffNote": "اعتذار المريض عن الحضور لظروف طارئة"
}

```



### د. إلغاء حجز برقم الحجز التسلسلي (Support Quick Cancellation)

* **Endpoint:** `PATCH /api/staff/bookings/cancel-by-number/:bookingNumber`
* **Auth:** Required (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "staffNote": "إلغاء سريع بناءً على اتصال خدمة العملاء"
}

```



### هـ. تعديل حجز يدوياً بواسطة الأدمن (Admin Booking Override)

* **Endpoint:** `PATCH /api/staff/bookings/:id/edit`
* **Auth:** Required (`Admin` Only)

---

## 2. الحجوزات المكتملة والتسويات المالية (Settlements & Completed Bookings)

### أ. عرض الحجوزات المكتملة مع إمكانية الفلترة الشاملة

* **Endpoint:** `GET /api/staff/settlements`
* **Auth:** Required (`Staff` or `Admin`)
* **Query Params:** `isSettled` (`true`/`false`), `providerId`, `startDate`, `endDate`.
* **مثال عملي للـ Request:**
```http
GET /api/staff/settlements?isSettled=false&providerId=64a7b2c1f1a2b3c4d5e6f7a1&startDate=2026-07-01&endDate=2026-07-07

```



### ب. تنفيذ التسوية المالية (صرف المستحقات)

* **Endpoint:** `PATCH /api/staff/settlements/pay`
* **Auth:** Required (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "bookingIds": [
    "64a7b2c1f1a2b3c4d5e6f7a1",
    "64a7b2c1f1a2b3c4d5e6f7a2"
  ]
}

```



---

## 3. إدارة مزودي الخدمة (Providers: Doctors & Nurses)

### أ. إضافة طبيب جديد (Create Doctor)

* **Endpoint:** `POST /api/staff/doctors`
* **Auth:** Required (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "name": "د. أحمد محمود",
  "email": "dr.ahmed@clinic.com",
  "password": "Password123@",
  "phoneNumber": "01012345678",
  "secondaryPhoneNumber": "01112345678",
  "address": "الفيوم - عمارة الأطباء",
  "specialization": "باطنة",
  "basePrice": 200,
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
```[cite: 18]


```



### ب. تعديل بيانات طبيب (Update Doctor)

* **Endpoint:** `PATCH /api/staff/doctors/:id`
* **Auth:** Required (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "basePrice": 250,
  "isAvailable": true
}
```[cite: 19]


```



### ج. إضافة ممرض جديد (Create Nurse)

* **Endpoint:** `POST /api/staff/nurses`
* **Auth:** Required (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "name": "م. كريم سعيد",
  "email": "nurse.karim@clinic.com",
  "password": "Password123@",
  "phoneNumber": "01198765432",
  "address": "الفيوم - شارع الجمهورية",
  "location": {
    "type": "Point",
    "coordinates": [30.8428, 29.3084]
  },
  "services": ["64a1b2c3d4e5f6789012345e"]
}

```



### د. عرض الملخص المالي لمزود الخدمة (Provider Financial Summary)

* **Endpoint:** `GET /api/staff/providers/:id/financial-summary`
* **Auth:** Required (`Staff` or `Admin`)

### هـ. التحقق من توافر مزود خدمة (Provider Availability)

* **Endpoint:** `GET /api/staff/providers/availability`
* **Query Params:** `providerType` (`doctor`/`nurse`), `providerId`, `appointmentTime`

### و. تبديل حالة الإتاحة (Toggle Status)

* **Endpoint:** `PATCH /api/staff/providers/:type/:id/toggle-status`
* **Auth:** Required (`Admin` Only)

---

## 4. إدارة حسابات الإدارة والاستاف (Staff & Admin Accounts)

### أ. إنشاء حساب Staff أو Admin جديد

* **Endpoint:** `POST /api/staff/accounts`
* **Auth:** Required (`Admin` Only)
* **Request Body:**
```json
{
  "name": "محمد علي",
  "email": "admin.mohamed@clinic.com",
  "password": "Password123@",
  "role": "Admin"
}

```


*(ملاحظة: حقل `role` يقبل القيمتين `Staff` أو `Admin` فقط).*

---

## 5. الخدمات التمريضية والتحليلات (Services & Analytics)

### أ. إدارة الخدمات التمريضية

* **عرض الخدمات:** `GET /api/staff/nursing-services` (`Staff` or `Admin`)
* **إضافة خدمة جديدة:** `POST /api/staff/nursing-services` (`Staff` or `Admin`)
* **Request Body:**
```json
{
  "name": "محاليل وريدية",
  "description": "تركيب محاليل بالمنزل",
  "basePrice": 150,
  "isActive": true
}

```




* **تعديل خدمة:** `PATCH /api/staff/nursing-services/:id` (`Staff` or `Admin`)

### ب. النظام والمراقبة

* **إحصائيات المنصة العامة (Analytics):** `GET /api/staff/analytics` (`Admin` Only)
* **سجل النظام والمراقبة (Audit Logs):** `GET /api/staff/audit-logs` (`Staff` or `Admin`)

---

## 6. نظام الإشعارات (Notifications System API)

### أ. إدارة رموز الأجهزة (FCM Device Tokens)

* **تسجيل / تحديث رمز الجهاز:** `POST /api/notifications/fcm-token`

* **Request Body:**
```json
{
  "fcm_token": "eXamPle_Fcm_ToKeN_StRiNg...",
  "device_type": "android"
}
```[cite: 17]

```




* **حذف الرمز عند تسجيل الخروج:** `DELETE /api/notifications/fcm-token`

* **Request Body:**
```json
{
  "fcm_token": "eXamPle_Fcm_ToKeN_StRiNg..."
}
```[cite: 16]


```





### ب. مركز الإشعارات الخاص بالمستخدم

* **جلب الإشعارات وعدد غير المقروء:** `GET /api/notifications`

* **تحديد إشعار كمقروء:** `PATCH /api/notifications/:id/read`

* **تحديد الكل كمقروء:** `PATCH /api/notifications/read-all`

* **حذف إشعار:** `DELETE /api/notifications/:id`


### ج. الإرسال الجماعي والموجه (صلاحيات Staff / Admin فقط)

* **إرسال إشعار جماعي (Broadcast):** `POST /api/notifications/broadcast`

* **Request Body:**
```json
{
  "title": "صيانة مجدولة",
  "body": "سيتم إجراء صيانة للنظام الليلة",
  "type": "general",
  "targetAudience": "all",
  "data": { "maintenance": "true" }
}
```[cite: 15]

```




* **إرسال إشعار موجه لمستخدمين محددين (Targeted):** `POST /api/notifications/targeted`

* **Request Body:**
```json
{
  "title": "متابعة الحجز",
  "body": "تم تحديث أحد الحجوزات",
  "type": "booking_status",
  "userIds": ["user_id_1", "user_id_2"],
  "data": { "bookingId": "550" }
}

```