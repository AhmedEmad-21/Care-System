

# 📚 Documentation: ربط تطبيق Flutter بإشعارات الداش بورد

### 1. الهدف من العملية

عند إرسال رسالة جديدة من تطبيق المريض (Flutter) إلى الدعم الفني، يجب على التطبيق تنفيذ أمرين في قاعدة بيانات **Firestore** بـ "ضربة واحدة" (Batch أو تسلسل):

1. حفظ الرسالة داخل مجموعة المحادثة (`chats/{chatId}/messages`).
2. إضافة مستند جديد في مجموعة الإشعارات العامة (`notifications`) ليظهر تنبيه مباشر وفوري للإستاف في لوحة التحكم (Dashboard).

---

### 2. الكود المطلوب تنفيذه في تطبيق Flutter (Dart)

مكان الكود: يتم وضعه في **دالة إرسال الرسالة (Send Message Function)** داخل الـ ViewModel، Controller، أو الـ Service المسؤولة عن الشات في تطبيق الفلتر.

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

Future<void> sendPatientMessageToSupport({
  required String chatId,
  required String userId,
  required String userName,
  required String messageText,
}) async {
  final firestore = FirebaseFirestore.instance;
  final trimmedText = messageText.trim();

  if (trimmedText.isEmpty) return;

  try {
    // 1. حفظ الرسالة داخل كوليكشن الشات الخاص بالمستخدم
    await firestore.collection('chats').doc(chatId).collection('messages').add({
      'senderId': userId,
      'receiverId': 'admin',
      'message': trimmedText,
      'timestamp': FieldValue.serverTimestamp(),
    });

    // 2. تحديث المستند الرئيسي للشات (لترتيب القائمة وتحديث آخر رسالة)
    await firestore.collection('chats').doc(chatId).set({
      'userId': userId,
      'userName': userName,
      'lastMessage': trimmedText,
      'updatedAt': FieldValue.serverTimestamp(),
      'status': 'pending', // بانتظار رد الإستاف
    }, SetOptions(merge: true));

    // 3. إنشاء إشعار جديد (Notification) ليظهر فوراً في الداش بورد للإستاف
    await firestore.collection('notifications').add({
      'title': 'رسالة جديدة من مريض',
      'body': 'لديك رسالة جديدة من المستخدم: $userName',
      'read': false,
      'createdAt': FieldValue.serverTimestamp(),
      'link': '/dashboard/support',
    });

  } catch (e) {
    print('Error sending message and notification: $e');
    rethrow;
  }
}

```

---

### 3. ملاحظات هامة لتطبيق الفلتر (Flutter)

* **الصلاحيات (Firestore Rules):** تأكد إن قواعد الأمان في الـ Firebase عندك تسمح لـ `Authenticated Users` بكتابة مستندات في كوليكشن `notifications` أو إنك بتظبطها بحيث التطبيق يقدر يضيف إشعار جديد.
* **الـ Link:** تم توجيه الحقل `link` إلى `/dashboard/support` بحيث لو الاستاف ضغط على الإشعار في الداش بورد يوديه مباشرة على صفحة الدعم الفني ومحادثة المريض ده.

---

بكده الدوكيوتاشن بقت جاهزة تماماً، وتقدر تديها لأي مهندس موبايل أو تطبقها بنفسك في تطبيق الفلتر.

الخطوة اللي عليها الدور في الداش بورد عندنا: **نعمل زر الإشعارات (Bell Icon with Dropdown)** فوق في الهيدر عشان الاستاف يشوفوا التראخيص دي أول بأول. تحب نكتب كوده؟