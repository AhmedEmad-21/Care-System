

# 📋 دليل استخدام لوحة تحكم مزودي الخدمة (Doctor & Nurse Dashboard API)

جميع المسارات التالية تتطلب مصادقة (Authentication) ويجب إرسال الـ Token الخاص بالمستخدم في الـ Headers مع صلاحية `Doctor` أو `Nurse`.

* **Base URL:** `/api/provider-dashboard`
* **Authorization Header:** `Bearer <YOUR_TOKEN>`

---

### 1. عرض الحجوزات (مع دعم الفلترة)

جلب قائمة الحجوزات الخاصة بمزود الخدمة الحالي مع إمكانية الفلترة بحالة الحجز أو بالتاريخ.

* **Endpoint:** `GET /api/provider-dashboard/bookings`
* **Query Parameters (اختيارية):**
* `status`: لحفل الحجوزات حسب الحالة (مثل: `pending`, `confirmed`, `completed`, `cancelled`).
* `date`: لتصفية الحجوزات الخاصة بيوم معين (بالصيغة `YYYY-MM-DD`).


* **مثال للطلب (Request):**
```http
GET /api/provider-dashboard/bookings?status=pending&date=2026-09-20

```


* **مثال للاستجابة الناجحة (Response):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "60d0fe4f5311236168a109ca",
      "patientId": {
        "_id": "60d0fe4f5311236168a109cb",
        "name": "أحمد محمد",
        "phoneNumber": "01012345678"
      },
      "appointmentTime": "2026-09-20T10:00:00.000Z",
      "status": "pending",
      "isSettled": false,
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

### 4. عرض التسويات المالية (الحجوزات المكتملة والمدفوعة `isSettled = true`)

عرض الحجوزات التي اكتملت وتم تسويتها مالياً، مع دعم الفلترة بنطاق زمني (تاريخ البداية والنهاية).

* **Endpoint:** `GET /api/provider-dashboard/settlements`
* **Query Parameters (اختيارية):**
* `startDate`: تاريخ البداية (مثال: `2026-09-01`).
* `endDate`: تاريخ النهاية (مثال: `2026-09-15`).


* **مثال للطلب (Request):**
```http
GET /api/provider-dashboard/settlements?startDate=2026-09-01&endDate=2026-09-15

```


* **مثال للاستجابة الناجحة (Response):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "60d0fe4f5311236168a109cc",
      "status": "completed",
      "isSettled": true,
      "fees": 200,
      "updatedAt": "2026-09-10T14:00:00.000Z"
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


*(ملاحظة: الأرقام تعبر عن أيام الأسبوع، مثلاً 5 و 6 تعني الجمعة والسبت حسب نظام النظام لديك).*
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