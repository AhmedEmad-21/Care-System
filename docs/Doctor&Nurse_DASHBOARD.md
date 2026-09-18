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

> 💡 **مفهوم التسوية لمزود الخدمة:**  
> يستلم مزود الخدمة (الطبيب/الممرض) إجمالي قيمة الكشف نقدياً (Cash) من المريض، وتكون نسبة المنصة (`totalCommission`) مستحقة السداد للمنصة:  
> * **`settledAmount` (أو `settledCommission`):** عمولة المنصة التي تم سدادها وتسويتها بالفعل مع المنصة.  
> * **`pendingSettlementAmount` (أو `pendingCommission`):** عمولة المنصة المعلقة المطلوب سدادها للمنصة.  
> * **`totalProviderEarnings`:** صافي دخل المزود بعد استقطاع عمولة المنصة.  

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
    "settledAmount": 50,
    "pendingSettlementAmount": 50,
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

---

### 6. حالة استقبال الحجوزات اليوم (زر التحكم في الداش بورد)

يستخدم لمعرفة حالة استقبال الحجوزات لليوم الحالي (On/Off) والتحكم فيها، بحيث إذا قرر الطبيب أو الممرض عدم استقبال كشوفات لليوم الحالي فقط يقوم بإيقاف الزرار. 
> **ملاحظة هامة:** عند إيقاف استقبال الحجوزات لليوم، يختفي الطبيب/الممرض من قوائم البحث الخاصة باليوم الحالي تلقائياً ولن يتمكن المرضى من اختياره لليوم، **ولكنه يظل ظاهراً ومتاحاً للحجز في أي يوم آخر (غداً وما بعده) بشكل طبيعي**.

#### أ) استعلام حالة اليوم (Get Today Availability):
* **Endpoint:** `GET /api/provider-dashboard/today-availability`
* **Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-09-18",
    "type": "doctor",
    "isAvailableToday": true,
    "isDateBlocked": false,
    "isDayOff": false,
    "isAvailable": true,
    "unavailableDates": []
  }
}
```

#### ب) تبديل أو تغيير حالة اليوم (Toggle / Set Today Availability):
* **Endpoint:** `PATCH /api/provider-dashboard/today-availability`
* **Request Body (اختياري - إذا أُرسل فارغاً يقوم بالتبديل التلقائي Toggle):**
```json
{
  "isAvailableToday": false
}
```
* **Response:**
```json
{
  "success": true,
  "message": "تم إيقاف استقبال الحجوزات لليوم بنجاح، ولن تظهر في قائمة الحجوزات المتاحة لهذا اليوم",
  "data": {
    "date": "2026-09-18",
    "type": "doctor",
    "isAvailableToday": false,
    "isDateBlocked": true,
    "isDayOff": false,
    "isAvailable": true,
    "unavailableDates": ["2026-09-18"]
  }
}
```

---

### 7. تحديث الوصف التعريفي (Description)

يسمح للطبيب أو الممرض بكتابة أو تعديل الوصف الخاص به (النبذة التعريفية والخبرات) الذي يظهر للمرضى في البروفايل.

* **Endpoint:** `PATCH /api/provider-dashboard/description`
* **ملاحظة:** متاح أيضاً عبر المسارات المخصصة:
  - للأطباء: `PATCH /api/doctors/description`
  - للممرضين: `PATCH /api/nurses/description`
* **Request Body:**
```json
{
  "description": "استشاري أمراض الباطنة والسكري، حاصل على الدكتوراه وخبرة 15 عاماً في مناظير الجهاز الهضمي والتشخيص المبكر."
}
```
* **Response:**
```json
{
  "success": true,
  "message": "تم تحديث الوصف بنجاح",
  "data": {
    "type": "doctor",
    "_id": "60d0fe4f5311236168a109cd",
    "name": "دكتور حازم",
    "description": "استشاري أمراض الباطنة والسكري، حاصل على الدكتوراه وخبرة 15 عاماً في مناظير الجهاز الهضمي والتشخيص المبكر."
  }
}
```

---

### 8. عرض بيانات بروفايل المزود كاملة في الداش بورد

* **Endpoint:** `GET /api/provider-dashboard/profile`
* **Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60d0fe4f5311236168a109cd",
    "name": "دكتور حازم",
    "specialization": "باطنة",
    "description": "استشاري أمراض الباطنة والسكري...",
    "phoneNumber": "01002694545",
    "basePrice": 300,
    "urgentPrice": 450,
    "isAvailable": true,
    "isAvailableToday": true,
    "offDays": [5, 6],
    "unavailableDates": []
  }
}
```