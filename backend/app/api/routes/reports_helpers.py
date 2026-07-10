import json
from datetime import datetime

from app.core.config import settings
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportResponse


def _format_dt(dt: datetime) -> str:
    return dt.strftime("%Y/%m/%d %H:%M")


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


DEFAULT_PERFORMANCE_DATA = {
    "summary": [
        {"label": "واحد سازمانی", "value": "فناوری اطلاعات"},
        {"label": "عنوان گزارش", "value": "گزارش عملکرد شورای معاونین و مدیران"},
        {"label": "ثبت کننده", "value": ""},
        {"label": "تاریخ ثبت", "value": ""},
        {"label": "آخرین بروزرسانی", "value": ""},
        {"label": "وضعیت", "value": "ثبت شده"},
    ],
    "achievements": "پیاده سازی نسخه جدید سامانه خدمات، افزایش سرعت پاسخگویی، بهبود فرآیندهای داخلی.",
    "challenges": "کمبود منابع انسانی، محدودیت بودجه و نیاز به ارتقاء زیرساخت.",
    "goals": {
        "columns": [
            {"key": "goal", "title": "هدف"},
            {"key": "owner", "title": "مسئول"},
            {"key": "progress", "title": "درصد پیشرفت"},
        ],
        "rows": [
            {"goal": "پیاده سازی سامانه", "owner": "واحد فناوری", "progress": "70%"},
            {"goal": "بهبود زیرساخت", "owner": "واحد شبکه", "progress": "55%"},
        ],
    },
    "actions": {
        "columns": [
            {"key": "title", "title": "اقدام"},
            {"key": "status", "title": "وضعیت"},
            {"key": "description", "title": "توضیحات"},
        ],
        "rows": [
            {"title": "راه اندازی سرویس", "status": "انجام شد", "description": "بدون مشکل"},
            {"title": "به روزرسانی تجهیزات", "status": "در حال انجام", "description": "50 درصد"},
        ],
    },
    "metrics": {
        "columns": [
            {"key": "name", "title": "شاخص"},
            {"key": "value", "title": "مقدار"},
        ],
        "rows": [
            {"name": "درصد رضایت", "value": "91%"},
            {"name": "تعداد درخواست ها", "value": "245"},
        ],
    },
    "analysis": "عملکرد واحد در این دوره نسبت به دوره قبل بهبود قابل توجهی داشته است.",
    "risks": "احتمال افزایش بار سامانه و کمبود منابع سخت افزاری.",
    "corrective_actions": "افزایش ظرفیت سرورها و بهینه سازی فرآیند پاسخگویی.",
    "next_plans": "تکمیل پروژه، توسعه داشبورد مدیریتی و اتصال کامل به Jira.",
    "management_decisions": "تخصیص بودجه برای ارتقاء زیرساخت و جذب نیروی متخصص.",
}
