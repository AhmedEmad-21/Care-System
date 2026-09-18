Viewed doctorController.js:25-70
Viewed doctorController.js:70-181
Viewed nameSearch.js:1-60
Viewed nurseController.js:1-100
Viewed nurseController.js:101-171
Searched for "matchingService"
Viewed matchingService.js:45-80
Viewed matchingService.js:125-170
Listed directory utils
Viewed timezone.js:1-55
Created dateUtils.js
Viewed doctorModel.js:15-34
Edited doctorModel.js
Viewed nurseModel.js:15-30
Edited nurseModel.js
Viewed staffDoctorUpdateValidate.js:45-58
Edited staffDoctorUpdateValidate.js
Viewed staffNurseUpdateValidate.js:30-38
Edited staffNurseUpdateValidate.js
Viewed staffDoctorCreateValidate.js:45-54
Edited staffDoctorCreateValidate.js
Viewed staffNurseCreateValidate.js:25-36
Edited staffNurseCreateValidate.js
Viewed nameSearch.js:50-80
Edited nameSearch.js
Viewed filterAvailableDoctorsMW.js:30-50
Edited filterAvailableDoctorsMW.js
Viewed matchingService.js:48-65
Viewed matchingService.js:125-165
Edited matchingService.js
Edited matchingService.js
Viewed doctorController.js:20-75
Viewed doctorController.js:115-181
Edited doctorController.js
Viewed doctorController.js:120-181
Viewed doctorController.js:180-203
Edited doctorController.js
Viewed doctorRoutes.js:1-17
Edited doctorRoutes.js
Viewed nurseController.js:1-50
Viewed nurseController.js:50-171
Edited nurseController.js
Viewed nurseController.js:75-195
Viewed nurseController.js:190-196
Edited nurseController.js
Viewed nurseRoutes.js:1-17
Edited nurseRoutes.js
Viewed providerDashboardService.js:45-95
Viewed providerDashboardService.js:340-386
Edited providerDashboardService.js
Viewed providerDashboardService.js:80-95
Edited providerDashboardService.js
Viewed providerDashboardService.js:360-391
Edited providerDashboardService.js
Viewed providerDashboardController.js:80-104
Viewed providerDashboardController.js:1-25
Edited providerDashboardController.js
Viewed providerDashboardRoutes.js:1-26
Edited providerDashboardRoutes.js
Viewed bookingService.js:80-140
Viewed bookingService.js:180-235
Edited bookingService.js
Viewed bookingService.js:125-145
Edited bookingService.js
Viewed bookingService.js:240-265
Edited bookingService.js
Viewed bookingController.js:8-35
Edited bookingController.js
Ran command: `node -c src/utils/dateUtils.js src/models/doctorModel.js src/models/nurseModel.js src/utils/staffDoctorUpdateValidate.js src/utils/staffDoctorCreateValidate.js src/utils/staffNurseUpdateValidate.js src/utils/staffNurseCreateValidate.js src/utils/nameSearch.js src/middlewares/filterAvailableDoctorsMW.js src/services/matchingService.js src/controllers/doctorController.js src/routes/doctorRoutes.js src/controllers/nurseController.js src/routes/nurseRoutes.js src/services/providerDashboardService.js src/controllers/providerDashboardController.js src/routes/providerDashboardRoutes.js src/services/bookingService.js src/controllers/bookingController.js`
Ran command: `node -e "
const { getTodayDateString } = require('./src/utils/dateUtils');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const doctorUpdate = ajv.compile(require('./src/utils/staffDoctorUpdateValidate'));
const nurseUpdate = ajv.compile(require('./src/utils/staffNurseUpdateValidate'));

const docValid = doctorUpdate({ description: 'طبيب استشاري متميز', unavailableDates: ['2026-09-18'] });
console.log('Doctor update validate description:', docValid, doctorUpdate.errors || 'OK');

const nurseValid = nurseUpdate({ description: 'أخصائي تمريض رعاية حرجة', unavailableDates: ['2026-09-18'] });
console.log('Nurse update validate description:', nurseValid, nurseUpdate.errors || 'OK');

const todayStr = getTodayDateString();
console.log('Today date string:', todayStr);

const { withOptionalDateFilter } = require('./src/utils/nameSearch');
const filterToday = withOptionalDateFilter({ isAvailable: true });
console.log('Filter today:', filterToday);

const filterTomorrow = withOptionalDateFilter({ isAvailable: true }, '2026-09-19');
console.log('Filter tomorrow:', filterTomorrow);
"`
Viewed Doctor&Nurse_DASHBOARD.md:1-60
Viewed Doctor&Nurse_DASHBOARD.md:180-208
Edited Doctor&Nurse_DASHBOARD.md
Ran command: `git status -s`
Ran command: `node -c src/utils/dateUtils.js src/models/doctorModel.js src/models/nurseModel.js src/utils/staffDoctorUpdateValidate.js src/utils/staffDoctorCreateValidate.js src/utils/staffNurseUpdateValidate.js src/utils/staffNurseCreateValidate.js src/utils/nameSearch.js src/middlewares/filterAvailableDoctorsMW.js src/services/matchingService.js src/controllers/doctorController.js src/routes/doctorRoutes.js src/controllers/nurseController.js src/routes/nurseRoutes.js src/services/providerDashboardService.js src/controllers/providerDashboardController.js src/routes/providerDashboardRoutes.js src/services/bookingService.js src/controllers/bookingController.js`
Viewed Doctor&Nurse_DASHBOARD.md:170-250
Viewed Doctor&Nurse_DASHBOARD.md:245-313
Viewed SEARCH_ENDPOINTS.md:1-60
Searched for "offDays"
Edited SEARCH_ENDPOINTS.md
Viewed SEARCH_ENDPOINTS.md:60-100
Edited SEARCH_ENDPOINTS.md

تم تنفيذ المطلوب بالكامل وبأعلى درجات الدقة والاحترافية. فيما يلي توضيح شامل لجميع التعديلات والـ Endpoints الجديدة وطريقة عملها:

---

### 1. إضافة حقل الوصف التعريفي (`description`)

#### أ) تعديل الـ Schemas وقواعد البيانات:
- **في [`doctorModel.js`](file:///e:/Care%20System/src/models/doctorModel.js) و [`nurseModel.js`](file:///e:/Care%20System/src/models/nurseModel.js):**
  تمت إضافة الحقل الاختياري:
  ```javascript
  description: {
    type: String,
    default: '',
    trim: true,
  }
  ```
- **في الـ Validation Schemas (AJV):**
  تم السماح بحقل `description` كحقل نصي اختياري في عمليات الإنشاء والتعديل:
  - [`staffDoctorCreateValidate.js`](file:///e:/Care%20System/src/utils/staffDoctorCreateValidate.js) & [`staffDoctorUpdateValidate.js`](file:///e:/Care%20System/src/utils/staffDoctorUpdateValidate.js)
  - [`staffNurseCreateValidate.js`](file:///e:/Care%20System/src/utils/staffNurseCreateValidate.js) & [`staffNurseUpdateValidate.js`](file:///e:/Care%20System/src/utils/staffNurseUpdateValidate.js)

#### ب) الـ Endpoints المخصصة لإضافة وتعديل الوصف (`description`):
1. **للطبيب (من حسابه الشخصي):**
   - **Method & Path:** `PATCH /api/doctors/description`
   - **Auth:** Bearer Token (Doctor)
   - **Body (JSON):**
     ```json
     {
       "description": "استشاري جراحة العظام والمفاصل، زميل الكلية الملكية للجراحين، خبرة أكثر من 12 عاماً."
     }
     ```
2. **للممرض (من حسابه الشخصي):**
   - **Method & Path:** `PATCH /api/nurses/description`
   - **Auth:** Bearer Token (Nurse)
   - **Body (JSON):**
     ```json
     {
       "description": "أخصائي تمريض ورعاية حرجة، خبرة في التعامل مع كبار السن وتركيب المحاليل والغيار على الجروح."
     }
     ```
3. **للإدارة / الاستاف لتعديل وصف أي طبيب أو ممرض عبر الـ ID:**
   - `PATCH /api/doctors/:id/description`
   - `PATCH /api/nurses/:id/description`
4. **من خلال داش بورد الطبيب / الممرض الموحدة (`Provider Dashboard`):**
   - **Method & Path:** `PATCH /api/provider-dashboard/description`
   - يقوم بالسحب والتحديث التلقائي بحسب نوع الحساب المسجل (Doctor أو Nurse).

---

### 2. ميزة زر حالة استقبال الحجوزات اليوم (On/Off) في الداش بورد

#### أ) الفكرة والتصميم المعماري الذكي:
- تمت إضافة حقل `unavailableDates: [String]` في كل من نموذج الطبيب والممرض (يخزن التواريخ بصيغة `YYYY-MM-DD`).
- **لماذا هذا التصميم؟**
  1. عندما يقوم الطبيب أو الممرض بإيقاف استقبال الحجوزات **لليوم الحالي** (مثلاً `2026-09-18`)، يتم إضافة هذا التاريخ إلى `unavailableDates`.
  2. في اليوم التالي (`2026-09-19`)، يعود المزود متاحاً تلقائياً بدون الحاجة لأي Cron Job أو أن يتذكر تشغيله يدوياً.
  3. **الأهم:** يظل الطبيب أو الممرض **ظاهراً ومتاحاً للحجز في أي يوم آخر** (غداً أو بعد غد...)، وفقط يتم استبعاده إذا كان بحث المريض أو موعد الكشف في اليوم المعطل نفسه.
  4. إذا حاول أي مريض إرسال طلب حجز في هذا اليوم يرفض الـ Backend فوراً برسالة واضحة: *"الطبيب/الممرض غير متاح لاستقبال الحجوزات في هذا التاريخ المحدد (YYYY-MM-DD). يرجى اختيار موعد في يوم آخر."*

#### ب) الـ Endpoints في روت الداش بورد (`/api/provider-dashboard`):

##### 1. جلب حالة اليوم (استعلام حالة الزر):
- **Method & Path:** `GET /api/provider-dashboard/today-availability`
- **Auth:** Bearer Token (Doctor / Nurse)
- **Response:**
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

##### 2. تغيير حالة اليوم (Toggle أو إرسال القيمة المطلوبة):
- **Method & Path:** `PATCH /api/provider-dashboard/today-availability`
- **Auth:** Bearer Token (Doctor / Nurse)
- **Request Body (اختياري - إذا أُرسل فارغاً يقوم بعمل Toggle تلقائي):**
  ```json
  {
    "isAvailableToday": false
  }
  ```
- **Response عند الإيقاف:**
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
      "unavailableDates": [
        "2026-09-18"
      ]
    }
  }
  ```

##### 3. جلب بيانات البروفايل كاملة للداش بورد:
- **Method & Path:** `GET /api/provider-dashboard/profile`
- يُرجع بيانات الطبيب أو الممرض كاملة متضمنة `description`, `isAvailableToday`, `offDays`, `unavailableDates`, إلخ.

---

### 3. تطبيق الفلترة والاستبعاد على جميع مسارات وخدمات البحث

تم تحديث الاستعلامات في النظام لتأخذ `unavailableDates` في الحسبان بجانب `offDays`:
1. **قوائم الكشف والبحث للأطباء والممرضين:**
   - [`doctorController.js`](file:///e:/Care%20System/src/controllers/doctorController.js): `listDoctors`, `listAvailableDoctors`, `filterDoctors`
   - [`nurseController.js`](file:///e:/Care%20System/src/controllers/nurseController.js): `listNurses`, `listNursesByService`, `filterNurses`
2. **البحث بالاسم والـ Nearby:**
   - [`nameSearch.js`](file:///e:/Care%20System/src/utils/nameSearch.js): تم تحديث `withOptionalDateFilter`
   - [`filterAvailableDoctorsMW.js`](file:///e:/Care%20System/src/middlewares/filterAvailableDoctorsMW.js): استبعاد الأطباء الذين أوقفوا استقبال اليوم تلقائياً.
3. **محرك الترشيح الذكي ومطابقة الأطباء البدلاء:**
   - [`matchingService.js`](file:///e:/Care%20System/src/services/matchingService.js): `buildDoctorQuery` و `getAlternativeDoctors`.
4. **حماية إنشاء الحجوزات في السيرفر:**
   - [`bookingService.js`](file:///e:/Care%20System/src/services/bookingService.js): `createDoctorBooking` و `createNursingBooking` للتحقق الحاسم قبل إنشاء الحجز.
