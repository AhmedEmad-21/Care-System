# شرح Endpoints البحث بالاسم

البحث النصي موحّد بين الدكتور والممرض والخدمات التمريضية عبر [src/utils/nameSearch.js](src/utils/nameSearch.js).

السلوك المشترك للاسم:

- بحث جزئي على كل كلمة (الاسم الأول أو الثاني يكفي)
- تجاهل ألقاب مثل: `د.`، `دكتور`، `دكتورة`، `Dr`، `م.`، `ممرض`، `ممرضة`
- توحيد أشكال الحروف العربية (أ/ا، ى/ي، ة/ه، التشكيل)
- Case-insensitive للإنجليزي
- لو `name` فاضي أو لقب فقط: `400`

من Flutter استخدم `Uri.encodeQueryComponent` للاسم العربي.

---

## 1) البحث عن دكتور

- Method: GET
- URL: `/api/doctors/search-by-name`
- Auth: غير مطلوب
- Route: [src/routes/doctorRoutes.js](src/routes/doctorRoutes.js)
- Controller: [src/controllers/doctorController.js](src/controllers/doctorController.js)

### Query params

| Param | الحالة | الاستخدام |
|---|---|---|
| `name` | إجباري | بحث مرن داخل `Doctor.name` |
| `specialization` | اختياري | مطابقة مباشرة للتخصص |
| `date` | اختياري | استبعاد اليوم من `offDays` |
| `lat` + `long` | اختياريان معاً | ترتيب بالأقرب، حد 35 كم |

دائماً: `isAvailable = true`. لو `lat` أو `long` لوحده، البحث الجغرافي يتجاهل ويرجع بحث بالاسم.

### أمثلة

```
GET /api/doctors/search-by-name?name=أحمد
GET /api/doctors/search-by-name?name=د.%20أحمد
GET /api/doctors/search-by-name?name=ahmed&specialization=باطنة
GET /api/doctors/search-by-name?name=أحمد&date=2026-09-10&lat=29.3084&long=30.8428
```

خطأ غياب الاسم:

```json
{ "success": false, "message": "يرجى إدخال اسم الدكتور للبحث عنه" }
```

---

## 2) البحث عن ممرض

نفس عقد الدكتور **بدون** `specialization`.

- Method: GET
- URL: `/api/nurses/search-by-name`
- Auth: غير مطلوب
- المسار قبل `/:id` حتى لا يُفسَّر كمعرّف
- Route: [src/routes/nurseRoutes.js](src/routes/nurseRoutes.js)
- Controller: [src/controllers/nurseController.js](src/controllers/nurseController.js)

### Query params

| Param | الحالة | الاستخدام |
|---|---|---|
| `name` | إجباري | بحث مرن داخل `Nurse.name` |
| `date` | اختياري | استبعاد اليوم من `offDays` |
| `lat` + `long` | اختياريان معاً | `$geoNear`، `dist.calculated`، 35000 متر |

دائماً: `isAvailable = true`. استخدم `long` وليس `lng` (عقد `/nearby` مختلف).

### أمثلة

```
GET /api/nurses/search-by-name?name=فاطمة
GET /api/nurses/search-by-name?name=فاطمة&date=2026-09-10
GET /api/nurses/search-by-name?name=فاطمة&lat=29.3084&long=30.8428
```

خطأ غياب الاسم:

```json
{ "success": false, "message": "يرجى إدخال اسم الممرض للبحث عنه" }
```

---

## 3) البحث عن خدمة تمريضية

اسم فقط. لا تاريخ ولا موقع.

- Method: GET
- URL: `/api/nursing-services/search-by-name`
- Auth: غير مطلوب
- المسار قبل `/:id`
- Route: [src/routes/nursingServiceRoutes.js](src/routes/nursingServiceRoutes.js)
- Controller: [src/controllers/nursingServiceController.js](src/controllers/nursingServiceController.js)

```
GET /api/nursing-services/search-by-name?name=حقن
```

دائماً: `isActive = true`.

خطأ غياب الاسم:

```json
{ "success": false, "message": "يرجى إدخال اسم الخدمة للبحث عنها" }
```

---

## شكل الاستجابة الناجحة

Status: `200 OK`

### استجابة البحث / الفلترة للأطباء:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "6aac5440d173298f87724192",
      "name": "دكتور حازم",
      "specialization": "باطنة",
      "phoneNumber": "01002694545",
      "secondaryPhoneNumber": "01099887766",
      "address": "الفيوم المرور بجوار مدرسة الرسالة",
      "basePrice": 300,
      "urgentPrice": 450,
      "commissionRate": 10,
      "rating": 4.8,
      "totalReviews": 12,
      "profileImage": "https://res.cloudinary.com/.../doctor.jpg",
      "isAvailable": true,
      "workingHours": {
        "start": "09:00",
        "end": "17:00"
      },
      "offDays": [5, 6],
      "location": {
        "type": "Point",
        "coordinates": [30.8428, 29.3084]
      },
      "dist": {
        "calculated": 1250.5
      }
    }
  ],
  "message": "done"
}
```

### استجابة البحث / الفلترة للممرضين:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "6aac5440d173298f87724999",
      "name": "فاطمة أحمد",
      "phoneNumber": "01011223344",
      "commissionRate": 10,
      "rating": 4.9,
      "totalReviews": 8,
      "profileImage": "https://res.cloudinary.com/.../nurse.jpg",
      "isAvailable": true,
      "offDays": [5],
      "location": {
        "type": "Point",
        "coordinates": [30.8428, 29.3084]
      },
      "dist": {
        "calculated": 850.0
      }
    }
  ],
  "message": "done"
}
```

> **ملاحظات هامة للفرونت إند (معمارية موحدة وبسيطة):**
> - **معرّف واحد فقط (`_id`):** هو المعرّف المباشر لمزود الخدمة (Doctor ID أو Nurse ID)، وهو الذي يُرسل في طلب الحجز (`doctorId` أو `nurseId`). تم إلغاء كائن `userId` الداخلي لمنع تكرار البيانات وتشتت المعرفات.
> - **`basePrice` و `urgentPrice` للأطباء:** مضمون رجوعهما كأرقام دائماً (حيث يعود الكشف المستعجل تلقائياً لسعر الكشف العادي كـ Fallback في حال لم يحدد الطبيب سعراً مستعجلاً منفصلاً).
> - **حقل `dist.calculated`:** يظهر فقط عند تمرير `lat` و `long` معاً بالطلب ويمثل المسافة بالمتر بين المريض ومقدم الخدمة.
> - **الإحداثيات في `location.coordinates`:** بنظام GeoJSON `[longitude, latitude]`.
