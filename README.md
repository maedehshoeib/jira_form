# سامانه جامع خدمات

سامانه ثبت درخواست و گزارش‌گیری سازمانی — جایگزین بخشی از Jira Service Management برای ثبت فرم‌ها و گزارشات داخلی شرکت.

## قابلیت‌ها

- **ورود با حساب سازمانی (LDAP/Active Directory):** کاربران با نام کاربری و رمز عبور سیستم خود وارد می‌شوند. کاربران جدید در اولین ورود به‌صورت خودکار در دیتابیس ثبت می‌شوند.
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

### ورود در حالت توسعه (خارج از شبکه داخلی)

وقتی به LDAP شرکت دسترسی ندارید، از حساب dev استفاده کنید:

| فیلد | مقدار |
|------|-------|
| نام کاربری | `admin` |
| رمز عبور | `admin` |

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
| `LDAP_SERVER` | آدرس سرور LDAP/AD (مثلاً `ldap://dc.vosouq.local`) |
| `LDAP_BASE_DN` | Base DN دامنه (مثلاً `DC=vosouq,DC=local`) |
| `LDAP_USER_DN_TEMPLATE` | قالب DN کاربر (مثلاً `{username}@vosouq.local`) |
| `DEV_AUTH_ENABLED` | فعال‌سازی ورود dev وقتی LDAP در دسترس نیست |
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

### پورتال

| Method | Endpoint | توضیح |
|--------|----------|-------|
| GET | `/api/v1/departments` | لیست دپارتمان‌ها |
| GET | `/api/v1/forms/{form_id}` | قالب فرم |
| POST | `/api/v1/submissions` | ثبت درخواست (multipart/form-data) |

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

## شبکه داخلی شرکت

برای عملکرد کامل در شبکه داخلی:

1. `LDAP_ENABLED=true` و تنظیم صحیح پارامترهای LDAP
2. `DEV_AUTH_ENABLED=false` در production
3. `JIRA_BASE_URL` را به آدرس داخلی Jira تنظیم کنید
4. در صورت نیاز `JIRA_USERNAME` و `JIRA_PASSWORD` را برای حساب سرویس تنظیم کنید

## داده‌ها

- دیتابیس SQLite در `backend/data/portal.db` (در Docker روی volume `portal_data`)
- فایل‌های پیوست در `backend/data/uploads/`

## فونت

تمام صفحات از فونت **Vazirmatn** استفاده می‌کنند.
