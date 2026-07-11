import json

from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.user import User
from app.services.portal_service import DEPARTMENTS
from app.services.performance_report_schema import PERFORMANCE_TABLE_COLUMNS

PERFORMANCE_FORM_ID = "performance-report-form"
PERFORMANCE_SECTION_ID = "management-report"
PERFORMANCE_DEPARTMENT_ID = "reports"

TABLE_FIELD_KEYS = [
    "general_specs",
    "goals",
    "actions",
    "metrics",
    "analysis",
    "risks",
    "corrective_actions",
    "next_plans",
    "management_decisions",
    "attachments",
    "manager_scoring",
]


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
    """Legacy pipe-delimited table parser for backward compatibility."""
    rows = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) < len(columns):
            continue
        rows.append({columns[i]["key"]: parts[i] for i in range(len(columns))})
    return rows


def _parse_table_field(form_data: dict, field_key: str) -> dict:
    columns = PERFORMANCE_TABLE_COLUMNS[field_key]
    raw = form_data.get(field_key, "")

    if isinstance(raw, list):
        rows = raw
    elif isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            rows = parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            rows = _parse_table_rows(raw, columns)
    else:
        rows = []

    return {"columns": columns, "rows": rows}


def _org_unit_from_specs(general_specs: dict, user: User, department_id: str) -> str:
    for row in general_specs.get("rows", []):
        title = (row.get("title") or "").strip()
        if title in ("واحد سازمانی", "واحد"):
            value = (row.get("value") or "").strip()
            if value:
                return value
    return user.department or _department_title(department_id) or ""


def build_performance_report_data(
    form_data: dict, user: User, department_id: str
) -> dict:
    report_data: dict = {}

    for key in TABLE_FIELD_KEYS:
        report_data[key] = _parse_table_field(form_data, key)

    org_unit = _org_unit_from_specs(report_data["general_specs"], user, department_id)

    report_data["achievements"] = form_data.get("achievements", "")
    report_data["problems_risks_summary"] = form_data.get(
        "problems_risks_summary", form_data.get("challenges", "")
    )
    report_data["management_decisions_summary"] = form_data.get(
        "management_decisions_summary", ""
    )
    report_data["next_period_key_programs"] = form_data.get(
        "next_period_key_programs", form_data.get("next_plans", "")
        if isinstance(form_data.get("next_plans"), str)
        else ""
    )

    return report_data


def create_report_from_submission(
    db: Session,
    form_data: dict,
    user: User,
    department_id: str,
) -> Report:
    report_data = build_performance_report_data(form_data, user, department_id)
    org_unit = _org_unit_from_specs(
        report_data["general_specs"], user, department_id
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
