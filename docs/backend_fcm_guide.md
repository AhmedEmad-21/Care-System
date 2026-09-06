# دليل تنفيذ الإشعارات (Push Notifications) وصفحة التنبيهات في الباك إند (Node.js)

هذا الملف يحتوي على الشرح التفصيلي الكامل لمطور الـ Node.js لتنفيذ خدمة الـ Push Notifications باستخدام **Firebase Cloud Messaging (FCM)** وربطها مع تطبيق الهاتف **طبيبك AI**.

---

## 📁 ملف الاعتماد المرفق
يجب استخدام ملف الاعتماد المنزل من Firebase واسمه:
`tabibak-ai-firebase-adminsdk-fbsvc-ceb7855a6e.json`

---

## 1️⃣ أولاً: وضع ملف JSON وتهيئة Firebase في Node.js

1. ضع الملف المرفق داخل مشروع الباك إند (مثلاً في مجلد `src/config/`).
   > ⚠️ **ملاحظة أمنية**: لا تقم برفع هذا الملف على GitHub في Public Repo (أضفه لملف `.gitignore`).

2. قم بتثبيت حزمة Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

3. أنشئ ملف تهيئة Firebase (مثلاً `src/config/firebase.js`):
   ```javascript
   const admin = require('firebase-admin');
   // استيراد ملف الـ JSON المرفق
   const serviceAccount = require('./tabibak-ai-firebase-adminsdk-fbsvc-ceb7855a6e.json');

   admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
   });

   module.exports = admin;
   ```

---

## 2️⃣ ثانياً: جداول قاعدة البيانات المطلوب إنشاؤها (Database Schemas)

نحتاج جدولين في قاعدة البيانات:

### أ. جدول توكنز الأجهزة (`UserDeviceTokens`)
*لتخزين توكن الـ FCM الخاص بجهاز كل مستخدم:*
- `id`: المعرف (Primary Key)
- `user_id`: معرف المستخدم (Foreign Key)
- `fcm_token`: نص التوكن (String, Unique/Indexed)
- `device_type`: نوع الجهاز (`'android'` أو `'ios'`)
- `created_at` / `updated_at`

### ب. جدول الإشعارات (`Notifications`)
*لتخزين الإشعارات لعرضها داخل صفحة التنبيهات في التطبيق:*
- `id`: المعرف (Primary Key)
- `user_id`: معرف المستخدم (Foreign Key)
- `title`: عنوان الإشعار (String)
- `body`: نص الإشعار (String)
- `type`: نوع الإشعار (مثال: `'booking_status'`, `'nursing'`, `'reminder'`, `'general'`)
- `data`: بيانات إضافية (JSON Object - مثال: `{ "booking_id": "123" }`)
- `is_read`: هل تم قراءته؟ (Boolean - الافتراضي: `false`)
- `created_at`: تاريخ الإشعار (Timestamp)

---

## 3️⃣ ثالثاً: الـ REST API Endpoints المطلوبة للتطبيق

التطبيق مبرمج حالياً ليتعامل مع الـ Endpoints التالية (يرجى الالتزام بالأسماء والـ Request/Response):

---

### 1. تسجيل/حفظ توكن الجهاز
- **Method**: `POST`
- **URL**: `/api/notifications/fcm-token`
- **Headers**: `Authorization: Bearer <user_token>`
- **Request Body**:
  ```json
  {
    "fcm_token": "eXamPle_Fcm_ToKeN_StRiNg...",
    "device_type": "android"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "FCM Token registered successfully"
  }
  ```

---

### 2. حذف توكن الجهاز (عند تسجيل الخروج)
- **Method**: `DELETE`
- **URL**: `/api/notifications/fcm-token`
- **Headers**: `Authorization: Bearer <user_token>`
- **Request Body**:
  ```json
  {
    "fcm_token": "eXamPle_Fcm_ToKeN_StRiNg..."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "Token removed"
  }
  ```

---

### 3. جلب قائمة التنبيهات للمستخدم
- **Method**: `GET`
- **URL**: `/api/notifications`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "unread_count": 2,
    "data": [
      {
        "id": "notif_101",
        "title": "تم تأكيد الحجز 📅",
        "body": "تم تأكيد موعدك مع د. أحمد علي غداً في تمام الساعة 4 مساءً",
        "type": "booking_status",
        "data": {
          "booking_id": "550"
        },
        "is_read": false,
        "created_at": "2026-09-03T20:30:00.000Z"
      },
      {
        "id": "notif_100",
        "title": "مرحباً بك في طبيبك AI 👋",
        "body": "يمكنك الآن استشارة الذكاء الاصطناعي لحجز التخصص المناسب",
        "type": "general",
        "data": {},
        "is_read": true,
        "created_at": "2026-09-02T12:00:00.000Z"
      }
    ]
  }
  ```

---

### 4. تحديد إشعار معين كـ "مقروء"
- **Method**: `PATCH`
- **URL**: `/api/notifications/:id/read`   *(مثال: `/api/notifications/notif_101/read`)*
- **Headers**: `Authorization: Bearer <user_token>`
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "Notification marked as read"
  }
  ```

---

### 5. تحديد جميع إشعارات المستخدم كـ "مقروءة"
- **Method**: `PATCH`
- **URL**: `/api/notifications/read-all`
- **Headers**: `Authorization: Bearer <user_token>`
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "All notifications marked as read"
  }
  ```

---

### 6. حذف إشعار معين
- **Method**: `DELETE`
- **URL**: `/api/notifications/:id`   *(مثال: `/api/notifications/notif_101`)*
- **Headers**: `Authorization: Bearer <user_token>`
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "Notification deleted"
  }
  ```

---

## 4️⃣ رابعاً: دالة إرسال الـ Push Notification في الباك إند

يمكنك إنشاء دالة Helper مثل كود Node.js التالي واستدعائها كلما أردت إرسال إشعار للمستخدم (مثلاً عند قبول موعد، تغير حالة حجز، إلخ):

```javascript
const admin = require('./config/firebase');
const { UserDeviceTokens, Notifications } = require('./models'); // استبدلها بنماذج الداتابيز لديك

/**
 * دالة إرسال إشعار لمستخدم وحفظه في الداتابيز
 */
async function sendNotificationToUser({ userId, title, body, type = 'general', data = {} }) {
  try {
    // 1. حفظ الإشعار في قاعدة البيانات أولاً
    const notification = await Notifications.create({
      user_id: userId,
      title,
      body,
      type,
      data: JSON.stringify(data),
      is_read: false
    });

    // 2. جلب جميع توكنز FCM الخاصة بهذا المستخدم
    const userTokens = await UserDeviceTokens.findAll({ where: { user_id: userId } });
    const tokens = userTokens.map(t => t.fcm_token).filter(Boolean);

    if (tokens.length === 0) {
      console.log(`لا يوجد توكنز مسجلة للمستخدم: ${userId}`);
      return notification;
    }

    // 3. تجهيز رسالة Push Notification
    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body
      },
      data: {
        type: type,
        notification_id: String(notification.id),
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]); // FCM تتطلب أن تكون القيم في data نصوص Strings
          return acc;
        }, {})
      }
    };

    // 4. الإرسال عبر Firebase FCM
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`تم إرسال الإشعار بنجاح لـ ${response.successCount} جهاز.`);

    // 5. مسح التوكنز المنتهية أو غير الصالحة إن وجدت
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await UserDeviceTokens.destroy({ where: { fcm_token: failedTokens } });
        console.log(`تم حذف ${failedTokens.length} توكن منتهي الصلاحية.`);
      }
    }

    return notification;
  } catch (error) {
    console.error('خطأ في إرسال الإشعار:', error);
    throw error;
  }
}

module.exports = { sendNotificationToUser };
```
