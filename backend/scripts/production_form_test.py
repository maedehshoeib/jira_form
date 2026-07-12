# -*- coding: utf-8 -*-
"""End-to-end test: submit all forms, verify GET /submissions API."""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8001/api/v1"
API_KEY = "jira-admin-reports-key"


def api(method, path, json_body=None, form=None, headers=None):
    h = dict(headers or {})
    if form is not None:
        body = urllib.parse.urlencode(form).encode()
        h.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif json_body is not None:
        body = json.dumps(json_body).encode()
        h.setdefault("Content-Type", "application/json")
    else:
        body = None
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


PERFORMANCE_GENERAL_SPECS = json.dumps(
    [
        {"title": "واحد سازمانی", "value": "فناوری اطلاعات"},
        {"title": "دوره گزارش", "value": "فصل اول 1405"},
        {"title": "بازه زمانی", "value": "فروردین - خرداد 1405"},
        {"title": "مدیر واحد", "value": "علی محمدی"},
    ],
    ensure_ascii=False,
)

PERFORMANCE_GOALS = json.dumps(
    [
        {
            "goal": "پیاده سازی سامانه",
            "priority": "بالا",
            "responsible": "واحد فناوری",
            "timeline": "خرداد 1405",
            "status": "در حال انجام",
            "progress": "70%",
            "notes": "طبق برنامه",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_ACTIONS = json.dumps(
    [
        {
            "action_title": "راه اندازی سرویس",
            "action_description": "استقرار سرویس جدید",
            "result": "موفق",
            "responsible": "تیم فنی",
            "completion_date": "1405/02/15",
            "status": "انجام شد",
            "related_document": "گزارش استقرار",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_METRICS = json.dumps(
    [
        {
            "indicator_name": "درصد رضایت",
            "definition": "میانگین رضایت کاربران",
            "target": "90%",
            "actual": "91%",
            "realization_pct": "101%",
            "status": "مطلوب",
            "short_analysis": "بالاتر از هدف",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_ANALYSIS = json.dumps(
    [
        {
            "subject": "عملکرد کلی",
            "status": "مطلوب",
            "cause": "بهبود فرآیندها",
            "company_effect": "افزایش بهره وری",
            "corrective_action": "ادامه روند",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_RISKS = json.dumps(
    [
        {
            "problem_risk": "افزایش بار سامانه",
            "effect": "کاهش سرعت",
            "severity": "متوسط",
            "probability": "زیاد",
            "unit_suggestion": "افزایش ظرفیت",
            "follow_up_responsible": "واحد زیرساخت",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_CORRECTIVE = json.dumps(
    [
        {
            "subject": "زیرساخت",
            "proposed_action": "ارتقاء سرور",
            "proposed_responsible": "واحد فناوری",
            "proposed_time": "تیر 1405",
            "required_resources": "بودجه",
            "status": "پیشنهادی",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_NEXT_PLANS = json.dumps(
    [
        {
            "program": "توسعه داشبورد",
            "priority": "بالا",
            "expected_output": "داشبورد عملیاتی",
            "responsible": "واحد فناوری",
            "timeline": "مرداد 1405",
            "dependencies": "داده Jira",
            "possible_risk": "تاخیر API",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_DECISIONS = json.dumps(
    [
        {
            "decision_subject": "تخصیص بودجه",
            "description": "بودجه زیرساخت",
            "unit_suggestion": "تایید",
            "urgency": "بالا",
            "no_decision_effect": "کاهش کیفیت",
            "decision_deadline": "1405/04/31",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_ATTACHMENTS = json.dumps(
    [
        {
            "document_title": "گزارش فصلی",
            "document_type": "PDF",
            "date": "1405/03/31",
            "owner": "واحد فناوری",
            "storage_location": "SharePoint",
            "notes": "نسخه نهایی",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_SCORING = json.dumps(
    [
        {"evaluation_axis": "برنامه ها تحقق", "score": "85", "explanation": "خوب"},
        {"evaluation_axis": "خروجی ها کیفیت", "score": "90", "explanation": "مطلوب"},
        {"evaluation_axis": "زمان بندی رعایت", "score": "80", "explanation": "قابل قبول"},
        {"evaluation_axis": "ریسک ها مدیریت", "score": "75", "explanation": "متوسط"},
        {"evaluation_axis": "بین واحدی همکاری", "score": "88", "explanation": "خوب"},
        {"evaluation_axis": "نهایی جمع بندی", "score": "84", "explanation": "مطلوب"},
    ],
    ensure_ascii=False,
)

FORMS = [
    {
        "name": "common-form",
        "form_id": "common-form",
        "department_id": "finance",
        "section_id": "purchase-request",
        "fields": {
            "subject": "درخواست خرید تست پروداکشن",
            "description": "توضیحات کامل درخواست خرید برای تست API",
        },
        "expected_data_keys": ["subject", "description"],
    },
    {
        "name": "software-support-form",
        "form_id": "software-support-form",
        "department_id": "it",
        "section_id": "software-support",
        "fields": {
            "subject": "مشکل VPN تست",
            "product": "Jira",
            "priority": "high",
            "delivery_time": "1405/04/20",
            "description": "از صبح VPN وصل نمی شود - تست پروداکشن",
        },
        "expected_data_keys": [
            "subject", "product", "priority", "delivery_time", "description",
        ],
    },
    {
        "name": "digital-marketing-form",
        "form_id": "digital-marketing-form",
        "department_id": "business",
        "section_id": "digital-marketing",
        "fields": {
            "row": "1",
            "date": "1405/04/12",
            "department": "دیجیتال مارکتینگ",
            "company_name": "شرکت نمونه تست",
            "activity_type": "content",
            "project_relation": "social",
            "social_network": "instagram",
        },
        "expected_data_keys": [
            "row", "date", "department", "company_name",
            "activity_type", "project_relation", "social_network",
        ],
    },
    {
        "name": "business-form",
        "form_id": "business-form",
        "department_id": "business",
        "section_id": "business-projects",
        "fields": {
            "project_name": "پروژه تست کسب و کار",
            "customer_type": "سازمانی",
            "activity_scope": "فناوری",
            "communication_channel": "ایمیل",
            "meeting_number": "MTG-100",
            "meeting_agreements": "توافق بر سر زمان بندی",
            "tracking_number": "TRK-200",
            "followup_date": "1405/05/01",
            "contract_status": "در حال مذاکره",
            "contract_date": "1405/04/15",
            "description": "شرح کامل پروژه تست",
            "project_manager": "مدیر پروژه تست",
            "executor": "مجری تست",
            "approver": "تاییدکننده تست",
            "contact_name": "رابط تست",
            "position": "کارشناس",
            "phone": "02112345678",
            "email": "test@vosouq.local",
        },
        "expected_data_keys": [
            "project_name", "customer_type", "activity_scope",
            "communication_channel", "meeting_number", "meeting_agreements",
            "tracking_number", "followup_date", "contract_status", "contract_date",
            "description", "project_manager", "executor", "approver",
            "contact_name", "position", "phone", "email",
        ],
    },
    {
        "name": "hr-form",
        "form_id": "hr-form",
        "department_id": "hr",
        "section_id": "new-hire",
        "fields": {
            "subject": "درخواست استخدام تست",
            "description": "توضیحات درخواست استخدام نیروی جدید",
            "personnel_code": "12345",
        },
        "expected_data_keys": ["subject", "description", "personnel_code"],
    },
    {
        "name": "performance-report-form",
        "form_id": "performance-report-form",
        "department_id": "reports",
        "section_id": "management-report",
        "fields": {
            "general_specs": PERFORMANCE_GENERAL_SPECS,
            "achievements": "دستاورد تست: پیاده سازی سامانه جدید",
            "problems_risks_summary": "ریسک تست: کمبود منابع",
            "management_decisions_summary": "تصمیم تست: تخصیص بودجه",
            "next_period_key_programs": "برنامه تست: توسعه داشبورد",
            "goals": PERFORMANCE_GOALS,
            "actions": PERFORMANCE_ACTIONS,
            "metrics": PERFORMANCE_METRICS,
            "analysis": PERFORMANCE_ANALYSIS,
            "risks": PERFORMANCE_RISKS,
            "corrective_actions": PERFORMANCE_CORRECTIVE,
            "next_plans": PERFORMANCE_NEXT_PLANS,
            "management_decisions": PERFORMANCE_DECISIONS,
            "attachments": PERFORMANCE_ATTACHMENTS,
            "manager_scoring": PERFORMANCE_SCORING,
        },
        "expected_data_keys": [
            "general_specs", "achievements", "problems_risks_summary",
            "management_decisions_summary", "next_period_key_programs",
            "goals", "actions", "metrics", "analysis", "risks",
            "corrective_actions", "next_plans", "management_decisions",
            "attachments", "manager_scoring",
        ],
        "expect_report_id": True,
    },
]


def verify_submission(submission_id, form, sent_fields):
    body = api("GET", f"/submissions/{submission_id}", headers={"X-API-Key": API_KEY})
    errors = []

    if body["form_id"] != form["form_id"]:
        errors.append(f"form_id mismatch")
    if body["department_id"] != form["department_id"]:
        errors.append(f"department_id mismatch")
    if body["section_id"] != form["section_id"]:
        errors.append(f"section_id mismatch")

    data = body.get("data", {})
    for key in form["expected_data_keys"]:
        if key not in data:
            errors.append(f"missing key: {key}")
            continue
        sent = sent_fields[key]
        got = data[key]
        if isinstance(sent, str) and sent.strip()[:1] in ("[", "{"):
            if got != json.loads(sent):
                errors.append(f"json mismatch: {key}")
        elif got != sent:
            errors.append(f"value mismatch: {key}")

    if form.get("expect_report_id") and not body.get("report_id"):
        errors.append("report_id missing")

    return errors, body


def main():
    print("=== 1. Login ===")
    login = api("POST", "/auth/login", json_body={"username": "admin", "password": "admin"})
    token = login["access_token"]
    print("OK")

    print("\n=== 2. Submit all 6 forms ===")
    submitted = []
    for form in FORMS:
        payload = {
            "form_id": form["form_id"],
            "department_id": form["department_id"],
            "section_id": form["section_id"],
            **form["fields"],
        }
        resp = api(
            "POST", "/submissions", form=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        sid = resp["id"]
        submitted.append((form, sid, resp.get("report_id")))
        print(f"OK: {form['name']} -> id={sid}, report_id={resp.get('report_id')}")

    print("\n=== 3. Verify each submission ===")
    all_ok = True
    for form, sid, _ in submitted:
        errors, _ = verify_submission(sid, form, form["fields"])
        if errors:
            all_ok = False
            print(f"FAIL: {form['name']} (id={sid})")
            for e in errors:
                print(f"  - {e}")
        else:
            n = len(form["expected_data_keys"])
            print(f"OK: {form['name']} (id={sid}) - {n} fields verified")

    print("\n=== 4. Filter test ===")
    for form, sid, _ in submitted:
        items = api(
            "GET",
            f"/submissions?form_id={urllib.parse.quote(form['form_id'])}&limit=10",
            headers={"X-API-Key": API_KEY},
        )
        found = any(i["id"] == sid for i in items)
        print(f"{'OK' if found else 'FAIL'}: filter form_id={form['form_id']}")
        if not found:
            all_ok = False

    print("\n=== 5. List all ===")
    all_items = api("GET", "/submissions?limit=500", headers={"X-API-Key": API_KEY})
    print(f"Total submissions in DB: {len(all_items)}")

    print("\n" + "=" * 50)
    if all_ok:
        print("RESULT: ALL TESTS PASSED")
        return 0
    print("RESULT: SOME TESTS FAILED")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"CONNECTION ERROR: {e.reason}")
        print("Is uvicorn running on port 8001?")
        sys.exit(1)
