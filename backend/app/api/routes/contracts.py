import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.timezone import format_tehran_datetime
from app.db.contracts_session import get_contracts_db
from app.db.session import get_db as get_access_db
from app.models.contract import Contract
from app.models.user import User
from app.schemas.contract import ContractCreateResponse, ContractListItem, ContractResponse
from app.services.form_access_service import can_access_target

router = APIRouter()

CONTRACT_TYPE_LABELS = {
    "business": "کسب و کار",
    "staff": "ستادی",
}



def require_contract_archive_access(
    current_user: User = Depends(get_current_user),
    access_db: Session = Depends(get_access_db),
) -> User:
    if not can_access_target(
        access_db, current_user, "contract-archive", "", "contract-archive"
    ):
        raise HTTPException(
            status_code=403, detail="شما به آرشیو قراردادها دسترسی ندارید."
        )
    return current_user


def _format_dt(value: datetime | None) -> str:
    return format_tehran_datetime(value)


def _contract_to_list_item(contract: Contract) -> ContractListItem:
    return ContractListItem(
        id=contract.id,
        row_number=contract.row_number,
        start_date=contract.start_date,
        end_date=contract.end_date,
        subject=contract.subject,
        contract_party=contract.contract_party,
        contract_type=contract.contract_type,
        contract_type_label=CONTRACT_TYPE_LABELS.get(
            contract.contract_type, contract.contract_type
        ),
        contract_number=contract.contract_number,
        attachment_name=contract.attachment_name,
        has_attachment=bool(contract.attachment_path),
        created_by_name=contract.created_by_name,
        created_at=_format_dt(contract.created_at),
    )


def _next_row_number(db: Session) -> int:
    last = db.query(Contract.row_number).order_by(Contract.row_number.desc()).first()
    return (last[0] if last else 0) + 1


@router.get("", response_model=list[ContractListItem])
def list_contracts(
    db: Session = Depends(get_contracts_db),
    current_user: User = Depends(require_contract_archive_access),
):
    contracts = db.query(Contract).order_by(Contract.row_number.desc()).all()
    return [_contract_to_list_item(c) for c in contracts]


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_contracts_db),
    current_user: User = Depends(require_contract_archive_access),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="قرارداد یافت نشد")
    return _contract_to_list_item(contract)


@router.post("", response_model=ContractCreateResponse, status_code=201)
async def create_contract(
    request: Request,
    db: Session = Depends(get_contracts_db),
    current_user: User = Depends(require_contract_archive_access),
):
    form = await request.form()
    start_date = str(form.get("start_date", "")).strip()
    end_date = str(form.get("end_date", "")).strip()
    subject = str(form.get("subject", "")).strip()
    contract_party = str(form.get("contract_party", "")).strip()
    contract_type = str(form.get("contract_type", "")).strip()
    contract_number = str(form.get("contract_number", "")).strip()

    if not start_date:
        raise HTTPException(status_code=400, detail="تاریخ شروع الزامی است")
    if not end_date:
        raise HTTPException(status_code=400, detail="تاریخ پایان الزامی است")
    if not subject:
        raise HTTPException(status_code=400, detail="موضوع قرارداد الزامی است")
    if not contract_party:
        raise HTTPException(status_code=400, detail="طرف قرارداد الزامی است")
    if contract_type not in CONTRACT_TYPE_LABELS:
        raise HTTPException(status_code=400, detail="نوع قرارداد نامعتبر است")
    if not contract_number:
        raise HTTPException(status_code=400, detail="شماره قرارداد الزامی است")

    attachment_path = None
    attachment_name = None
    upload_dir = Path(settings.CONTRACTS_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    attachment = form.get("attachment")
    if attachment and hasattr(attachment, "filename") and attachment.filename:
        ext = Path(attachment.filename).suffix
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = upload_dir / filename
        content = await attachment.read()
        file_path.write_bytes(content)
        attachment_path = str(file_path)
        attachment_name = attachment.filename

    contract = Contract(
        row_number=_next_row_number(db),
        start_date=start_date,
        end_date=end_date,
        subject=subject,
        contract_party=contract_party,
        contract_type=contract_type,
        contract_number=contract_number,
        attachment_path=attachment_path,
        attachment_name=attachment_name,
        created_by_id=current_user.id,
        created_by_name=current_user.display_name or current_user.username,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    return ContractCreateResponse(
        message="قرارداد با موفقیت ثبت شد",
        id=contract.id,
        row_number=contract.row_number,
    )


@router.get("/{contract_id}/attachment")
def download_contract_attachment(
    contract_id: int,
    db: Session = Depends(get_contracts_db),
    current_user: User = Depends(require_contract_archive_access),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract or not contract.attachment_path:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")

    file_path = Path(contract.attachment_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="فایل پیوست موجود نیست")

    return FileResponse(
        path=file_path,
        filename=contract.attachment_name or file_path.name,
    )
