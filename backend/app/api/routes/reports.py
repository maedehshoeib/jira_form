from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportListItem, ReportResponse, ReportUpdate
from app.api.routes.reports_helpers import (
    DEFAULT_PERFORMANCE_DATA,
    _format_dt,
    _report_to_response,
    _verify_api_key,
)

router = APIRouter()


@router.get("", response_model=list[ReportListItem])
def list_reports_for_jira_admin(
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
):
    """List all reports for Jira admin integration (requires X-API-Key header)."""
    if not _verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="دسترسی غیرمجاز")

    reports = db.query(Report).order_by(Report.updated_at.desc()).all()
    result = []
    for r in reports:
        creator = db.query(User).filter(User.id == r.created_by_id).first()
        result.append(
            ReportListItem(
                id=r.id,
                title=r.title,
                report_type=r.report_type,
                department=r.department,
                status=r.status,
                created_by=(creator.display_name if creator else "نامشخص"),
                created_at=_format_dt(r.created_at),
                updated_at=_format_dt(r.updated_at),
            )
        )
    return result


@router.get("/public", response_model=list[ReportListItem])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reports = db.query(Report).order_by(Report.updated_at.desc()).all()
    result = []
    for r in reports:
        creator = db.query(User).filter(User.id == r.created_by_id).first()
        result.append(
            ReportListItem(
                id=r.id,
                title=r.title,
                report_type=r.report_type,
                department=r.department,
                status=r.status,
                created_by=(creator.display_name if creator else "نامشخص"),
                created_at=_format_dt(r.created_at),
                updated_at=_format_dt(r.updated_at),
            )
        )
    return result


@router.get("/performance/latest", response_model=ReportResponse)
def get_latest_performance_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime

    report = (
        db.query(Report)
        .filter(Report.report_type == "performance")
        .order_by(Report.updated_at.desc())
        .first()
    )
    if not report:
        now = datetime.utcnow()
        data = DEFAULT_PERFORMANCE_DATA.copy()
        data["summary"] = [
            {"label": "واحد سازمانی", "value": current_user.department or "فناوری اطلاعات"},
            {"label": "عنوان گزارش", "value": "گزارش عملکرد شورای معاونین و مدیران"},
            {"label": "ثبت کننده", "value": current_user.display_name},
            {"label": "تاریخ ثبت", "value": now.strftime("%Y/%m/%d")},
            {"label": "آخرین بروزرسانی", "value": now.strftime("%Y/%m/%d")},
            {"label": "وضعیت", "value": "ثبت شده"},
        ]
        report = Report(
            title="گزارش عملکرد شورای معاونین و مدیران",
            report_type="performance",
            department=current_user.department or "فناوری اطلاعات",
            status="ثبت شده",
            data=__import__("json").dumps(data, ensure_ascii=False),
            created_by_id=current_user.id,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

    return _report_to_response(report, current_user)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report_for_jira_admin(
    report_id: int,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
):
    if not _verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="دسترسی غیرمجاز")

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="گزارش یافت نشد")

    creator = db.query(User).filter(User.id == report.created_by_id).first()
    return _report_to_response(report, creator)


@router.get("/{report_id}/detail", response_model=ReportResponse)
def get_report_detail(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="گزارش یافت نشد")
    return _report_to_response(report, current_user)


@router.post("", response_model=ReportResponse, status_code=201)
def create_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import json

    report = Report(
        title=body.title,
        report_type=body.report_type,
        department=body.department,
        status=body.status,
        data=json.dumps(body.data, ensure_ascii=False),
        created_by_id=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_to_response(report, current_user)


@router.put("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int,
    body: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import json
    from datetime import datetime

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="گزارش یافت نشد")

    if body.title is not None:
        report.title = body.title
    if body.department is not None:
        report.department = body.department
    if body.status is not None:
        report.status = body.status
    if body.data is not None:
        report.data = json.dumps(body.data, ensure_ascii=False)
    report.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)
    return _report_to_response(report, current_user)
