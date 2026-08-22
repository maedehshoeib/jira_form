import io
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.api.routes.portal import (
    MAX_SUBMISSION_ATTACHMENT_SIZE,
    _save_submission_attachment,
)
from app.api.routes.submissions_helpers import (
    _attachment_names,
    _parse_submission_data,
    _report_id_from_data,
)


class _SubmissionStub:
    def __init__(self, data: str, attachment_name: str | None = None):
        self.data = data
        self.attachment_name = attachment_name


class SubmissionDataResilienceTests(unittest.TestCase):
    def test_non_object_legacy_json_does_not_break_details(self):
        for raw in ("[]", '"legacy"', "null", "42"):
            with self.subTest(raw=raw):
                self.assertEqual(_parse_submission_data(raw), {})
                self.assertIsNone(_report_id_from_data(raw))
                self.assertEqual(
                    _attachment_names(_SubmissionStub(raw, "legacy.pdf")),
                    ["legacy.pdf"],
                )


class SubmissionUploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_three_megabyte_attachment_is_accepted(self):
        upload = UploadFile(
            filename="finance.pdf",
            file=io.BytesIO(b"x" * (3 * 1024 * 1024)),
        )
        with tempfile.TemporaryDirectory() as directory:
            path, name = await _save_submission_attachment(upload, Path(directory))
            self.assertEqual(name, "finance.pdf")
            self.assertEqual(Path(path).stat().st_size, 3 * 1024 * 1024)

    async def test_attachment_over_limit_is_rejected_without_writing(self):
        upload = UploadFile(
            filename="large.pdf",
            file=io.BytesIO(b"x" * (MAX_SUBMISSION_ATTACHMENT_SIZE + 1)),
        )
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(HTTPException) as raised:
                await _save_submission_attachment(upload, Path(directory))
            self.assertEqual(raised.exception.status_code, 413)
            self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
