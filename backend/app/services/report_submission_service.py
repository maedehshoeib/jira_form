import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.api.routes.reports_helpers import DEFAULT_PERFORMANCE_DATA
from app.models.report import Report
from app.models.user import User
from app.services.portal_service import DEPARTMENTS

PERFORMANCE_FORM_ID = "performance-report-form"
PERFORMANCE_SECTION_ID = "management-report"
PERFORMANCE_DEPARTMENT_ID = "reports"


def is_performance_report_submission(
    form_id: str, department_id: str, section_id: str
) -> bool:
    return form_id == PERFORMANCE_FORM_ID or (
        department_id == PERFORMANCE_DEPARTMENT_ID
        and section_id == PERFORMANCE_SECTION_ID
    )


def _department_title(department_id: str) -> str:
    for dep in DEPARTMENTS:
        if dep.id == department_id:
            return dep.title
    return ""


def _parse_table_rows(text: str, columns: list[dict]) -> list[dict]:
    rows = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) < len(columns):
            continue
        rows.append(
            {columns[i]["key"]: parts[i] for i in range(len(columns))}
        )
    return rows


def build_performance_report_data(
    form_data: dict, user: User, department_id: str
) -> dict:
    now = datetime.utcnow()
    org_unit = (
        form_data.get("organizational_unit")
        or user.department
        or _department_title(department_id)
        or ""
    )

    goals_columns = DEFAULT_PERFORMANCE_DATA["goals"]["columns"]
    actions_columns = DEFAULT_PERFORMANCE_DATA["actions"]["columns"]
    metrics_columns = DEFAULT_PERFORMANCE_DATA["metrics"]["columns"]

    return {
        "summary": [
            {"label": "واحد سازمانی", "value": org_unit},
            {
                "label": "عنوان گزارش",
                "value": "گزارش عملکرد شورای معاونین و مدیران",
            },
            {"label": "ثبت کننده", "value": user.display_name or user.username},
            {"label": "تاریخ ثبت", "value": now.strftime("%Y/%m/%d")},
            {"label": "آخرین بروزرسانی", "value": now.strftime("%Y/%m/%d %H:%M")},
            {"label": "وضعیت", "value": "ثبت شده"},
        ],
        "achievements": form_data.get("achievements", ""),
        "challenges": form_data.get("challenges", ""),
        "goals": {
            "columns": goals_columns,
            "rows": _parse_table_rows(form_data.get("goals", ""), goals_columns),
        },
        "actions": {
            "columns": actions_columns,
            "rows": _parse_table_rows(form_data.get("actions", ""), actions_columns),
        },
        "metrics": {
            "columns": metrics_columns,
            "rows": _parse_table_rows(form_data.get("metrics", ""), metrics_columns),
        },
        "analysis": form_data.get("analysis", ""),
        "risks": form_data.get("risks", ""),
        "corrective_actions": form_data.get("corrective_actions", ""),
        "next_plans": form_data.get("next_plans", ""),
        "management_decisions": form_data.get("management_decisions", ""),
    }


def create_report_from_submission(
    db: Session,
    form_data: dict,
    user: User,
    department_id: str,
) -> Report:
    report_data = build_performance_report_data(form_data, user, department_id)
    org_unit = next(
        (item["value"] for item in report_data["summary"] if item["label"] == "واحد سازمانی"),
        "",
    )

    report = Report(
        title="گزارش عملکرد شورای معاونین و مدیران",
        report_type="performance",
        department=org_unit,
        status="ثبت شده",
        data=json.dumps(report_data, ensure_ascii=False),
        created_by_id=user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
