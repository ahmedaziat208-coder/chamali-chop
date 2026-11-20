# الشمالي شوب – CHAMALI SHOP

متجر إلكتروني مغربي متكامل متعدد المنتجات واللغات (العربية مع دعم كامل لـ RTL، الدارجة المغربية، الفرنسية، والإنجليزية) مبني باستخدام:

- **الواجهة الأمامية**: React 19 + TypeScript + Tailwind CSS v4
- **الخادم الخلفي**: Node.js + Express + Zod + Rate Limiting
- **قاعدة البيانات**: PostgreSQL + Drizzle ORM (معاملات ذرية لحماية المخزون ومنع الطلبات المكررة)
- **المصادقة والأمان**: Firebase Authentication (Google Sign-In) + نظام صلاحيات RBAC + Audit Logs
- **الذكاء الاصطناعي**: Gemini API (`@google/genai`) مع استدعاء الدوال (Function Calling) للتحقق من المنتجات والأسعار والمخزون الحقيقي وتسجيل الطلبات
- **WhatsApp Business الرسمي**: Meta WhatsApp Cloud API (Graph API v21.0) مع التحقق من التوقيع `X-Hub-Signature-256`

---

## 1. إعداد متغيرات البيئة (Environment Variables)

انسخ ملف `.env.example` واضبط القيم المطلوبة في بيئة الاستضافة أو لوحة **Secrets**:

| المتغير | الوظيفة |
| :--- | :--- |
| `GEMINI_API_KEY` | مفتاح Gemini API لتشغيل المساعد الذكي للمبيعات |
| `APP_URL` | الرابط العام للتطبيق (مطلوب لروابط Open Graph وWebhook) |
| `WHATSAPP_ACCESS_TOKEN` | رمز الوصول الدائم من تطبيق Meta WhatsApp Business |
| `WHATSAPP_PHONE_NUMBER_ID` | معرف رقم الهاتف في Meta Developer Portal |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | معرف حساب WhatsApp Business |
| `WHATSAPP_VERIFY_TOKEN` | رمز سري تختاره للتحقق من Webhook |
| `WHATSAPP_APP_SECRET` | مفتاح التطبيق السري في Meta للتحقق من توقيع `X-Hub-Signature-256` |
| `ADMIN_EMAILS` | قائمة البريد الإلكتروني (مفصولة بفاصلة) المسموح لها بدخول لوحة الإدارة |

---

## 2. إعداد قاعدة البيانات PostgreSQL (Cloud SQL أو Supabase)

- يعتمد التطبيق داخل Google AI Studio على مثيل **Cloud SQL PostgreSQL** متصل عبر متغيرات `SQL_HOST` و`SQL_USER` و`SQL_PASSWORD` و`SQL_DB_NAME` و`SQL_ADMIN_USER` و`SQL_ADMIN_PASSWORD`.
- لتحديث مخطط الجداول عبر Drizzle:
  ```bash
  npx drizzle-kit push --config=src/db/drizzle.config.ts
  ```
- في حالة الاستضافة الخارجية على **Supabase PostgreSQL** و**Supabase Storage**، يمكنك ربط إعدادات الاتصال وإعداد دلو تخزين (Bucket) للصور.

---

## 3. ربط Meta WhatsApp Business Cloud API و Webhook

1. أنشئ تطبيقاً من نوع Business في [Meta for Developers](https://developers.facebook.com/).
2. أضف منتج **WhatsApp** واحصل على:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_APP_SECRET`
3. في قسم **WhatsApp > Configuration > Webhook** ضع:
   - **Callback URL**: `https://YOUR_APP_URL/api/webhooks/whatsapp`
   - **Verify Token**: نفس قيمة `WHATSAPP_VERIFY_TOKEN`
4. فعّل الاشتراك في حقول: `messages` و `message_status`.
5. يمكنك مراقبة حالة الربط واختبار ردود الذكاء الاصطناعي والتحكم البشري مباشرة من: **لوحة الإدارة > WhatsApp & AI**.

---

## 4. التسويق عبر Facebook & Instagram (Meta Pixel & Catalog Feed)

- يدعم كل منتج رابطاً مستقلاً (`/product/:slug`) مع حقن تلقائي لوسوم **Open Graph** و **Twitter Cards** و **JSON-LD** لعرض الصورة والسعر بالدرهم عند المشاركة.
- رابط تغذية الكتالوج المتوافق مع **Meta Commerce Manager**:
  `GET /api/feeds/meta-catalog.csv`
- يمكن إدخال معرف **Meta Pixel ID** وتعديل اسم المتجر والألوان والبانر الرئيسي مباشرة من **لوحة الإدارة > إعدادات المتجر**.

---

## 5. التشغيل والبناء والنشر (Google Cloud Run / GitHub)

```bash
# تثبيت الحزم
npm install

# تشغيل بيئة التطوير (الخادم الخلفي + الواجهة على المنفذ 3000)
npm run dev

# بناء الواجهة للإنتاج
npm run build

# تشغيل الخادم في الإنتاج
NODE_ENV=production npm start
```

يمكن نشر المشروع مباشرة على **Google Cloud Run** باستخدام عنوان الاستضافة المؤقت الموفر، ثم ربط دومين خاص (`chamalishop.ma` مثلاً) من إعدادات Custom Domains.
