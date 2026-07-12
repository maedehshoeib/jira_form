# -*- coding: utf-8 -*-
"""Seed database with 1-2 submissions per department section (29 sections total)."""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal
from app.models.submission import Submission
from app.models.user import User
from app.services.portal_service import DEPARTMENTS
from app.services.report_submission_service import (
    create_report_from_submission,
    is_performance_report_submission,
)

DEFAULT_BASE = "http://127.0.0.1:8001/api/v1"
DEFAULT_API_KEY = "jira-admin-reports-key"

PERFORMANCE_GENERAL_SPECS = json.dumps(
    [
        {"title": "واحد سازمانی", "value": "واحد نمونه"},
        {"title": "دوره گزارش", "value": "فصل اول 1405"},
        {"title": "بازه زمانی", "value": "فروردین - خرداد 1405"},
        {"title": "مدیر واحد", "value": "مدیر نمونه"},
    ],
    ensure_ascii=False,
)

PERFORMANCE_GOALS = json.dumps(
    [
        {
            "goal": "هدف نمونه",
            "priority": "بالا",
            "responsible": "واحد مربوطه",
            "timeline": "خرداد 1405",
            "status": "در حال انجام",
            "progress": "60%",
            "notes": "پیشرفت مناسب",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_ACTIONS = json.dumps(
    [
        {
            "action_title": "اقدام نمونه",
            "action_description": "شرح اقدام انجام شده",
            "result": "موفق",
            "responsible": "تیم اجرایی",
            "completion_date": "1405/02/15",
            "status": "انجام شد",
            "related_document": "گزارش",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_METRICS = json.dumps(
    [
        {
            "indicator_name": "شاخص نمونه",
            "definition": "تعریف شاخص",
            "target": "90%",
            "actual": "88%",
            "realization_pct": "98%",
            "status": "قابل قبول",
            "short_analysis": "نزدیک به هدف",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_ANALYSIS = json.dumps(
    [
        {
            "subject": "عملکرد کلی",
            "status": "مطلوب",
            "cause": "بهبود فرآیند",
            "company_effect": "افزایش بهره‌وری",
            "corrective_action": "ادامه روند",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_RISKS = json.dumps(
    [
        {
            "problem_risk": "ریسک نمونه",
            "effect": "تأخیر احتمالی",
            "severity": "متوسط",
            "probability": "کم",
            "unit_suggestion": "پایش مستمر",
            "follow_up_responsible": "واحد مربوطه",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_CORRECTIVE = json.dumps(
    [
        {
            "subject": "موضوع اصلاحی",
            "proposed_action": "اقدام پیشنهادی",
            "proposed_responsible": "واحد فناوری",
            "proposed_time": "تیر 1405",
            "required_resources": "منابع انسانی",
            "status": "پیشنهادی",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_NEXT_PLANS = json.dumps(
    [
        {
            "program": "برنامه دوره بعد",
            "priority": "بالا",
            "expected_output": "خروجی مورد انتظار",
            "responsible": "واحد مربوطه",
            "timeline": "مرداد 1405",
            "dependencies": "هماهنگی بین واحدی",
            "possible_risk": "تأخیر تأمین",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_DECISIONS = json.dumps(
    [
        {
            "decision_subject": "تصمیم مدیریتی",
            "description": "شرح تصمیم",
            "unit_suggestion": "تأیید",
            "urgency": "متوسط",
            "no_decision_effect": "کاهش سرعت",
            "decision_deadline": "1405/04/31",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_ATTACHMENTS = json.dumps(
    [
        {
            "document_title": "سند پیوست",
            "document_type": "PDF",
            "date": "1405/03/31",
            "owner": "واحد مربوطه",
            "storage_location": "SharePoint",
            "notes": "نسخه نهایی",
        }
    ],
    ensure_ascii=False,
)

PERFORMANCE_SCORING = json.dumps(
    [
        {"evaluation_axis": "برنامه ها تحقق", "score": "85", "explanation": "خوب"},
        {"evaluation_axis": "خروجی ها کیفیت", "score": "88", "explanation": "مطلوب"},
        {"evaluation_axis": "زمان بندی رعایت", "score": "80", "explanation": "قابل قبول"},
        {"evaluation_axis": "ریسک ها مدیریت", "score": "78", "explanation": "متوسط"},
        {"evaluation_axis": "بین واحدی همکاری", "score": "86", "explanation": "خوب"},
        {"evaluation_axis": "نهایی جمع بندی", "score": "83", "explanation": "مطلوب"},
    ],
    ensure_ascii=False,
)


def iter_sections():
    for dept in DEPARTMENTS:
        for section in dept.sections:
            yield {
                "department_id": dept.id,
                "department_title": dept.title,
                "section_id": section.id,
                "section_title": section.title,
                "form_id": section.form_id,
            }


def build_fields(section: dict, index: int) -> dict:
    """Build complete form field payload for a section (index: 1 or 2)."""
    dept_title = section["department_title"]
    section_title = section["section_title"]
    form_id = section["form_id"]
    suffix = f" - نمونه {index}"

    if form_id == "common-form":
        return {
            "subject": f"{section_title}{suffix}",
            "description": (
                f"درخواست مربوط به {section_title} در {dept_title}. "
                f"این رکورد seed شماره {index} است."
            ),
        }

    if form_id == "software-support-form":
        return {
            "subject": f"درخواست پشتیبانی نرم‌افزار{suffix}",
            "product": "Jira",
            "priority": "high" if index == 1 else "medium",
            "delivery_time": "1405/04/20" if index == 1 else "1405/05/10",
            "description": f"شرح مشکل نرم‌افزاری برای {section_title}{suffix}",
        }

    if form_id == "digital-marketing-form":
        return {
            "row": str(index),
            "date": "1405/04/12" if index == 1 else "1405/05/01",
            "department": "دیجیتال مارکتینگ",
            "company_name": f"شرکت نمونه {index}",
            "activity_type": "content" if index == 1 else "banner_design",
            "project_relation": "social" if index == 1 else "site",
            "social_network": "instagram" if index == 1 else "telegram",
        }

    if form_id == "business-form":
        return {
            "project_name": f"پروژه کسب‌وکار {index}",
            "customer_type": "سازمانی",
            "activity_scope": "فناوری",
            "communication_channel": "ایمیل",
            "meeting_number": f"MTG-{100 + index}",
            "meeting_agreements": "توافق بر سر زمان‌بندی",
            "tracking_number": f"TRK-{200 + index}",
            "followup_date": "1405/05/01",
            "contract_status": "در حال مذاکره",
            "contract_date": "1405/04/15",
            "description": f"شرح پروژه {section_title}{suffix}",
            "project_manager": "مدیر پروژه نمونه",
            "executor": "مجری نمونه",
            "approver": "تأییدکننده نمونه",
            "contact_name": "رابط نمونه",
            "position": "کارشناس",
            "phone": "02112345678",
            "email": f"business{index}@vosouq.local",
        }

    if form_id == "hr-form":
        return {
            "subject": f"{section_title}{suffix}",
            "description": (
                f"درخواست منابع انسانی: {section_title} در {dept_title}. "
                f"رکورد seed شماره {index}."
            ),
            "personnel_code": f"10{index:03d}",
        }

    if form_id == "performance-report-form":
        return {
            "general_specs": PERFORMANCE_GENERAL_SPECS,
            "achievements": f"دستاورد نمونه {index}: اجرای برنامه‌های کلیدی",
            "problems_risks_summary": f"ریسک نمونه {index}: محدودیت منابع",
            "management_decisions_summary": f"تصمیم نمونه {index}: تخصیص بودجه",
            "next_period_key_programs": f"برنامه نمونه {index}: توسعه سامانه",
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
        }

    raise ValueError(f"Unknown form_id: {form_id}")


def ensure_seed_user(db) -> User:
    user = db.query(User).filter(User.username == "admin").first()
    if user:
        return user
    user = db.query(User).first()
    if user:
        return user
    user = User(username="admin", display_name="مدیر سیستم", email="admin@local")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_submission_record(db, user: User, section: dict, fields: dict) -> int:
    form_id = section["form_id"]
    department_id = section["department_id"]
    section_id = section["section_id"]
    subject = fields.get("subject", fields.get("project_name", section["section_title"]))
    form_data = dict(fields)

    submission = Submission(
        form_id=form_id,
        department_id=department_id,
        section_id=section_id,
        user_id=user.id,
        subject=subject,
        data=json.dumps(form_data, ensure_ascii=False),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    if is_performance_report_submission(form_id, department_id, section_id):
        report = create_report_from_submission(db, form_data, user, department_id)
        form_data["_report_id"] = report.id
        submission.data = json.dumps(form_data, ensure_ascii=False)
        db.commit()

    return submission.id


def seed_via_db(per_section: int) -> list[dict]:
    db = SessionLocal()
    try:
        user = ensure_seed_user(db)
        created = []
        for section in iter_sections():
            for i in range(1, per_section + 1):
                fields = build_fields(section, i)
                sid = create_submission_record(db, user, section, fields)
                created.append(
                    {
                        "id": sid,
                        "form_id": section["form_id"],
                        "department_id": section["department_id"],
                        "section_id": section["section_id"],
                        "section_title": section["section_title"],
                        "index": i,
                    }
                )
                print(
                    f"OK: {section['department_id']}/{section['section_id']} "
                    f"#{i} -> id={sid}"
                )
        return created
    finally:
        db.close()


def api_request(method, base, path, json_body=None, form=None, headers=None):
    h = dict(headers or {})
    if form is not None:
        body = urllib.parse.urlencode(form).encode()
        h.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif json_body is not None:
        body = json.dumps(json_body).encode()
        h.setdefault("Content-Type", "application/json")
    else:
        body = None
    req = urllib.request.Request(f"{base}{path}", data=body, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def seed_via_api(base: str, per_section: int) -> list[dict]:
    login = api_request(
        "POST",
        base,
        "/auth/login",
        json_body={"username": "admin", "password": "admin"},
    )
    token = login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = []

    for section in iter_sections():
        for i in range(1, per_section + 1):
            fields = build_fields(section, i)
            payload = {
                "form_id": section["form_id"],
                "department_id": section["department_id"],
                "section_id": section["section_id"],
                **fields,
            }
            resp = api_request("POST", base, "/submissions", form=payload, headers=headers)
            sid = resp["id"]
            created.append(
                {
                    "id": sid,
                    "form_id": section["form_id"],
                    "department_id": section["department_id"],
                    "section_id": section["section_id"],
                    "section_title": section["section_title"],
                    "index": i,
                    "report_id": resp.get("report_id"),
                }
            )
            print(
                f"OK: {section['department_id']}/{section['section_id']} "
                f"#{i} -> id={sid}"
            )
    return created


def verify_via_api(base: str, created: list[dict], api_key: str) -> bool:
    headers = {"X-API-Key": api_key}
    all_items = api_request("GET", base, "/submissions?limit=500", headers=headers)
    all_ids = {item["id"] for item in all_items}
    missing = [c for c in created if c["id"] not in all_ids]
    if missing:
        print(f"FAIL: {len(missing)} submissions not found in list API")
        return False

    section_counts: dict[tuple[str, str], int] = {}
    for item in all_items:
        key = (item["department_id"], item["section_id"])
        section_counts[key] = section_counts.get(key, 0) + 1

    sections = list(iter_sections())
    print(f"\nTotal in DB via API: {len(all_items)}")
    print(f"Sections covered: {len(section_counts)} / {len(sections)}")

    ok = True
    for section in sections:
        key = (section["department_id"], section["section_id"])
        count = section_counts.get(key, 0)
        status = "OK" if count > 0 else "MISSING"
        if count == 0:
            ok = False
        print(f"  {status}: {section['department_title']} / {section['section_title']} ({count})")

    return ok and not missing


def main():
    parser = argparse.ArgumentParser(description="Seed all 29 form sections")
    parser.add_argument(
        "--per-section",
        type=int,
        default=2,
        choices=[1, 2],
        help="Submissions per section (1 or 2, default: 2)",
    )
    parser.add_argument(
        "--via-api",
        action="store_true",
        help="Submit via HTTP API instead of direct DB",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--api-key", default=DEFAULT_API_KEY)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify submissions via GET /submissions after seeding",
    )
    args = parser.parse_args()

    sections = list(iter_sections())
    expected = len(sections) * args.per_section
    print(f"Seeding {len(sections)} sections × {args.per_section} = {expected} submissions")
    print("=" * 60)

    try:
        if args.via_api:
            created = seed_via_api(args.base_url, args.per_section)
        else:
            created = seed_via_db(args.per_section)
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}")
        return 1
    except urllib.error.URLError as e:
        print(f"CONNECTION ERROR: {e.reason}")
        print("Start uvicorn or run without --via-api for direct DB seeding.")
        return 1

    print("=" * 60)
    print(f"Created {len(created)} submissions")

    if args.verify or args.via_api:
        print("\nVerifying via API...")
        ok = verify_via_api(args.base_url, created, args.api_key)
        print("\n" + ("RESULT: SUCCESS" if ok else "RESULT: VERIFICATION FAILED"))
        return 0 if ok else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
