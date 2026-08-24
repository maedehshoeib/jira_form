"""Seed deterministic internal/external letters for dashboard verification."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal
from app.models.submission import (
    Submission,
    SubmissionInitialAssignee,
    SubmissionReferral,
)
from app.models.user import User
from app.services.portal_service import (
    MANAGEMENT_LETTER_FORM_ID,
    MANAGEMENT_LETTER_SECTION,
    MANAGEMENT_WORKFLOW_ID,
)

DEMO_PREFIX = "dashboard-letter-demo-v1"


def user(db, username: str) -> User:
    item = db.query(User).filter(User.username == username).first()
    if not item:
        raise RuntimeError(f"Required demo user not found: {username}")
    return item


def create_batch(
    db,
    *,
    batch_id: str,
    letter_type: str,
    sender: User,
    recipients: list[User],
    statuses: list[str],
    created_at: datetime,
) -> bool:
    if db.query(Submission.id).filter(Submission.data.contains(batch_id)).first():
        return False
    recipient_ids = [recipient.id for recipient in recipients]
    type_title = "درون‌سازمانی" if letter_type == "internal" else "برون‌سازمانی"
    for recipient, status in zip(recipients, statuses, strict=True):
        data = {
            "letter_batch_id": batch_id,
            "letter_type": letter_type,
            "system_letter_number": f"DEMO-{batch_id[-2:]}",
            "subject": f"نامه آزمایشی {type_title}",
            "description": "داده کنترل‌شده برای بررسی داشبورد نامه‌ها",
            "recipient_id": recipient.id,
            "recipient_name": recipient.display_name or recipient.username,
            "needs_reply": "ندارد",
            "needs_action": "ندارد(جهت اطلاع)",
        }
        if letter_type == "external":
            data.update({"letter_number": f"TEST-{batch_id[-2:]}", "sender": "بانک"})
        submission = Submission(
            form_id=MANAGEMENT_LETTER_FORM_ID,
            department_id=MANAGEMENT_WORKFLOW_ID,
            section_id=MANAGEMENT_LETTER_SECTION,
            user_id=sender.id,
            subject=data["subject"],
            data=json.dumps(data, ensure_ascii=False),
            status=status,
            progress_percent=100 if status == "approved" else (50 if status == "in_progress" else 0),
            created_at=created_at,
        )
        db.add(submission)
        db.flush()
        db.add_all([
            SubmissionInitialAssignee(
                submission_id=submission.id,
                user_id=recipient_id,
                assigned_at=created_at,
            )
            for recipient_id in recipient_ids
        ])
        db.add(SubmissionReferral(
            submission_id=submission.id,
            from_user_id=sender.id,
            to_user_id=recipient.id,
            note="نامه آزمایشی داشبورد",
            created_at=created_at,
        ))
    return True


def main() -> None:
    db = SessionLocal()
    try:
        shoeib = user(db, "ma.shoeib")
        admin_sender = user(db, "a.shoeib")
        moniri = user(db, "m.moniri")
        nafei = user(db, "m.nafei")
        abarghouei = user(db, "ma.abarghouei")
        now = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
        specs = [
            (f"{DEMO_PREFIX}-out-ex", "external", shoeib, [moniri], ["approved"]),
            (f"{DEMO_PREFIX}-out-in", "internal", shoeib, [nafei, abarghouei], ["submitted", "in_progress"]),
            (f"{DEMO_PREFIX}-in-ex", "external", admin_sender, [shoeib], ["approved"]),
            (f"{DEMO_PREFIX}-in-in", "internal", admin_sender, [shoeib], ["in_progress"]),
        ]
        created = 0
        for index, (batch_id, letter_type, sender, recipients, statuses) in enumerate(specs):
            if create_batch(
                db,
                batch_id=batch_id,
                letter_type=letter_type,
                sender=sender,
                recipients=recipients,
                statuses=statuses,
                created_at=now - timedelta(minutes=index),
            ):
                created += 1
        db.commit()
        demo_rows = db.query(Submission).filter(Submission.data.contains(DEMO_PREFIX)).all()
        batch_types: dict[str, str] = {}
        type_counts = {"internal": 0, "external": 0}
        status_counts: dict[str, int] = {}
        shoeib_sent_batches: set[str] = set()
        shoeib_received = 0
        for row in demo_rows:
            data = json.loads(row.data)
            batch_id = data["letter_batch_id"]
            batch_types[batch_id] = data["letter_type"]
            status_counts[row.status] = status_counts.get(row.status, 0) + 1
            if row.user_id == shoeib.id:
                shoeib_sent_batches.add(batch_id)
            if data.get("recipient_id") == shoeib.id:
                shoeib_received += 1
        for letter_type in batch_types.values():
            type_counts[letter_type] += 1
        assert len(batch_types) == 4
        assert len(demo_rows) == 5
        assert type_counts == {"internal": 2, "external": 2}
        assert status_counts == {"approved": 2, "submitted": 1, "in_progress": 2}
        assert len(shoeib_sent_batches) == 2
        assert shoeib_received == 2
        print(json.dumps({
            "created_batches": created,
            "verified_unique_letters": len(batch_types),
            "verified_recipient_copies": len(demo_rows),
            "verified_by_type": type_counts,
            "verified_by_status": status_counts,
            "verified_ma_shoeib_sent": len(shoeib_sent_batches),
            "verified_ma_shoeib_received": shoeib_received,
        }, ensure_ascii=False))
    finally:
        db.close()


if __name__ == "__main__":
    main()
