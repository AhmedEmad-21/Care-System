# 📚 توثيق ربط تطبيق Flutter بإشعارات وشات الدعم الفني للاستاف

### 1. الهدف من العملية
عند إرسال أي مستخدم (**طبيب Doctor** أو **ممرض Nurse** أو **مريض Patient**) رسالة جديدة في شات الدعم الفني من تطبيق الموبايل (Flutter)، يقوم التطبيق بتنفيذ العمليات التالية في قاعدة بيانات **Firestore**:

1. **حفظ الرسالة** في المحادثة الفرعية (`chats/{chatId}/messages`).
2. **تحديث وثيقة الشات الرئيسية** (`chats/{chatId}`) بآخر رسالة ودور المستخدم (`userRole`) وحالة المحادثة.
3. **إنشاء إشعار لحظي** في كوليكشن الإشعارات (`notifications`) ليظهر تنبيه فوري في جرس الإشعارات للـ Staff في لوحة التحكم مع بادج الدور المناسب (طبيب 🩺 / ممرض 💉 / مريض 👤) ورابط يفتح المحادثة مباشرة.

---

### 2. الكود المطلوب تنفيذه في تطبيق Flutter (Dart)

مكان الكود: يتم وضعه في دالة إرسال الرسالة (`sendMessageToSupport`) في خدمة الشات (ChatService أو ViewModel):

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

  // تحديد المسمى العربي والأيقونة بحسب دور المرسل
  final String roleInArabic = switch (userRole) {
    'Doctor' => 'طبيب',
    'Nurse' => 'ممرض',
    _ => 'مريض',
  };

  try {
    // 1. حفظ الرسالة داخل كوليكشن الشات
    await firestore.collection('chats').doc(chatId).collection('messages').add({
      'senderId': userId,
      'receiverId': 'admin',
      'message': trimmedText,
      'senderRole': userRole,
      'timestamp': FieldValue.serverTimestamp(),
    });

    // 2. تحديث المستند الرئيسي للشات
    await firestore.collection('chats').doc(chatId).set({
      'userId': userId,
      'userName': userName,
      'userRole': userRole,
      'lastMessage': trimmedText,
      'updatedAt': FieldValue.serverTimestamp(),
      'status': 'pending', // بانتظار رد الاستاف
    }, SetOptions(merge: true));

    // 3. إنشاء إشعار فوري في مجموعة notifications ليظهر لحظياً للاستاف في لوحة التحكم
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

### 3. ماذا يحدث في لوحة تحكم الاستاف (Admin Dashboard)؟

1. **جرس الإشعارات (Notification Bell):**
   - يزداد العداد التلقائي (Unread Count) باللون الأحمر مع تأثير نابض.
   - تظهر الرسالة بأعلى القائمة مصنفة ببادج ملون وفق الدور:
     - 🩺 **طبيب** (أزرق)
     - 💉 **ممرض** (تيل / تركواز)
     - 👤 **مريض** (بنفسجي)
   - يتم احتساب وحساب الوقت البشري الذكي (مثلاً: "الآن"، "منذ دقيقتين").

2. **الانتقال السريع إلى الشات:**
   - عند النقر على الإشعار أو زر "الانتقال إلى الشات"، يتم توجيه موظف الاستاف مباشرة إلى صفحة الشات `/dashboard/support?chatId=...` ويتم فتح محادثة الطبيب أو الممرض أو المريض تلقائياً ليتمكن الاستاف من الرد فوراً.
