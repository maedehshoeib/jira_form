import json
from datetime import datetime

from app.core.config import settings
from app.core.timezone import format_tehran_datetime
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportResponse
from app.services.performance_report_schema import PERFORMANCE_TABLE_COLUMNS


def _format_dt(dt: datetime) -> str:
    return format_tehran_datetime(dt)


def _verify_api_key(x_api_key: str | None) -> bool:
    return bool(x_api_key and x_api_key == settings.REPORTS_API_KEY)


def _report_to_response(report: Report, creator: User) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        department=report.department,
        status=report.status,
        data=json.loads(report.data or "{}"),
        created_by=creator.display_name or creator.username,
        created_at=_format_dt(report.created_at),
        updated_at=_format_dt(report.updated_at),
    )


def _table_section(key: str, rows: list | None = None) -> dict:
    return {
        "columns": PERFORMANCE_TABLE_COLUMNS[key],
        "rows": rows or [],
    }


DEFAULT_PERFORMANCE_DATA = {
    "general_specs": _table_section("general_specs", [
        {"title": "واحد سازمانی", "value": "فناوری اطلاعات"},
        {"title": "دوره گزارش", "value": "فصل اول ۱۴۰۵"},
        {"title": "بازه زمانی", "value": "فروردین - خرداد ۱۴۰۵"},
        {"title": "مدیر واحد", "value": ""},
    ]),
    "achievements": "پیاده‌سازی نسخه جدید سامانه خدمات، افزایش سرعت پاسخگویی، بهبود فرآیندهای داخلی.",
    "problems_risks_summary": "کمبود منابع انسانی، محدودیت بودجه و نیاز به ارتقاء زیرساخت.",
    "management_decisions_summary": "تخصیص بودجه برای ارتقاء زیرساخت و جذب نیروی متخصص.",
    "next_period_key_programs": "تکمیل پروژه، توسعه داشبورد مدیریتی و اتصال کامل به Jira.",
    "goals": _table_section("goals", [
        {
            "goal": "پیاده‌سازی سامانه",
            "priority": "بالا",
            "responsible": "واحد فناوری",
            "timeline": "خرداد ۱۴۰۵",
            "status": "در حال انجام",
            "progress": "70%",
            "notes": "",
        },
    ]),
    "actions": _table_section("actions", [
        {
            "action_title": "راه‌اندازی سرویس",
            "action_description": "استقرار سرویس جدید",
            "result": "موفق",
            "responsible": "تیم فنی",
            "completion_date": "۱۴۰۵/۰۲/۱۵",
            "status": "انجام شد",
            "related_document": "",
        },
    ]),
    "metrics": _table_section("metrics", [
        {
            "indicator_name": "درصد رضایت",
            "definition": "میانگین رضایت کاربران",
            "target": "90%",
            "actual": "91%",
            "realization_pct": "101%",
            "status": "مطلوب",
            "short_analysis": "بالاتر از هدف",
        },
    ]),
    "analysis": _table_section("analysis", [
        {
            "subject": "عملکرد کلی",
            "status": "مطلوب",
            "cause": "بهبود فرآیندها",
            "company_effect": "افزایش بهره‌وری",
            "corrective_action": "ادامه روند فعلی",
        },
    ]),
    "risks": _table_section("risks", [
        {
            "problem_risk": "افزایش بار سامانه",
            "effect": "کاهش سرعت",
            "severity": "متوسط",
            "probability": "زیاد",
            "unit_suggestion": "افزایش ظرفیت سرور",
            "follow_up_responsible": "واحد زیرساخت",
        },
    ]),
    "corrective_actions": _table_section("corrective_actions", [
        {
            "subject": "زیرساخت",
            "proposed_action": "ارتقاء سرورها",
            "proposed_responsible": "واحد فناوری",
            "proposed_time": "تیر ۱۴۰۵",
            "required_resources": "بودجه سخت‌افزار",
            "status": "پیشنهادی",
        },
    ]),
    "next_plans": _table_section("next_plans", [
        {
            "program": "توسعه داشبورد مدیریتی",
            "priority": "بالا",
            "expected_output": "داشبورد عملیاتی",
            "responsible": "واحد فناوری",
            "timeline": "مرداد ۱۴۰۵",
            "dependencies": "داده‌های Jira",
            "possible_risk": "تأخیر در اتصال API",
        },
    ]),
    "management_decisions": _table_section("management_decisions", [
        {
            "decision_subject": "تخصیص بودجه",
            "description": "بودجه ارتقاء زیرساخت",
            "unit_suggestion": "تأیید درخواست",
            "urgency": "بالا",
            "no_decision_effect": "کاهش کیفیت سرویس",
            "decision_deadline": "۱۴۰۵/۰۴/۳۱",
        },
    ]),
    "attachments": _table_section("attachments"),
    "manager_scoring": _table_section("manager_scoring", [
        {"evaluation_axis": "برنامه‌ها تحقق", "score": "", "explanation": ""},
        {"evaluation_axis": "خروجی‌ها کیفیت", "score": "", "explanation": ""},
        {"evaluation_axis": "زمان‌بندی رعایت", "score": "", "explanation": ""},
        {"evaluation_axis": "ریسک‌ها مدیریت", "score": "", "explanation": ""},
        {"evaluation_axis": "بین‌واحدی همکاری", "score": "", "explanation": ""},
        {"evaluation_axis": "نهایی جمع‌بندی", "score": "", "explanation": ""},
    ]),
}
