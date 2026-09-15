# 🚀 Next.js Admin Dashboard - Support Chat Integration Guide

هذا التوثيق الفني مخصص لمطور لوحة التحكم **Next.js** لشرح كيفية بناء صفحة **"الدعم الفني والدردشة" (Support Chat)** والربط اللحظي (Real-Time) مع تطبيق الموبايل (Flutter) باستخدام **Firebase Cloud Firestore**.

---

## 📌 1. المتطلبات الأولية وإعدادات البيئة (Next.js Setup & `.env.local`)

### أ) تثبيت مكتبة Firebase:
في مشروع **Next.js**، قم بتشغيل الأمر التالي لتثبيت الـ Firebase Client SDK:

```bash
npm install firebase
# أو
yarn add firebase
# أو
pnpm add firebase
```

---

### ب) إعداد متغيرات البيئة (`.env.local`):
أنشئ أو عدّل ملف `.env.local` في جذر مشروع Next.js وأضف مفاتيح مشروع Firebase (احصل عليها من مسؤول التطبيق):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## 🛠️ 2. تهيئة ملف Firebase في Next.js (`lib/firebase.ts`)

أنشئ ملفاً باسم `lib/firebase.ts` (أو `src/lib/firebase.ts`) لمنع إعادة تهيئة Firebase عند الـ Hot Reload أو الـ SSR:

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// تجنب تكرار التهيئة في Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
```

---

## 🗄️ 3. هيكل قاعدة البيانات في Firestore (Database Schema)

تلتزم الداش بورد بهيكل الـ Firestore المعمول به في تطبيق الفلاتر:

### 1. مجموعة الشاتات الرئيسية (`chats`)
* **اسم المجموعة (Collection):** `chats`
* **معرف الوثيقة (Document ID):** `chatId` (مثال: `support_123` أو `123`).
* **حقول الشات:**

| اسم الحقل | النوع (Type) | الوصف |
| :--- | :--- | :--- |
| `userId` | `string` | معرف المريض/المستخدم في النظام |
| `userName` | `string` | اسم المستخدم |
| `userImage` | `string` | صورة البروفايل |
| `lastMessage` | `string` | نص آخر رسالة |
| `updatedAt` | `Timestamp` | وقت آخر تحديث (للترتيب التنازلي) |
| `status` | `string` | حالة الشات (`waiting`, `active`, `closed`) |

---

### 2. مجموعة الرسائل الفرعية (`messages`)
* **المسار (Path):** `chats/{chatId}/messages`
* **حقول الرسالة:**

| اسم الحقل | النوع (Type) | الوصف |
| :--- | :--- | :--- |
| `senderId` | `string` | معرف المرسل (`admin` في حالة رد الأدمن) |
| `receiverId` | `string` | معرف المستقبل (معرف المريض) |
| `message` | `string` | نص الرسالة |
| `timestamp` | `Timestamp` | وقت الإرسال من الخادم (`serverTimestamp()`) |

---

## 🎣 4. Custom Hooks للربط اللحظي في Next.js (React Hooks)

يمكنك إنشاء Custom Hooks لتسهيل جلب البيانات وتحديث الواجهة في كود Next.js:

### أ) Hook لجلب قائمة الشاتات (`useChats.ts`):

```typescript
"use client";
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ChatItem {
  chatId: string;
  userId: string;
  userName?: string;
  userImage?: string;
  lastMessage?: string;
  updatedAt?: any;
  status?: string;
}

export function useChats() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const q = query(collection(db, "chats"), orderBy("updatedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map((doc) => ({
        chatId: doc.id,
        ...doc.data(),
      })) as ChatItem[];
      
      setChats(chatData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { chats, loading };
}
```

---

### ب) Hook لجلب رسائل شات محدد وإرسال رد (`useChatMessages.ts`):

```typescript
"use client";
import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp?: any;
}

export function useChatMessages(chatId: string | null) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MessageItem[];

      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  // دالة إرسال الرد من الأدمن
  const sendMessage = async (receiverUserId: string, text: string) => {
    if (!chatId || !text.trim()) return;

    const trimmedText = text.trim();

    // 1. إضافة الرسالة داخل مجموعة الرسائل الفرعية
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: "admin",
      receiverId: receiverUserId,
      message: trimmedText,
      timestamp: serverTimestamp(),
    });

    // 2. تحديث الوثيقة الرئيسية للشات
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: trimmedText,
      updatedAt: serverTimestamp(),
      status: "active",
    });
  };

  return { messages, loading, sendMessage };
}
```

---

## 💻 5. كود كامل لشاشة الشات في Next.js (App Router Example)

أنشئ صفحة الشات في `app/admin/support/page.tsx` (أو `pages/admin/support.tsx` في Pages Router):

```tsx
"use client";

import { useState } from "react";
import { useChats, ChatItem } from "@/hooks/useChats";
import { useChatMessages } from "@/hooks/useChatMessages";

export default function SupportChatPage() {
  const { chats, loading: loadingChats } = useChats();
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const { messages, loading: loadingMessages, sendMessage } = useChatMessages(
    selectedChat?.chatId || null
  );
  const [inputText, setInputText] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedChat) return;

    const textToSend = inputText;
    setInputText("");
    await sendMessage(selectedChat.userId, textToSend);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* القائمة الجانبية - قائمة جميع المحادثات */}
      <div className="w-1/3 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-slate-800 text-white font-bold text-lg">
          💬 الدعم الفني - المحادثات
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-4 text-center text-gray-500">جاري تحميل المحادثات...</div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">لا توجد محادثات حالياً</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.chatId}
                onClick={() => setSelectedChat(chat)}
                className={`p-4 border-b cursor-pointer transition hover:bg-gray-50 ${
                  selectedChat?.chatId === chat.chatId ? "bg-blue-50 border-l-4 border-blue-600" : ""
                }`}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    {chat.userName ? chat.userName[0] : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {chat.userName || `مستخدم (${chat.userId})`}
                    </h4>
                    <p className="text-sm text-gray-500 truncate">
                      {chat.lastMessage || "لا توجد رسائل"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* منطقة الشات الرئيسي عند اختيار محادثة */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedChat ? (
          <>
            {/* الهيدر العلوي للشات المفتوح */}
            <div className="p-4 bg-white border-b flex items-center justify-between shadow-sm">
              <h3 className="font-bold text-gray-800 text-lg">
                محادثة: {selectedChat.userName || selectedChat.userId}
              </h3>
              <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-800">
                نشط الآن
              </span>
            </div>

            {/* عرض الرسائل */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {loadingMessages ? (
                <div className="text-center text-gray-500">جاري جلب الرسائل...</div>
              ) : (
                messages.map((msg) => {
                  const isAdmin = msg.senderId === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-md p-3 rounded-lg shadow-sm text-sm ${
                          isAdmin
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-white text-gray-800 border rounded-bl-none"
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* نموذج إرسال الرد */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب ردك هنا..."
                className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                إرسال
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
            اختر محادثة من القائمة الجانبية للبدء في الرد
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🛡️ 6. شروط وقواعد الأمان (Firestore Rules)

تأكد أن البيانات المرسلة من Next.js تحتوي على الحقول المطلوبة لكي تقبلها قواعد أمان Firestore دون أخطاء (`Permission Denied`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId}/messages/{messageId} {
      allow read, create: if request.resource.data.keys().hasAll(['senderId', 'receiverId', 'message', 'timestamp'])
                          && request.resource.data.message is string
                          && request.resource.data.message.size() > 0
                          && request.resource.data.message.size() <= 2000;

      allow update, delete: if false;
    }
  }
}
```

---

## 🔔 7. (اختياري) إرسال إشعارات لحظية لـ Flutter الموبايل عبر Next.js API Route

إذا أردت إرسال Push Notification للموبايل عبر **FCM** عند الرد من الأدمن، يمكنك إنشاء Route Handler في Next.js:

أنشئ ملف `app/api/send-notification/route.ts`:

```typescript
import { NextResponse } from 'next/server';
// يمكنك استخدام firebase-admin هنا لإرسال الإشعارات بواسطة FCM Token الخاص بالمريض
export async function POST(request: Request) {
  const { userFcmToken, title, body } = await request.json();

  // كود إرسال الإشعار لـ FCM
  return NextResponse.json({ success: true });
}
```

---

### 💡 ملخص سريع لمطور Next.js:
1. أنشئ ملف `.env.local` ببيانات الـ Firebase Config.
2. أنشئ `lib/firebase.ts` لتهيئة الـ Firestore.
3. استخدم الـ Hooks المرفقة (`useChats` و `useChatMessages`) لبناء الواجهة وربط الشات لحظياً مع تطبيق الموبايل (Flutter).
