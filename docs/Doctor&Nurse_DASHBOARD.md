# 📋 دليل استخدام لوحة تحكم مزودي الخدمة (Doctor & Nurse Dashboard API)

جميع المسارات التالية تتطلب مصادقة (Authentication) ويجب إرسال الـ Token الخاص بالمستخدم في الـ Headers مع صلاحية `Doctor` أو `Nurse`.

* **Base URL:** `/api/provider-dashboard`
* **Authorization Header:** `Bearer <YOUR_TOKEN>`

---

### 1. عرض الحجوزات (مع دعم الفلترة)

جلب قائمة الحجوزات الخاصة بمزود الخدمة الحالي مع إمكانية الفلترة بحالة الحجز أو بالتاريخ.

* **Endpoint:** `GET /api/provider-dashboard/bookings`
* **Query Parameters (اختيارية):**
  * `status`: تصفية الحجوزات حسب الحالة (`pending`, `confirmed`, `completed`, `cancelled`).
  * `date`: تصفية الحجوزات الخاصة بيوم معين (بالصيغة `YYYY-MM-DD`).

* **مثال للطلب (Request):**
```http
GET /api/provider-dashboard/bookings?status=pending&date=2026-09-20 HTTP/1.1
Host: localhost:3000
Authorization: Bearer <YOUR_TOKEN>
```

* **مثال للاستجابة الناجحة (Response):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "60d0fe4f5311236168a109ca",
      "bookingNumber": 10024,
      "patientId": {
        "_id": "60d0fe4f5311236168a109cb",
        "name": "أحمد محمد",
        "phoneNumber": "01012345678"
      },
      "appointmentTime": "2026-09-20T10:00:00.000Z",
      "status": "pending",
      "isSettled": false,
      "totalCost": 500,
      "createdAt": "2026-09-18T08:30:00.000Z"
    }
  ]
}
```

---

### 2. جدولة وتأكيد الحجز (تحديد وقت محدد)

تستخدم عندما يطلب المريض الحجز في يوم معين، ويقوم الدكتور أو الممرض بتحديد الساعة المناسبة وتأكيد الحجز.

* **Endpoint:** `PATCH /api/provider-dashboard/bookings/:id/schedule`
* **Request Body (JSON):**
```json
{
  "appointmentTime": "2026-09-20T11:30:00.000Z",
  "status": "confirmed"
}
```

* **مثال للاستجابة الناجحة (Response):**
```json
{
  "success": true,
  "message": "تم تحديث موعد الحجز بنجاح",
  "data": {
    "_id": "60d0fe4f5311236168a109ca",
    "appointmentTime": "2026-09-20T11:30:00.000Z",
    "status": "confirmed"
  }
}
```

---

### 3. تغيير حالة الحجز

تستخدم لتحديث حالة الحجز (مثل جعله مكتمل `completed` أو ملغي `cancelled`).

* **Endpoint:** `PATCH /api/provider-dashboard/bookings/:id/status`
* **Request Body (JSON):**
```json
{
  "status": "completed"
}
```

* **مثال للاستجابة الناجحة (Response):**
```json
{
  "success": true,
  "message": "تم تحديث حالة الحجز بنجاح",
  "data": {
    "_id": "60d0fe4f5311236168a109ca",
    "status": "completed"
  }
}
```

---

### 4. عرض التسويات والعمولات المالية (الحجوزات المكتملة المسوية والمستحقة)

عرض جميع الحجوزات المكتملة الخاصة بمزود الخدمة (سواء المسوية أو التي لم تسوّ بعد)، مع حساب نسبة المنصة وصافي أرباح المزود وتوفير ملخص مالي كامل.

* **Endpoint:** `GET /api/provider-dashboard/settlements`
* **Query Parameters (اختيارية):**
  * `isSettled`: تصفية حسب التسوية (`true` للمسوية فقط، `false` للمستحقة فقط، أو إهمال الحقل لعرض الجميع).
  * `startDate`: تاريخ البداية (مثال: `2026-09-01`).
  * `endDate`: تاريخ النهاية (مثال: `2026-09-15`).

* **مثال للطلب (Request):**
```http
GET /api/provider-dashboard/settlements?startDate=2026-09-01&endDate=2026-09-15 HTTP/1.1
Host: localhost:3000
Authorization: Bearer <YOUR_TOKEN>
```

* **مثال للاستجابة الناجحة (Response):**
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
      "_id": "60d0fe4f5311236168a109cc",
      "bookingNumber": 10024,
      "status": "completed",
      "isSettled": false,
      "totalCost": 500,
      "appliedCommissionRate": 10,
      "calculatedCommission": 50,
      "providerEarnings": 450,
      "patientId": {
        "_id": "60d0fe4f5311236168a109cb",
        "name": "أحمد محمد",
        "phoneNumber": "01012345678"
      },
      "updatedAt": "2026-09-10T14:00:00.000Z"
    },
    {
      "_id": "60d0fe4f5311236168a109cd",
      "bookingNumber": 10025,
      "status": "completed",
      "isSettled": true,
      "totalCost": 500,
      "appliedCommissionRate": 10,
      "calculatedCommission": 50,
      "providerEarnings": 450,
      "patientId": {
        "_id": "60d0fe4f5311236168a109ce",
        "name": "محمود سمير",
        "phoneNumber": "01099887766"
      },
      "updatedAt": "2026-09-05T10:00:00.000Z"
    }
  ]
}
```

---

### 5. تحديث أيام الإجازة الأسبوعية

تستخدم لتعديل جدول أيام الراحة والإجازات الأسبوعية الخاصة بمزود الخدمة.

* **Endpoint:** `PATCH /api/provider-dashboard/off-days`
* **Request Body (JSON):**
```json
{
  "offDays": [5, 6]
}
```

*(ملاحظة: الأرقام تعبر عن أيام الأسبوع بلغة JavaScript: `0 = Sunday`, `1 = Monday`, `5 = Friday`, `6 = Saturday`).*

* **مثال للاستجابة الناجحة (Response):**
```json
{
  "success": true,
  "message": "تم تحديث أيام الإجازة بنجاح",
  "data": {
    "_id": "60d0fe4f5311236168a109cd",
    "offDays": [5, 6]
  }
}
```