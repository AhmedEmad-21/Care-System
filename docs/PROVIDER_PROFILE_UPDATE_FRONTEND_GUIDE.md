# 📘 توثيق الـ API للفرونت إند: إدارة وتحديث الملف الشخصي للطبيب والممرض
### Doctor & Nurse Profile Management Guide (Updated & Comprehensive)

هذا التوثيق معد خصيصاً لفريق **الفرونت إند (Frontend / Mobile App)**، ويوضح بالتفصيل كيفية **جلب** و**تحديث** الملف الشخصي وبيانات كل من **الطبيب (Doctor)** و**الممرض (Nurse)**، مع تفاصيل الصلاحيات، الحقول المسموح بها بدقة، الـ Enums المدعومة، المسارات الموحدة للوحة تحكم المزود (`Provider Dashboard`)، ونماذج الـ Request والـ Response.

---

## 📌 الفهرس
1. [المسارات المتاحة (Endpoints Summary)](#1-المسارات-المتاحة-endpoints-summary)
2. [نظام الصلاحيات والأمان (Permissions & Security Rules)](#2-نظام-الصلاحيات-والأمان-permissions--security-rules)
3. [قسم الطبيب (Doctor Endpoints)](#3-قسم-الطبيب-doctor-endpoints)
   - [جلب الملف الشخصي (GET /api/doctors/profile)](#31-جلب-الملف-الشخصي-للطبيب)
   - [تحديث الملف الشخصي (PATCH /api/doctors/profile أو :id)](#32-تحديث-بيانات-الطبيب)
   - [قائمة التخصصات المعتمدة (Specializations Enum & API)](#33-قائمة-التخصصات-الطبية-المعتمدة)
4. [قسم الممرض (Nurse Endpoints)](#4-قسم-الممرض-nurse-endpoints)
   - [جلب الملف الشخصي (GET /api/nurses/profile)](#41-جلب-الملف-الشخصي-للممرض)
   - [تحديث الملف الشخصي (PATCH /api/nurses/profile أو :id)](#42-تحديث-بيانات-الممرض)
5. [المسارات الموحدة للوحة تحكم مزودي الخدمة (Unified Provider Dashboard)](#5-المسارات-الموحدة-للوحة-تحكم-مزودي-الخدمة-unified-provider-dashboard)
   - [جلب البروفايل الموحد (GET /api/provider-dashboard/profile)](#51-جلب-البروفايل-الموحد-في-الداشبورد)
   - [تحديث البروفايل الموحد (PATCH /api/provider-dashboard/profile)](#52-تحديث-البروفايل-الموحد)
   - [إدارة حالة التوفر اليومية (Today Availability Toggle)](#53-التحكم-في-استقبال-الحجوزات-اليوم-today-availability)
   - [التحديث السريع لأيام الإجازة والنبذة التعريفية](#54-المسارات-السريعة-للإجازات-والوصف)
6. [أيام الإجازات والموقع الجغرافي (Special Data Types)](#6-تنسيق-البيانات-الخاصة-special-data-types)
7. [معالجة الأخطاء (Error Codes & Responses)](#7-معالجة-الأخطاء-error-handling)
8. [دوال مساعدة برمجية (Frontend TypeScript Helper)](#8-دوال-مساعدة-للفرونت-إند-front-end-service-helper---typescript--axios)

---

## 1. المسارات المتاحة (Endpoints Summary)

### أ. مسارات إدارة ملف الطبيب (Doctor Endpoints)
| المسار (Endpoint) | الطريقة (Method) | الأدوار المسموح لها | الوصف |
| :--- | :---: | :--- | :--- |
| `/api/doctors/profile` | `GET` | `Doctor`, `Staff`, `Admin` | جلب الملف الشخصي للطبيب المسجل حالياً |
| `/api/doctors/profile` | `PATCH` | `Doctor`, `Staff`, `Admin` | تحديث الملف الشخصي للطبيب المسجل حالياً |
| `/api/doctors/:id` | `PATCH` | `Doctor`, `Staff`, `Admin` | تحديث بيانات طبيب بالمعرف (الطبيب لنفسه فقط، الاستاف والأدمن لأي طبيب) |
| `/api/doctors/:id` | `GET` | عام (Public) | جلب تفاصيل طبيب محدد بالمعرف للعامة |
| `/api/doctors/specializations` | `GET` | عام (Public) | جلب قائمة التخصصات الطبية المفعلة في النظام |
| `/api/doctors/description` | `PATCH` | `Doctor` (Auth) | تحديث سريع لنبذة الطبيب الشخصية فقط |
| `/api/doctors/:id/description` | `PATCH` | `Staff`, `Admin` | تحديث نبذة طبيب محدد بالمعرف |

### ب. مسارات إدارة ملف الممرض (Nurse Endpoints)
| المسار (Endpoint) | الطريقة (Method) | الأدوار المسموح لها | الوصف |
| :--- | :---: | :--- | :--- |
| `/api/nurses/profile` | `GET` | `Nurse`, `Staff`, `Admin` | جلب الملف الشخصي للممرض المسجل حالياً |
| `/api/nurses/profile` | `PATCH` | `Nurse`, `Staff`, `Admin` | تحديث الملف الشخصي للممرض المسجل حالياً |
| `/api/nurses/:id` | `PATCH` | `Nurse`, `Staff`, `Admin` | تحديث بيانات ممرض بالمعرف (الممرض لنفسه فقط، الاستاف والأدمن لأي ممرض) |
| `/api/nurses/:id` | `GET` | عام (Public) | جلب تفاصيل ممرض محدد بالمعرف للعامة |
| `/api/nurses/description` | `PATCH` | `Nurse` (Auth) | تحديث سريع لنبذة الممرض الشخصية فقط |
| `/api/nurses/:id/description` | `PATCH` | `Staff`, `Admin` | تحديث نبذة ممرض محدد بالمعرف |

### ج. المسارات الموحدة للوحة التحكم وتطبيق المزود (Unified Provider Dashboard) 🌟
> 💡 **ميزة هامة:** هذه المسارات موحدة لمزودي الخدمة (طبيب أو ممرض)، وتسهل بناء شاشات التطبيق دون الحاجة لفحص نوع الحساب (`Doctor` أو `Nurse`) في كل شاشة:
| المسار (Endpoint) | الطريقة (Method) | الأدوار المسموح لها | الوصف |
| :--- | :---: | :--- | :--- |
| `/api/provider-dashboard/profile` | `GET` | `Doctor`, `Nurse` | جلب ملف المزود الحالي شاملاً معلومات التوفر لليوم ونوع الحساب (`type`) |
| `/api/provider-dashboard/profile` | `PATCH` | `Doctor`, `Nurse` | تحديث ملف المزود الحالي مع توجيه الطلب تلقائياً لنوع الحساب المناسب |
| `/api/provider-dashboard/today-availability` | `GET` | `Doctor`, `Nurse` | الاستعلام عن حالة استقبال الحجوزات لليوم الحالي بدقة |
| `/api/provider-dashboard/today-availability` | `PATCH` | `Doctor`, `Nurse` | تفعيل / تعطيل استقبال الحجوزات لليوم بضغطة زر واحدة (Switch) |
| `/api/provider-dashboard/off-days` | `PATCH` | `Doctor`, `Nurse` | تحديث أيام الإجازة الأسبوعية للمزود الحالي |
| `/api/provider-dashboard/description` | `PATCH` | `Doctor`, `Nurse` | تحديث سريع للنبذة التعريفية للمزود الحالي |

---

## 2. نظام الصلاحيات والأمان (Permissions & Security Rules)

1. **الهيدر المطلوب في جميع الطلبات المحمية:**
   ```http
   Authorization: Bearer <JWT_ACCESS_TOKEN>
   Content-Type: application/json
   ```
2. **قواعد الأمان الخاصة بالـ ID والتعديل الذاتي:**
   - إذا كان دور المستخدم `Doctor` أو `Nurse`، يمكنه فقط تعديل ملفه الخاص. إذا حاول تعديل ID مزود آخر سيحصل مباشرة على خطأ `403 Forbidden` (`"غير مصرح لك بتعديل بيانات مزود آخر"`).
   - إذا كان دور المستخدم `Staff` أو `Admin`، فلديه صلاحية كاملة لتعديل بيانات أي طبيب أو ممرض عبر `PATCH /api/doctors/:id` أو `PATCH /api/nurses/:id`.
3. **حظر الحقول غير المصرح بها برمجياً (`additionalProperties: false`):**
   - السيرفر يعتمد على schema صارمة؛ أي حقل خارج الجدول المعتمد (مثل إرسال `_id`, `rating`, `createdAt`, `isAvailableToday` داخل الـ body) سيؤدي إلى رفض الطلب بخطأ `400 Bad Request`.
4. **حماية حقول المنصة المالية والتقييمات:**
   - الحقول: `commissionRate`, `rating`, `totalReviews` محمية برمجياً. إذا أرسلها الطبيب أو الممرض، يتم تجاهلها وتجريدها تلقائياً، وتعديلها مقتصر فقط على مسؤولي النظام (`Staff` و `Admin`).
5. **المزامنة التلقائية مع حساب المستخدم (Auto-Sync with User Account):**
   - عند تعديل الحقول الأساسية المشتركة (`name`, `email`, `phoneNumber`, `address`, `profileImage`, `location`)، يقوم النظام تلقائياً بتحديث سجل الـ `User` في قاعدة البيانات لضمان دقة عمليات تسجيل الدخول وتناسق البيانات عبر التطبيق.

---

## 3. قسم الطبيب (Doctor Endpoints)

### 3.1 جلب الملف الشخصي للطبيب
* **Method:** `GET`
* **URL:** `{{BASE_URL}}/api/doctors/profile`
* **Headers:** `Authorization: Bearer <DOCTOR_TOKEN>`
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "67401a2b3c4d5e6f7a8b9c01",
    "name": "د. أحمد كمال الشناوي",
    "email": "dr.ahmed@example.com",
    "phoneNumber": "01012345678",
    "secondaryPhoneNumber": "01234567890",
    "address": "المعادي، القاهرة",
    "specialization": "باطنة",
    "basePrice": 300,
    "urgentPrice": 450,
    "commissionRate": 10,
    "rating": 4.8,
    "totalReviews": 25,
    "profileImage": "https://example.com/uploads/doctor.jpg",
    "workingHours": {
      "start": "10:00",
      "end": "18:00"
    },
    "offDays": [5],
    "unavailableDates": ["2026-10-01", "2026-10-02"],
    "isAvailable": true,
    "isAvailableToday": true,
    "description": "استشاري الأمراض الباطنية والسكر والغدد الصماء، خبرة 15 عاماً.",
    "location": {
      "type": "Point",
      "coordinates": [31.2569, 29.9602]
    }
  }
}
```

---

### 3.2 تحديث بيانات الطبيب
* **Method:** `PATCH`
* **URL:** `{{BASE_URL}}/api/doctors/profile` (أو `{{BASE_URL}}/api/doctors/:id`)
* **Headers:**
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`

#### 📋 جدول الحقول المسموح بها في الـ Request Body (طبيب):
> ⚠️ **تنبيه حاسم:** أرسل فقط الحقول المطلوب تعديلها (Partial Update). يجب ألا يقل عدد الحقول المرسلة عن حقل واحد (`minProperties: 1`). لا ترسل كائن الطبيب كاملاً بما يحتويه من `_id` أو `createdAt` لتفادي خطأ `additionalProperties`.

| الحقل (Field) | النوع (Type) | متطلبات التحقق (Validation) | الوصف |
| :--- | :---: | :--- | :--- |
| `name` | `string` | minLength: 1 | اسم الطبيب |
| `email` | `string` | format: email | البريد الإلكتروني (يتم التحقق من عدم تكراره) |
| `phoneNumber` | `string` | regex: `^01[0125][0-9]{8}$` | رقم الهاتف الأساسي (11 رقم مصري، يتم التحقق من عدم تكراره) |
| `secondaryPhoneNumber` | `string` | regex: `^01[0125][0-9]{8}$` | رقم هاتف إضافي للعيادة (اختياري) |
| `address` | `string` | minLength: 1 | عنوان العيادة / الكشف |
| `specialization` | `string` | **Enum حصري (انظر القائمة أدناه)** | تخصص الطبيب المعتمد |
| `basePrice` | `number` | min: 0 | سعر الكشف العادي بالجنيه |
| `urgentPrice` | `number` | min: 0 | سعر الكشف المستعجل بالجنيه (إن وجد) |
| `profileImage` | `string` | رابط الصورة | رابط أو مسار الصورة الشخصية |
| `description` | `string` | نص | نبذة تعريفية وخبرات الطبيب |
| `isAvailable` | `boolean` | `true` أو `false` | تفعيل / تعطيل استقبال الحجوزات عموماً |
| `offDays` | `number[]` | أرقام صحيحة من 0 إلى 6 | أيام الإجازة الأسبوعية (`0`: الأحد ... `6`: السبت) |
| `unavailableDates` | `string[]` | مصفوفة تواريخ | تواريخ إجازات استثنائية بصيغة `["YYYY-MM-DD"]` |
| `workingHours` | `object` | `{ start: string, end: string }` | مواعيد العمل اليومية مثل `{"start": "09:00", "end": "17:00"}` |
| `location` | `object` | GeoJSON Point | `{ "type": "Point", "coordinates": [longitude, latitude] }` |
| `commissionRate` | `number` | min: 0, max: 100 | نسبة العمولة (متاح للأدمن والاستاف فقط) |

#### 💡 مثال Request Body للتحديث (طبيب):
```json
{
  "name": "د. أحمد كمال الشناوي",
  "email": "dr.ahmed.new@example.com",
  "phoneNumber": "01012345678",
  "secondaryPhoneNumber": "01123456789",
  "address": "شارع النصر، المعادي، القاهرة",
  "specialization": "باطنة",
  "basePrice": 350,
  "urgentPrice": 500,
  "description": "استشاري أمراض باطنة وسكري، دكتوراه طب القصر العيني.",
  "isAvailable": true,
  "offDays": [5],
  "unavailableDates": ["2026-10-06"],
  "workingHours": {
    "start": "11:00",
    "end": "19:00"
  },
  "location": {
    "type": "Point",
    "coordinates": [31.2569, 29.9602]
  }
}
```

---

### 3.3 قائمة التخصصات الطبية المعتمدة
يجب إرسال إحدى القيم النصية التالية حصراً في حقل `specialization`:
1. `باطنة`
2. `أطفال وحديثي الولادة`
3. `أمراض النساء والتوليد وتأخر الإنجاب`
4. `العظام والمفاصل والعمود الفقري`
5. `القلب والأوعية الدموية`
6. `الصدر والجهاز التنفسي`
7. `المخ والأعصاب والطب النفسي`
8. `جهاز هضمي وكبد ومناظير`
9. `الأنف والأذن والحنجرة`
10. `الجلدية والتناسلية والتجميل`
11. `الرمد`
12. `الأسنان`
13. `الجراحة العامة وجراحة المناظير`
14. `الكلى والمسالك البولية`
15. `العلاج الطبيعي والتأهيل`

> 💡 **مسار جلب التخصصات ديناميكياً:**
> بدلاً من تثبيتها في الفرونت إند، يمكنك استدعاء:
> `GET {{BASE_URL}}/api/doctors/specializations`
> ليعيد لك مصفوفة بجميع التخصصات النشطة والمسجلة فعلياً في النظام.

---

## 4. قسم الممرض (Nurse Endpoints)

### 4.1 جلب الملف الشخصي للممرض
* **Method:** `GET`
* **URL:** `{{BASE_URL}}/api/nurses/profile`
* **Headers:** `Authorization: Bearer <NURSE_TOKEN>`
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "67402b3c4d5e6f7a8b9c02",
    "name": "م. سارة محمود علي",
    "email": "nurse.sara@example.com",
    "phoneNumber": "01123456789",
    "address": "مدينة نصر، القاهرة",
    "experience": "خبرة 7 سنوات في الرعاية المركزة وتمريض الحالات الحرجة وغيار الجروح",
    "services": ["تركيب كانيولا", "إعطاء محاليل وريدية", "غيار جروح وقرح فراش"],
    "commissionRate": 10,
    "rating": 4.9,
    "totalReviews": 30,
    "profileImage": "https://example.com/uploads/nurse.jpg",
    "workingHours": {
      "start": "08:00",
      "end": "16:00"
    },
    "offDays": [5],
    "unavailableDates": [],
    "isAvailable": true,
    "isAvailableToday": true,
    "description": "أخصائية تمريض منزلي معتمدة.",
    "location": {
      "type": "Point",
      "coordinates": [31.3301, 30.0561]
    }
  }
}
```

---

### 4.2 تحديث بيانات الممرض
* **Method:** `PATCH`
* **URL:** `{{BASE_URL}}/api/nurses/profile` (أو `{{BASE_URL}}/api/nurses/:id`)
* **Headers:**
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`

#### 📋 جدول الحقول المسموح بها في الـ Request Body (ممرض):
> ⚠️ **ملاحظة:** الممرض ليس لديه حقل `basePrice` أو `secondaryPhoneNumber`. تسعير الخدمات التمريضية مرتبط بقائمة الخدمات `services` أو تسعير الخدمات المركزية.

| الحقل (Field) | النوع (Type) | متطلبات التحقق (Validation) | الوصف |
| :--- | :---: | :--- | :--- |
| `name` | `string` | minLength: 1 | اسم الممرض |
| `email` | `string` | format: email | البريد الإلكتروني |
| `phoneNumber` | `string` | regex: `^01[0125][0-9]{8}$` | رقم هاتف الممرض الأساسي |
| `address` | `string` | minLength: 1 | العنوان السكني للممرض |
| `experience` | `string` | minLength: 1 | تفاصيل الخبرة المهنية وسنوات العمل |
| `services` | `string[]` | مصفوفة نصوص | مصفوفة بأسماء الخدمات التمريضية التي يقدمها |
| `profileImage` | `string` | رابط الصورة | رابط أو مسار الصورة الشخصية |
| `description` | `string` | نص | نبذة تعريفية |
| `isAvailable` | `boolean` | `true` أو `false` | تفعيل / تعطيل استقبال الطلبات عموماً |
| `offDays` | `number[]` | أرقام صحيحة من 0 إلى 6 | أيام الإجازة الأسبوعية |
| `unavailableDates` | `string[]` | مصفوفة تواريخ | تواريخ إجازات استثنائية بصيغة `["YYYY-MM-DD"]` |
| `workingHours` | `object` | `{ start: string, end: string }` | مواعيد العمل اليومية |
| `location` | `object` | GeoJSON Point | `{ "type": "Point", "coordinates": [longitude, latitude] }` |
| `commissionRate` | `number` | min: 0, max: 100 | نسبة العمولة (متاح للأدمن والاستاف فقط) |

#### 💡 مثال Request Body للتحديث (ممرض):
```json
{
  "name": "م. سارة محمود علي",
  "email": "sara.nurse@example.com",
  "phoneNumber": "01123456789",
  "address": "مدينة نصر، الحي السابع، القاهرة",
  "experience": "خبرة 8 سنوات في الرعاية المركزة وتمريض المسنين",
  "services": [
    "تركيب محاليل وكانيولا",
    "سحب عينات تحاليل منزلية",
    "عناية بقرح الفراش وغيار الجروح"
  ],
  "description": "أخصائية تمريض حاصلة على ماجستير التمريض الباطني والجراحي.",
  "isAvailable": true,
  "offDays": [4, 5],
  "workingHours": {
    "start": "09:00",
    "end": "17:00"
  },
  "location": {
    "type": "Point",
    "coordinates": [31.3301, 30.0561]
  }
}
```

---

## 5. المسارات الموحدة للوحة تحكم مزودي الخدمة (Unified Provider Dashboard)

تم توفير مسارات موحدة عبر `/api/provider-dashboard` لتسهيل عمل الفرونت إند في لوحات تحكم وتطبيقات الأطباء والممرضين:

### 5.1 جلب البروفايل الموحد في الداشبورد
* **Method:** `GET`
* **URL:** `{{BASE_URL}}/api/provider-dashboard/profile`
* **Headers:** `Authorization: Bearer <TOKEN>` (Doctor أو Nurse)
* **المميزات الإضافية في الاستجابة:**
  يعيد كائن البروفايل مضافاً إليه معلومات محسوبة مباشرة:
  - `type`: نوع المزود (`"doctor"` أو `"nurse"`).
  - `isAvailableToday`: هل المزود متاح لاستقبال الحجوزات اليوم (`true`/`false`).
  - `isDateBlocked`: هل تاريخ اليوم مضاف لقائمة التواريخ المحظورة `unavailableDates`.
  - `isDayOff`: هل اليوم الحالي هو أحد أيام الإجازة الأسبوعية `offDays`.

---

### 5.2 تحديث البروفايل الموحد
* **Method:** `PATCH`
* **URL:** `{{BASE_URL}}/api/provider-dashboard/profile`
* **Headers:** `Authorization: Bearer <TOKEN>`
* **الوصف:** يقوم السيرفر تلقائياً بالتحقق من دور المستخدم (`Doctor` أو `Nurse`) وتطبيق التحديثات والـ Schema المناسبة له دون الحاجة لتمييز المسار في الفرونت إند.

---

### 5.3 التحكم في استقبال الحجوزات اليوم (Today Availability)
بدلاً من تعديل البروفايل بالكامل لإيقاف أو تشغيل الحجوزات لليوم الحالي، وفر الباك إند مساراً مخصصاً لزر التبديل السريع (Toggle Switch):

#### أ. الاستعلام عن حالة اليوم:
* **Method:** `GET`
* **URL:** `{{BASE_URL}}/api/provider-dashboard/today-availability`
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "date": "2026-09-27",
    "type": "doctor",
    "isAvailableToday": true,
    "isDateBlocked": false,
    "isDayOff": false,
    "isAvailable": true,
    "unavailableDates": []
  }
}
```

#### ب. تفعيل / تعطيل التوفر لليوم الحالي:
* **Method:** `PATCH`
* **URL:** `{{BASE_URL}}/api/provider-dashboard/today-availability`
* **Request Body:**
```json
{
  "isAvailableToday": false
}
```
*(ملاحظة: إذا أرسلت الـ body فارغاً `{}` سيقوم السيرفر بتبديل الحالة Toggle تلقائياً بين متاح وغير متاح).*

---

### 5.4 المسارات السريعة للإجازات والوصف

#### أ. تحديث أيام الإجازة الأسبوعية فقط:
* **Method:** `PATCH`
* **URL:** `{{BASE_URL}}/api/provider-dashboard/off-days`
* **Request Body:**
```json
{
  "offDays": [5, 6]
}
```

#### ب. تحديث النبذة التعريفية فقط:
* **Method:** `PATCH`
* **URL:** `{{BASE_URL}}/api/provider-dashboard/description`
*(أو `PATCH /api/doctors/description` أو `PATCH /api/nurses/description`)*
* **Request Body:**
```json
{
  "description": "استشاري أمراض باطنة وسكري وغدد صماء بمستشفيات جامعة القاهرة..."
}
```

---

## 6. تنسيق البيانات الخاصة (Special Data Types)

### أ. الموقع الجغرافي (`location`):
وفقاً لمعايير الـ GeoJSON الخاصة بـ MongoDB:
* الترتيب الإلزامي هو **`[خط الطول (Longitude), خط العرض (Latitude)]`**.
```json
"location": {
  "type": "Point",
  "coordinates": [31.2569, 29.9602]
}
```
> ⚠️ **خطأ شائع:** إرسال `[Latitude, Longitude]` يؤدي لتخزين الموقع في المحيط الهندي أو رفض الاستعلامات الجغرافية. تأكد دائماً أن الإحداثي الأول هو خط الطول `lng`.

### ب. أيام الإجازة الأسبوعية (`offDays`):
أيام الأسبوع يتم تمثيلها بأرقام مطابقة لدالة `Date.prototype.getDay()` في JavaScript (من 0 إلى 6):
* `0`: الأحد (Sunday)
* `1`: الإثنين (Monday)
* `2`: الثلاثاء (Tuesday)
* `3`: الأربعاء (Wednesday)
* `4`: الخميس (Thursday)
* `5`: الجمعة (Friday)
* `6`: السبت (Saturday)

---

## 7. معالجة الأخطاء (Error Handling)

| كود الحالة (Status) | سبب الخطأ | نموذج الاستجابة من السيرفر |
| :---: | :--- | :--- |
| **`400 Bad Request`** | إرسال حقل غير مسموح به في الـ Schema | `{"success": false, "message": "Validation Error: must NOT have additional properties"}` |
| **`400 Bad Request`** | إرسال Body فارغ (`minProperties: 1`) | `{"success": false, "message": "Validation Error: must NOT have fewer than 1 properties"}` |
| **`400 Bad Request`** | إرسال معرف ID بصيغة غير صالحة | `{"success": false, "message": "معرف الطبيب غير صالح"}` |
| **`401 Unauthorized`** | التوكن مفقود أو منتهي الصلاحية | `{"success": false, "message": "Unauthorized: user not authenticated"}` |
| **`403 Forbidden`** | طبيب أو ممرض يحاول تعديل ملف مزود آخر | `{"success": false, "message": "غير مصرح لك بتعديل بيانات طبيب آخر"}` |
| **`404 Not Found`** | الحساب المسجل لا يمتلك ملف مزود خدمة | `{"success": false, "message": "لم يتم العثور على ملف طبيب مرتبط بهذا الحساب"}` |
| **`409 Conflict`** | البريد الإلكتروني مسجل لحساب مستخدم آخر | `{"success": false, "message": "البريد الإلكتروني مستخدم بالفعل لحساب آخر"}` |
| **`409 Conflict`** | رقم الهاتف مسجل بالفعل لمزود خدمة آخر | `{"success": false, "message": "رقم الهاتف مسجل بالفعل لطبيب آخر"}` |

---

## 8. دوال مساعدة للفرونت إند (Front-end Service Helper - TypeScript / Axios)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
});

// إضافة الـ Bearer Token تلقائياً لكل الطلبات
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ==============================================================
   1. دوال خاصة بالطبيب (Doctor Services)
   ============================================================== */

// جلب بروفايل الطبيب المسجل حالياً
export const getMyDoctorProfile = async () => {
  const res = await api.get('/api/doctors/profile');
  return res.data;
};

// تحديث بروفايل الطبيب المسجل حالياً
export const updateMyDoctorProfile = async (updates: Record<string, any>) => {
  const res = await api.patch('/api/doctors/profile', updates);
  return res.data;
};

// تحديث طبيب بالـ ID (خاص بالأدمن والاستاف)
export const updateDoctorById = async (doctorId: string, updates: Record<string, any>) => {
  const res = await api.patch(`/api/doctors/${doctorId}`, updates);
  return res.data;
};

// جلب قائمة التخصصات الطبية النشطة
export const getDoctorSpecializations = async () => {
  const res = await api.get('/api/doctors/specializations');
  return res.data;
};

/* ==============================================================
   2. دوال خاصة بالممرض (Nurse Services)
   ============================================================== */

// جلب بروفايل الممرض المسجل حالياً
export const getMyNurseProfile = async () => {
  const res = await api.get('/api/nurses/profile');
  return res.data;
};

// تحديث بروفايل الممرض المسجل حالياً
export const updateMyNurseProfile = async (updates: Record<string, any>) => {
  const res = await api.patch('/api/nurses/profile', updates);
  return res.data;
};

// تحديث ممرض بالـ ID (خاص بالأدمن والاستاف)
export const updateNurseById = async (nurseId: string, updates: Record<string, any>) => {
  const res = await api.patch(`/api/nurses/${nurseId}`, updates);
  return res.data;
};

/* ==============================================================
   3. الدوال الموحدة للوحة تحكم وتطبيق المزود (Unified Provider Dashboard)
   ============================================================== */

// جلب بروفايل المزود الحالي (طبيب أو ممرض) مع بيانات التوفر لليوم
export const getProviderProfile = async () => {
  const res = await api.get('/api/provider-dashboard/profile');
  return res.data;
};

// تحديث بروفايل المزود الحالي الموحد
export const updateProviderProfile = async (updates: Record<string, any>) => {
  const res = await api.patch('/api/provider-dashboard/profile', updates);
  return res.data;
};

// جلب حالة توفر المزود لليوم الحالي
export const getTodayAvailability = async () => {
  const res = await api.get('/api/provider-dashboard/today-availability');
  return res.data;
};

// تبديل أو تعيين حالة التوفر لليوم الحالي (زر الـ Switch)
export const toggleTodayAvailability = async (isAvailableToday?: boolean) => {
  const payload = typeof isAvailableToday === 'boolean' ? { isAvailableToday } : {};
  const res = await api.patch('/api/provider-dashboard/today-availability', payload);
  return res.data;
};

// تحديث أيام الإجازة الأسبوعية سريعاً
export const updateProviderOffDays = async (offDays: number[]) => {
  const res = await api.patch('/api/provider-dashboard/off-days', { offDays });
  return res.data;
};

// تحديث النبذة التعريفية سريعاً
export const updateProviderDescription = async (description: string) => {
  const res = await api.patch('/api/provider-dashboard/description', { description });
  return res.data;
};
```
