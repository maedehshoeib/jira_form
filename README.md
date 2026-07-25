# سامانه جامع خدمات

سامانه ثبت درخواست و گزارش‌گیری سازمانی — جایگزین بخشی از Jira Service Management برای ثبت فرم‌ها و گزارشات داخلی شرکت.

## قابلیت‌ها

- **ورود با حساب محلی امن:** حساب کارکنان از فایل `users.xlsx` ساخته می‌شود، رمزها با Argon2 هش می‌شوند و تغییر رمز پیش‌فرض در اولین ورود اجباری است.
- **پروفایل کاربری:** هر کاربر می‌تواند نام نمایشی، ایمیل و رمز عبور خود را مدیریت کند و اطلاعات سازمانی خود را ببیند.
- **ثبت فرم درخواست:** فرم‌های دپارتمان‌های مختلف (IT، منابع انسانی، مالی، بانک و ...) با ذخیره کامل در SQLite.
- **گزارشات:** نمایش گزارش عملکرد شورای معاونین و مدیران با داده‌های ذخیره‌شده در دیتابیس.
- **API گزارشات برای Jira Admin:** ارائه داده گزارشات به ادمین Jira از طریق API Key.
- **اتصال به Jira ScriptRunner:** پروکسی APIهای Jira (me، users، requestTypes) برای استفاده در شبکه داخلی شرکت.
- **لوگوی بانک ملت:** نمایش لوگوی بانک در بخش بانک.

## پیش‌نیازها

- Docker و Docker Compose (برای اجرای containerized)
- یا Python 3.12+ و Node.js 20+ (برای اجرای محلی)

## اجرا با Docker (پیشنهادی)

```bash
# ساخت و اجرا
docker compose up --build -d

# مشاهده لاگ‌ها
docker compose logs -f

# توقف
docker compose down
```

سامانه روی `http://localhost:8080` در دسترس است.

### ورود کاربران

نام کاربری هر شخص بخش قبل از `@` ایمیل او است. برای مثال، نام کاربری
`f.amiri@evtsp.com` برابر `f.amiri` است.

| فیلد | مقدار |
|------|-------|
| نام کاربری | بخش قبل از `@` ایمیل |
| رمز عبور اولیه | `Secure@1234567` |

کاربر پس از اولین ورود مستقیماً به صفحه تغییر رمز هدایت می‌شود و تا زمان
تغییر رمز اولیه به APIهای محافظت‌شده دسترسی ندارد.

## اجرای محلی (بدون Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # حتماً از venv استفاده کنید
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

برای production، frontend را build کنید:

```bash
cd frontend && npm run build
```

سپس backend به‌صورت خودکار `frontend/dist` را serve می‌کند.

## تنظیمات محیطی

فایل `backend/.env.example` را کپی کرده و مقادیر را تنظیم کنید:

| متغیر | توضیح |
|-------|-------|
| `USERS_SEED_ENABLED` | اجرای seed کارکنان هنگام راه‌اندازی (پیش‌فرض: `true`) |
| `USERS_SEED_FILE` | مسیر فایل کارکنان (پیش‌فرض: `../users.xlsx`) |
| `DEFAULT_USER_PASSWORD` | رمز اولیه کاربران (پیش‌فرض: `Secure@1234567`) |
| `JIRA_BASE_URL` | آدرس Jira (مثلاً `https://jira.vosouq.me`) |
| `JIRA_USERNAME` / `JIRA_PASSWORD` | حساب سرویس Jira (اختیاری) |
| `REPORTS_API_KEY` | کلید API برای دسترسی Jira Admin به گزارشات |
| `SECRET_KEY` | کلید JWT — در production حتماً تغییر دهید |
| `DATABASE_URL` | مسیر SQLite (پیش‌فرض: `sqlite:///./data/portal.db`) |

## APIها

### احراز هویت

| Method | Endpoint | توضیح |
|--------|----------|-------|
| POST | `/api/v1/auth/login` | ورود با `{username, password}` |
| GET | `/api/v1/auth/me` | اطلاعات کاربر جاری (نیاز به Bearer token) |
| PUT | `/api/v1/auth/profile` | ویرایش نام نمایشی و ایمیل |
| POST | `/api/v1/auth/change-password` | تغییر رمز با رمز فعلی، رمز جدید و تکرار آن |

### پورتال

| Method | Endpoint | توضیح |
|--------|----------|-------|
| GET | `/api/v1/departments` | لیست دپارتمان‌ها |
| GET | `/api/v1/forms/{form_id}` | قالب فرم |
| POST | `/api/v1/submissions` | ثبت درخواست (multipart/form-data) |
| GET | `/api/v1/submissions` | فهرست درخواست‌های کاربر جاری (با API Key: همه درخواست‌ها) |
| GET | `/api/v1/submissions/{id}` | جزئیات درخواست کاربر جاری (با API Key: هر درخواست) |

### گزارشات

| Method | Endpoint | توضیح |
|--------|----------|-------|
| GET | `/api/v1/reports` | لیست گزارشات (نیاز به header `X-API-Key`) |
| GET | `/api/v1/reports/{id}` | جزئیات گزارش (نیاز به `X-API-Key`) |
| GET | `/api/v1/reports/public` | لیست گزارشات (کاربر لاگین‌شده) |
| GET | `/api/v1/reports/performance/latest` | آخرین گزارش عملکرد |

### Jira (پروکسی ScriptRunner)

| Method | Endpoint | Jira API معادل |
|--------|----------|----------------|
| GET | `/api/v1/jira/me` | `/rest/scriptrunner/latest/custom/me` |
| GET | `/api/v1/jira/users` | `/rest/scriptrunner/latest/custom/users` |
| GET | `/api/v1/jira/request-types` | `/rest/scriptrunner/latest/custom/requestTypes` |

### مثال: دریافت گزارشات برای Jira Admin

```bash
curl -H "X-API-Key: jira-admin-reports-key" \
  http://localhost:8080/api/v1/reports

curl -H "X-API-Key: jira-admin-reports-key" \
  http://localhost:8080/api/v1/reports/1
```

## ساختار پروژه

```
jira_form/
├── backend/           # FastAPI + SQLite
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── services/
│   │   └── main.py
│   └── requirements.txt
├── frontend/          # React + Vite + Tailwind
│   └── src/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## migration و seed در production

در هر بار شروع backend، ابتدا جدول‌ها ساخته می‌شوند، سپس migration ستون‌های
احراز هویت روی دیتابیس‌های قدیمی اجرا و در پایان seed کارکنان اعمال می‌شود.
این فرآیند idempotent است: کاربر تکراری ایجاد نمی‌شود و رمز تغییرکرده هیچ
کاربری reset نمی‌شود. فایل دیتابیس commit نمی‌شود و volume به نام
`portal_data` اطلاعات production را نگه می‌دارد.

برای اجرای دستی seed:

```bash
cd backend
python scripts/seed_users.py
```

در production حتماً `SECRET_KEY` را به یک مقدار تصادفی و طولانی تغییر دهید.
برای پروکسی‌های Jira نیز `JIRA_BASE_URL` و در صورت نیاز
`JIRA_USERNAME`/`JIRA_PASSWORD` را تنظیم کنید؛ Jira دیگر در فرآیند ورود
کاربر استفاده نمی‌شود.

## داده‌ها

- دیتابیس SQLite در `backend/data/portal.db` (در Docker روی volume `portal_data`)
- فایل‌های پیوست در `backend/data/uploads/`

## فونت

تمام صفحات از فونت **Vazirmatn** استفاده می‌کنند.
