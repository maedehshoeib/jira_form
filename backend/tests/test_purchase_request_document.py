import io
import json
import unittest
import zipfile
from xml.etree import ElementTree as ET

from app.services.purchase_request_document import (
    W_NS,
    build_purchase_request_docx,
    is_purchase_request_target,
    purchase_request_subject,
)


class PurchaseRequestDocumentTests(unittest.TestCase):
    def setUp(self):
        self.data = {
            "requesting_unit": "فناوری اطلاعات",
            "request_number": "PR-1405-24",
            "request_date": "1405/06/02",
            "items": json.dumps(
                [
                    {
                        "item_title": "لپ‌تاپ",
                        "requested_quantity": "2",
                        "usage_reason": "واحد توسعه",
                        "technical_specs": "رم 32 گیگابایت",
                        "stock_quantity": "0",
                        "purchase_quantity": "2",
                    }
                ],
                ensure_ascii=False,
            ),
            "requester_name": "کاربر آزمایشی",
            "requester_signature_date": "1405/06/02",
        }

    def test_target_and_subject(self):
        self.assertTrue(
            is_purchase_request_target("common-form", "finance", "purchase-request")
        )
        self.assertFalse(
            is_purchase_request_target("common-form", "finance", "petty-cash")
        )
        self.assertEqual(
            purchase_request_subject(self.data),
            "درخواست تامین کالا - لپ‌تاپ",
        )

    def test_build_keeps_template_and_fills_values(self):
        document = build_purchase_request_docx(self.data)
        self.assertGreater(len(document), 50_000)

        with zipfile.ZipFile(io.BytesIO(document)) as archive:
            self.assertIn("word/header2.xml", archive.namelist())
            self.assertIn("word/media/image1.png", archive.namelist())
            root = ET.fromstring(archive.read("word/document.xml"))

        all_text = " ".join(
            node.text or "" for node in root.iter(f"{{{W_NS}}}t")
        )
        for expected in (
            "فناوری اطلاعات",
            "PR-1405-24",
            "1405/06/02",
            "لپ‌تاپ",
            "رم 32 گیگابایت",
            "کاربر آزمایشی",
        ):
            self.assertIn(expected, all_text)


if __name__ == "__main__":
    unittest.main()
