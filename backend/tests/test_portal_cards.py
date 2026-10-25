import tempfile
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.department import Department  # noqa: F401
from app.models.form_template import (
    FormDutyAssignment,
    UserFormAccess,
)
from app.models.portal_card import PortalCard, PortalCardFile
from app.models.submission import Submission
from app.models.user import User
from app.schemas.portal_card import CardFormSchema, PortalCardFields
from app.services.form_access_service import access_catalog, duty_catalog
from app.services.portal_card_admin_service import (
    MAX_DEPTH,
    PortalCardAdminService,
)
from app.services.portal_card_form import (
    derive_subject,
    validate_submission,
)
from app.services.portal_card_service import PortalCardService, custom_form_titles
from app.services.form_duty_service import (
    replace_assignments,
    snapshot_submission_initial_assignees,
)
from app.services.portal_card_targets import (
    custom_form_id,
    custom_section_id,
    document_target_id,
    group_target_id,
    parse_custom_form_id,
)
from app.services.task_workflow_service import list_task_submissions

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


class _Upload:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.read = AsyncMock(return_value=content)


def _fields(title: str, published: bool = True) -> PortalCardFields:
    return PortalCardFields(title=title, description="", is_published=published)


def _schema(*fields: dict, section_title: str = "اطلاعات") -> CardFormSchema:
    return CardFormSchema.model_validate(
        {"sections": [{"id": "s1", "title": section_title, "fields": list(fields)}]}
    )


def _field(name: str, label: str, type_: str = "text", **extra) -> dict:
    return {"name": name, "label": label, "type": type_, **extra}


class PortalCardTestCase(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.upload_root = tempfile.TemporaryDirectory()
        self._original_upload_dir = settings.UPLOAD_DIR
        settings.UPLOAD_DIR = self.upload_root.name
        self.admin = User(
            username="admin", display_name="مدیر", is_active=True, is_admin=True,
            must_change_password=False,
        )
        self.employee = User(
            username="emp", display_name="کارمند", is_active=True, is_admin=False,
            must_change_password=False,
        )
        self.db.add_all([self.admin, self.employee])
        self.db.commit()
        self.admin_service = PortalCardAdminService(self.db)
        self.reader = PortalCardService(self.db)

    def tearDown(self):
        settings.UPLOAD_DIR = self._original_upload_dir
        self.db.close()
        self.upload_root.cleanup()

    async def make(self, kind: str, title: str, parent_id=None, published=True, logo=None):
        return await self.admin_service.create(
            self.admin, kind, parent_id, _fields(title, published), logo  # type: ignore[arg-type]
        )


class CardTreeTests(PortalCardTestCase):
    async def test_create_nested_cards_with_logo_and_breadcrumbs(self):
        group = await self.make("group", "مالی", logo=_Upload("logo.png", PNG))
        child = await self.make("document", "آیین‌نامه", parent_id=group.id)

        self.assertTrue(group.logo_url and group.logo_url.endswith(f"{group.id}/logo?v={int(self.reader.require(group.id).updated_at.timestamp())}"))
        path, _, media_type = self.reader.resolve_logo(group.id)
        self.assertTrue(path.is_file())
        self.assertEqual(media_type, "image/png")

        detail = self.reader.get_detail(self.employee, child.id)
        self.assertEqual([item.title for item in detail.breadcrumbs], ["مالی"])
        root_titles = [c.title for c in self.reader.list_children(self.employee, None)]
        self.assertEqual(root_titles, ["مالی"])

    async def test_rejects_invalid_logo(self):
        with self.assertRaises(HTTPException) as raised:
            await self.make("group", "x", logo=_Upload("logo.txt", b"not-an-image"))
        self.assertEqual(raised.exception.status_code, 415)

    async def test_only_groups_can_contain_cards_and_depth_is_limited(self):
        doc = await self.make("document", "سند")
        with self.assertRaises(HTTPException) as raised:
            await self.make("group", "داخل سند", parent_id=doc.id)
        self.assertEqual(raised.exception.status_code, 422)

        parent_id = None
        for level in range(MAX_DEPTH):
            card = await self.make("group", f"سطح {level}", parent_id=parent_id)
            parent_id = card.id
        with self.assertRaises(HTTPException):
            await self.make("group", "خیلی عمیق", parent_id=parent_id)

    async def test_employee_sees_published_and_non_empty_only(self):
        draft = await self.make("document", "پیش‌نویس", published=False)
        empty_group = await self.make("group", "گروه خالی")
        full_group = await self.make("group", "گروه پر")
        await self.make("document", "سند", parent_id=full_group.id)
        hidden_parent = await self.make("group", "مخفی", published=False)
        await self.make("document", "زیر مخفی", parent_id=hidden_parent.id)

        titles = [c.title for c in self.reader.list_children(self.employee, None)]
        self.assertEqual(titles, ["گروه پر"])
        all_titles = {c.title for c in self.reader.list_children(self.admin, None)}
        self.assertEqual(
            all_titles, {"پیش‌نویس", "گروه خالی", "گروه پر", "مخفی"}
        )
        for hidden in (draft.id, empty_group.id, hidden_parent.id):
            with self.assertRaises(HTTPException) as raised:
                self.reader.get_detail(self.employee, hidden)
            self.assertEqual(raised.exception.status_code, 404)

    async def test_reorder_move_and_cycle_protection(self):
        first = await self.make("group", "الف")
        second = await self.make("group", "ب")
        self.admin_service.reorder(None, [second.id, first.id])
        order = [c.title for c in self.reader.list_children(self.admin, None)]
        self.assertEqual(order, ["ب", "الف"])
        with self.assertRaises(HTTPException):
            self.admin_service.reorder(None, [first.id])

        child = await self.make("group", "فرزند", parent_id=first.id)
        with self.assertRaises(HTTPException) as raised:
            self.admin_service.move(first.id, child.id)
        self.assertEqual(raised.exception.status_code, 422)

        moved = self.admin_service.move(child.id, second.id)
        self.assertEqual(moved.parent_id, second.id)
        self.assertEqual(moved.breadcrumbs[0].title, "ب")

    async def test_delete_removes_subtree_files_and_access_rows(self):
        group = await self.make("group", "گروه", logo=_Upload("logo.png", PNG))
        doc = await self.make("document", "سند", parent_id=group.id)
        await self.admin_service.add_file(doc.id, "فایل", _Upload("a.pdf", b"%PDF-1.4 x"))
        form = await self.make("form", "فرم", parent_id=group.id)
        form_key = (custom_section_id(form.id), custom_form_id(form.id))
        self.db.add_all([
            UserFormAccess(
                user_id=self.employee.id, portal_department_id="custom",
                section_id=form_key[0], form_id=form_key[1],
            ),
            FormDutyAssignment(
                user_id=self.employee.id, portal_department_id="custom",
                section_id=form_key[0], form_id=form_key[1],
            ),
        ])
        self.db.commit()
        stored = [
            self.reader.require(group.id).logo_path,
            self.reader.require(doc.id).files[0].file_path,
        ]

        self.admin_service.delete(group.id)

        self.assertEqual(self.db.query(PortalCard).count(), 0)
        self.assertEqual(self.db.query(PortalCardFile).count(), 0)
        self.assertEqual(self.db.query(UserFormAccess).count(), 0)
        self.assertEqual(self.db.query(FormDutyAssignment).count(), 0)
        for path in stored:
            self.assertFalse(self.reader.storage.safe_path(path))


class DocumentCardTests(PortalCardTestCase):
    async def test_content_and_files(self):
        doc = await self.make("document", "مستند")
        updated = self.admin_service.set_content(doc.id, "متن مستند")
        self.assertEqual(updated.content, "متن مستند")

        with_file = await self.admin_service.add_file(
            doc.id, "", _Upload("guide.pdf", b"%PDF-1.7 data")
        )
        self.assertEqual(len(with_file.files), 1)
        self.assertTrue(with_file.files[0].is_pdf)
        file_id = with_file.files[0].id
        path, name, media_type = self.reader.resolve_file(self.employee, doc.id, file_id)
        self.assertTrue(path.is_file())
        self.assertEqual((name, media_type), ("guide.pdf", "application/pdf"))

        remaining = self.admin_service.delete_file(doc.id, file_id)
        self.assertEqual(remaining.files, [])
        self.assertFalse(path.exists())

    async def test_rejects_bad_files_and_wrong_kind(self):
        doc = await self.make("document", "مستند")
        with self.assertRaises(HTTPException) as raised:
            await self.admin_service.add_file(doc.id, "", _Upload("evil.exe", b"MZ"))
        self.assertEqual(raised.exception.status_code, 415)
        with self.assertRaises(HTTPException) as raised:
            await self.admin_service.add_file(doc.id, "", _Upload("fake.pdf", b"not a pdf"))
        self.assertEqual(raised.exception.status_code, 415)

        group = await self.make("group", "گروه")
        with self.assertRaises(HTTPException):
            self.admin_service.set_content(group.id, "x")

    async def test_employee_cannot_download_from_unpublished_document(self):
        doc = await self.make("document", "مستند", published=False)
        with_file = await self.admin_service.add_file(
            doc.id, "", _Upload("guide.pdf", b"%PDF-1.7 data")
        )
        with self.assertRaises(HTTPException) as raised:
            self.reader.resolve_file(self.employee, doc.id, with_file.files[0].id)
        self.assertEqual(raised.exception.status_code, 404)


class FormCardTests(PortalCardTestCase):
    async def test_form_template_uses_sections_and_canonical_ids(self):
        form = await self.make("form", "درخواست مرخصی")
        self.admin_service.set_form(
            form.id,
            _schema(
                _field("reason", "دلیل", required=True),
                _field(
                    "kind", "نوع", "select",
                    options=[{"label": "استحقاقی", "value": "a"}],
                ),
                _field(
                    "rows", "جدول", "table",
                    columns=[{"key": "c1", "title": "ستون"}], initial_rows=2,
                ),
            ),
        )
        detail = self.reader.get_detail(self.employee, form.id)
        template = detail.form
        assert template is not None
        self.assertEqual(template.id, custom_form_id(form.id))
        self.assertEqual(template.department_id, "custom")
        self.assertEqual(template.section_id, custom_section_id(form.id))
        self.assertEqual([f.section for f in template.fields], ["اطلاعات"] * 3)
        self.assertEqual(len(template.fields[2].default_rows), 2)

        context = self.reader.resolve_form(custom_form_id(form.id))
        assert context is not None
        self.assertEqual(context.card.id, form.id)
        self.assertIsNone(self.reader.resolve_form("custom-9999"))
        self.assertIsNone(self.reader.resolve_form("common-form"))

    def test_schema_rejects_bad_definitions(self):
        bad = [
            [_field("a", "الف"), _field("a", "دوباره")],
            [_field("a", "الف", "select")],
            [_field("a", "الف", "table")],
            [_field("a", "الف", visible_when_field="zzz", visible_when_value="1")],
            [_field("a", "الف", visible_when_field="a", visible_when_value="1")],
            [_field("form_id", "رزرو")],
            [_field("Bad-Name", "نام")],
            [_field("a", "الف", "select", options=[
                {"label": "1", "value": "x"}, {"label": "2", "value": "x"}])],
        ]
        for fields in bad:
            with self.assertRaises(ValidationError, msg=str(fields)):
                _schema(*fields)

    async def test_set_form_requires_form_kind(self):
        doc = await self.make("document", "سند")
        with self.assertRaises(HTTPException):
            self.admin_service.set_form(doc.id, CardFormSchema())

    async def test_form_visibility_follows_form_access(self):
        form = await self.make("form", "فرم محدود")
        other = await self.make("form", "فرم دیگر")
        self.employee.form_access_configured = True
        self.db.add(
            UserFormAccess(
                user_id=self.employee.id, portal_department_id="custom",
                section_id=custom_section_id(other.id), form_id=custom_form_id(other.id),
            )
        )
        self.db.commit()
        titles = [c.title for c in self.reader.list_children(self.employee, None)]
        self.assertEqual(titles, ["فرم دیگر"])
        self.assertFalse(self.reader.is_visible(self.employee, self.reader.require(form.id)))
        self.assertTrue(self.reader.is_visible(self.admin, self.reader.require(form.id)))

    async def test_access_and_duty_catalog_include_custom_forms(self):
        group = await self.make("group", "معاونت")
        form = await self.make("form", "فرم", parent_id=group.id)
        document = await self.make("document", "سند", parent_id=group.id)

        self.assertFalse([t for t in access_catalog() if t.portal_department_id == "custom"])
        custom = [t for t in access_catalog(self.db) if t.portal_department_id == "custom"]
        form_key = f"custom:{custom_section_id(form.id)}:{custom_form_id(form.id)}"
        group_key = f"custom:{custom_section_id(group.id)}:group-{group.id}"
        document_key = f"custom:{custom_section_id(document.id)}:document-{document.id}"
        self.assertEqual([item.key for item in custom], [group_key, form_key, document_key])
        form_target = next(item for item in custom if item.kind == "form")
        self.assertEqual(form_target.section_title, "معاونت › فرم")
        duty_keys = {item.key for item in duty_catalog(self.db)}
        self.assertIn(group_key, duty_keys)
        self.assertIn(form_key, duty_keys)
        self.assertNotIn(document_key, duty_keys)

    async def test_titles_for_submission_lists(self):
        group = await self.make("group", "معاونت")
        form = await self.make("form", "فرم")
        child = await self.make("form", "فرم داخلی", parent_id=group.id)
        self.assertEqual(custom_form_titles(self.db, custom_form_id(form.id)), ("کارت‌های سفارشی", "فرم"))
        self.assertEqual(custom_form_titles(self.db, custom_form_id(child.id)), ("معاونت", "فرم داخلی"))
        self.assertIsNone(custom_form_titles(self.db, "custom-404"))
        self.assertIsNone(custom_form_titles(self.db, "common-form"))


class SubmissionValidationTests(unittest.TestCase):
    def setUp(self):
        self.schema = _schema(
            _field("title", "عنوان", required=True),
            _field("count", "تعداد", "number"),
            _field(
                "kind", "نوع", "select",
                options=[{"label": "الف", "value": "a"}],
            ),
            _field("other", "توضیح", required=True, visible_when_field="kind", visible_when_value="a"),
            _field("email", "ایمیل", "email"),
            _field("rows", "ردیف‌ها", "table", columns=[{"key": "c", "title": "ستون"}]),
        )

    def test_required_and_cleaning(self):
        with self.assertRaises(ValueError):
            validate_submission(self.schema, {})
        cleaned = validate_submission(
            self.schema, {"title": "سلام", "junk": "x", "kind": "", "other": "ignored"}
        )
        self.assertEqual(cleaned, {"title": "سلام"})

    def test_conditional_required(self):
        with self.assertRaises(ValueError):
            validate_submission(self.schema, {"title": "t", "kind": "a"})
        cleaned = validate_submission(self.schema, {"title": "t", "kind": "a", "other": "yes"})
        self.assertEqual(cleaned["other"], "yes")

    def test_value_checks(self):
        base = {"title": "t"}
        for extra in ({"count": "abc"}, {"kind": "zzz"}, {"email": "no-at"}):
            with self.assertRaises(ValueError, msg=str(extra)):
                validate_submission(self.schema, {**base, **extra})

    def test_required_table_needs_content(self):
        schema = _schema(
            _field("rows", "ردیف‌ها", "table", required=True, columns=[{"key": "c", "title": "ستون"}])
        )
        with self.assertRaises(ValueError):
            validate_submission(schema, {"rows": '[{"c": " "}]'})
        self.assertIn("rows", validate_submission(schema, {"rows": '[{"c": "v"}]'}))

    def test_subject_uses_first_filled_text_or_title(self):
        self.assertEqual(derive_subject(self.schema, {"title": " موضوع "}, "فرم"), "موضوع")
        self.assertEqual(derive_subject(self.schema, {}, "فرم"), "فرم")

    def test_parse_custom_form_id(self):
        self.assertEqual(parse_custom_form_id("custom-12"), 12)
        for value in ("custom-", "custom-x", "custom-1.5", "common-form", "custom-١٢"):
            self.assertIsNone(parse_custom_form_id(value), value)


class CardAccessRoutingTests(PortalCardTestCase):
    def setUp(self):
        super().setUp()
        self.handler = User(
            username="handler", display_name="مسئول", is_active=True, is_admin=False,
            must_change_password=False,
        )
        self.outsider = User(
            username="outsider", display_name="بدون دسترسی", is_active=True,
            is_admin=False, must_change_password=False, form_access_configured=True,
        )
        self.db.add_all([self.handler, self.outsider])
        self.db.commit()

    def _grant(self, user: User, *cards: PortalCard) -> None:
        user.form_access_configured = True
        self.db.query(UserFormAccess).filter(UserFormAccess.user_id == user.id).delete(
            synchronize_session=False
        )
        self.db.add_all(
            [
                UserFormAccess(
                    user_id=user.id,
                    portal_department_id="custom",
                    section_id=custom_section_id(card.id),
                    form_id=custom_form_id(card.id)
                    if card.kind == "form"
                    else group_target_id(card.id)
                    if card.kind == "group"
                    else document_target_id(card.id),
                )
                for card in cards
            ]
        )
        self.db.commit()

    def _titles(self, user: User, parent_id: int | None = None) -> list[str]:
        return [card.title for card in self.reader.list_children(user, parent_id)]

    async def test_two_root_forms_are_granted_independently(self):
        first = await self.make("form", "فرم اول")
        second = await self.make("form", "فرم دوم")
        keys = {item.key for item in access_catalog(self.db) if item.kind == "form"}
        self.assertIn(f"custom:{custom_section_id(first.id)}:{custom_form_id(first.id)}", keys)
        self.assertIn(f"custom:{custom_section_id(second.id)}:{custom_form_id(second.id)}", keys)

        self._grant(self.employee, first)
        self.assertEqual(self._titles(self.employee), ["فرم اول"])
        self._grant(self.employee, first, second)
        self.assertEqual(self._titles(self.employee), ["فرم اول", "فرم دوم"])

    async def test_grant_on_unpublished_form_shows_it_and_its_group(self):
        group = await self.make("group", "گروه", published=False)
        form = await self.make("form", "فرم داخلی", parent_id=group.id, published=False)
        other = await self.make("form", "فرم دیگر", published=False)

        self.assertEqual(self._titles(self.employee), [])
        self._grant(self.employee, form)
        self.assertEqual(self._titles(self.employee), ["گروه"])
        self.assertEqual(self._titles(self.employee, group.id), ["فرم داخلی"])
        self.assertFalse(self.reader.is_visible(self.employee, self.reader.require(other.id)))
        detail = self.reader.get_detail(self.employee, form.id)
        self.assertEqual(detail.kind, "form")

    async def test_group_grant_reveals_the_folder_and_routes_its_forms(self):
        group = await self.make("group", "گروه", published=False)
        form = await self.make("form", "فرم داخلی", parent_id=group.id, published=False)
        self._grant(self.employee, group)
        self.assertEqual(self._titles(self.employee, group.id), ["فرم داخلی"])

        group_key = f"custom:{custom_section_id(group.id)}:{group_target_id(group.id)}"
        replace_assignments(self.db, [(self.handler.id, group_key)])
        self.assertEqual(self._titles(self.handler), ["گروه"])
        self.assertEqual(self.reader.get_detail(self.handler, form.id).title, "فرم داخلی")

        with self.assertRaises(ValueError):
            replace_assignments(
                self.db,
                [(self.handler.id, f"custom:{custom_section_id(form.id)}:document-{form.id}")],
            )
        replace_assignments(self.db, [(self.handler.id, group_key)])

        submission = Submission(
            form_id=custom_form_id(form.id),
            department_id="custom",
            section_id=custom_section_id(form.id),
            user_id=self.employee.id,
            subject="درخواست",
            data="{}",
        )
        self.db.add(submission)
        self.db.flush()
        snapshot_submission_initial_assignees(self.db, submission)
        self.db.commit()

        handler_ids = [item.id for item in list_task_submissions(self.db, self.handler.id)]
        employee_ids = [item.id for item in list_task_submissions(self.db, self.employee.id)]
        self.assertEqual(handler_ids, [submission.id])
        self.assertEqual(employee_ids, [])
        self.assertEqual(self._titles(self.outsider), [])


if __name__ == "__main__":
    unittest.main()
