# 💬 دليل شات ودعم العملاء لتطبيقات الموبايل (CHAT_FLUTTER_GUIDE.md)

> **مخصص لفريق الفلاتر (Flutter):** يوضح هذا المستند الآلية الموحدة لنظام شات الدعم الفني عبر **Firebase Firestore** لجميع فئات المستخدمين (**أطباء، ممرضين، ومرضى**)، وكيفية إرسال التنبيهات اللحظية لتظهر فوراً في جرس إشعارات لوحة تحكم الاستاف (Staff Dashboard).

---

## 1. الهيكل المعتمد لقاعدة بيانات Firestore

### أ. المجموعة الرئيسية (Collection: `chats`)
* **معرف الوثيقة (Document ID):** `chatId` (أو `support_${userId}`).
* **حقول الوثيقة (Chat Metadata):**
  * `userId`: معرف المستخدم (String - إجباري).
  * `userName`: اسم المستخدم (String - إجباري، مثل: "د. حازم" أو "محمد أحمد").
  * `userRole`: دور المستخدم (String - إجباري: `'Doctor'` أو `'Nurse'` أو `'Patient'`).
  * `userImage`: صورة المستخدم الشخصية إن وجدت (String - اختياري).
  * `lastMessage`: نص آخر رسالة أُرسلت (String).
  * `updatedAt`: وقت آخر رسالة للترتيب (Timestamp: `FieldValue.serverTimestamp()`).
  * `status`: حالة المحادثة (`'pending'` بانتظار رد الاستاف، أو `'active'` قيد المحادثة، أو `'closed'`).

### ب. المجموعة الفرعية للرسائل (Sub-collection: `messages`)
* **المسار:** `chats/{chatId}/messages`
* **حقول الرسالة:**
  * `senderId`: معرف المرسل (`userId` للمستخدم، أو `'admin'` للاستاف).
  * `receiverId`: معرف المستلم (`'admin'` أو `userId`).
  * `senderRole`: دور المرسل (`'Doctor'` | `'Nurse'` | `'Patient'` | `'Staff'`).
  * `message`: نص الرسالة (String).
  * `timestamp`: وقت الإرسال (`FieldValue.serverTimestamp()`).

### ج. مجموعة إشعارات الاستاف (Collection: `notifications`)
لكي يظهر إشعار فوري في جرس لوحة تحكم الاستاف مع بادج ملون وصوت التنبيه، يتم إنشاء وثيقة جديدة في مجموعة `notifications`:
* `title`: `رسالة جديدة من ${roleInArabic}: ${userName}` (مثلاً: "رسالة جديدة من طبيب: د. أحمد").
* `body`: نص الرسالة أو ملخصها.
* `read`: `false` (Boolean).
* `createdAt`: `FieldValue.serverTimestamp()`.
* `link`: `/dashboard/support?chatId=${chatId}` (رابط التوجيه المباشر للشات).
* `chatId`: معرف المحادثة.
* `senderRole`: دور المستخدم (`'Doctor'` | `'Nurse'` | `'Patient'`).
* `senderName`: اسم المستخدم.
* `type`: `'support_message'`.

---

## 2. كود الإرسال المتكامل في تطبيق Flutter (Dart)

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

Future<void> sendMessageToSupport({
  required String chatId,
  required String userId,
  required String userName,
  required String userRole, // 'Doctor' | 'Nurse' | 'Patient'
  required String messageText,
}) async {
  final firestore = FirebaseFirestore.instance;
  final trimmedText = messageText.trim();

  if (trimmedText.isEmpty) return;

  // تحديد المسمى العربي بحسب الدور
  final String roleInArabic = switch (userRole) {
    'Doctor' => 'طبيب',
    'Nurse' => 'ممرض',
    _ => 'مريض',
  };

  try {
    // 1. إضافة الرسالة في مجموعة messages
    await firestore.collection('chats').doc(chatId).collection('messages').add({
      'senderId': userId,
      'receiverId': 'admin',
      'message': trimmedText,
      'senderRole': userRole,
      'timestamp': FieldValue.serverTimestamp(),
    });

    // 2. تحديث وثيقة الشات الرئيسية
    await firestore.collection('chats').doc(chatId).set({
      'userId': userId,
      'userName': userName,
      'userRole': userRole,
      'lastMessage': trimmedText,
      'updatedAt': FieldValue.serverTimestamp(),
      'status': 'pending', // بانتظار رد الاستاف
    }, SetOptions(merge: true));

    // 3. إنشاء إشعار فوري في مجموعة notifications ليظهر لحظياً للاستاف في الداش بورد
    await firestore.collection('notifications').add({
      'title': 'رسالة جديدة من $roleInArabic: $userName',
      'body': trimmedText.length > 80 ? '${trimmedText.substring(0, 80)}...' : trimmedText,
      'read': false,
      'createdAt': FieldValue.serverTimestamp(),
      'link': '/dashboard/support?chatId=$chatId',
      'chatId': chatId,
      'senderRole': userRole,
      'senderName': userName,
      'type': 'support_message',
    });

  } catch (e) {
    print('Error sending message and notification to support: $e');
    rethrow;
  }
}
```

---

## 3. البديل عبر الـ REST API (اختياري)
إذا رغب التطبيق في إرسال استفسار عبر الـ HTTP Backend بدلاً من Firestore المباشر:
* **Endpoint:** `POST /api/support/message` (أو `POST /api/notifications/support-message`)
* **Headers:** `Authorization: Bearer <token>`
* **Body:**
  ```json
  {
    "message": "نص الرسالة أو المشكلة",
    "subject": "موضوع المشكلة (اختياري)",
    "bookingNumber": 1002
  }
  ```
* يتولى السيرفر تلقائياً إرسال إشعارات FCM لجميع أجهزة الاستاف ومزامنة الإشعار على Firestore في نفس اللحظة!

---

## 4. عرض فواصل الأيام في واجهة المحادثة (Chat Date Dividers)
لضمان تجربة مستخدم واضحة وممتازة (مثل واتساب وتيليجرام) عند تراسل المستخدم في أيام متفرقة:
* يتم فحص حقل `timestamp` لكل رسالة.
* إذا كان تاريخ الرسالة الحالية يختلف عن تاريخ الرسالة السابقة، يتم إظهار شريط/بادج فاصل في المنتصف:
  * **اليوم:** للرسائل التي تم إرسالها خلال اليوم الحالي.
  * **أمس:** للرسائل المرسلة أمس.
  * **اسم اليوم والتاريخ (مثلاً: الخميس، 18 سبتمبر):** للرسائل الأقدم.
