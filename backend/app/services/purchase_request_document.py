import io
import json
import zipfile
from copy import deepcopy
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


PURCHASE_REQUEST_DEPARTMENT_ID = "finance"
PURCHASE_REQUEST_SECTION_ID = "purchase-request"
PURCHASE_REQUEST_FORM_ID = "common-form"

TEMPLATE_PATH = (
    Path(__file__).resolve().parents[1]
    / "assets"
    / "forms"
    / "purchase-request-template.docx"
)

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
W = f"{{{W_NS}}}"

ITEM_KEYS = (
    "row_number",
    "item_title",
    "requested_quantity",
    "usage_reason",
    "technical_specs",
    "stock_quantity",
    "purchase_quantity",
)

SIGNATURE_FIELDS = (
    ("requester_name", "requester_signature_date"),
    ("approver_name", "approver_signature_date"),
    ("procurement_name", "procurement_signature_date"),
    ("finance_name", "finance_signature_date"),
    ("ceo_name", "ceo_signature_date"),
)


def is_purchase_request_target(
    form_id: str,
    department_id: str,
    section_id: str,
) -> bool:
    return (
        form_id == PURCHASE_REQUEST_FORM_ID
        and department_id == PURCHASE_REQUEST_DEPARTMENT_ID
        and section_id == PURCHASE_REQUEST_SECTION_ID
    )


def _string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _items(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return []
    if not isinstance(value, list):
        return []
    return [row for row in value if isinstance(row, dict)]


def purchase_request_subject(data: dict[str, Any]) -> str:
    first_title = next(
        (
            _string(row.get("item_title"))
            for row in _items(data.get("items"))
            if _string(row.get("item_title"))
        ),
        "",
    )
    return f"درخواست تامین کالا - {first_title}" if first_title else "درخواست تامین کالا"


def _read_namespaces(xml_bytes: bytes) -> None:
    for _, namespace in ET.iterparse(io.BytesIO(xml_bytes), events=("start-ns",)):
        prefix, uri = namespace
        ET.register_namespace(prefix, uri)


def _text_nodes(element: ET.Element) -> list[ET.Element]:
    return list(element.iter(f"{W}t"))


def _set_text_node(nodes: list[ET.Element], index: int, value: str) -> None:
    if index >= len(nodes):
        return
    nodes[index].text = value
    nodes[index].set(f"{{{XML_NS}}}space", "preserve")


def _set_cell_lines(cell: ET.Element, lines: list[str]) -> None:
    paragraph = cell.find(f"{W}p")
    if paragraph is None:
        paragraph = ET.SubElement(cell, f"{W}p")

    paragraph_properties = paragraph.find(f"{W}pPr")
    for child in list(paragraph):
        if child is not paragraph_properties:
            paragraph.remove(child)

    run = ET.SubElement(paragraph, f"{W}r")
    run_properties = ET.SubElement(run, f"{W}rPr")
    fonts = ET.SubElement(run_properties, f"{W}rFonts")
    fonts.set(f"{W}ascii", "B Nazanin")
    fonts.set(f"{W}hAnsi", "B Nazanin")
    fonts.set(f"{W}cs", "B Nazanin")
    ET.SubElement(run_properties, f"{W}rtl")

    for index, line in enumerate(lines):
        if index:
            ET.SubElement(run, f"{W}br")
        text = ET.SubElement(run, f"{W}t")
        text.set(f"{{{XML_NS}}}space", "preserve")
        text.text = line


def _fill_document_xml(xml_bytes: bytes, data: dict[str, Any]) -> bytes:
    _read_namespaces(xml_bytes)
    root = ET.fromstring(xml_bytes)
    body = root.find(f"{W}body")
    if body is None:
        raise ValueError("Invalid purchase-request Word template")

    body_paragraphs = body.findall(f"{W}p")
    if len(body_paragraphs) >= 2:
        first_line = _text_nodes(body_paragraphs[0])
        _set_text_node(first_line, 1, f" {_string(data.get('requesting_unit'))} ")
        _set_text_node(first_line, 5, f" {_string(data.get('request_number'))} ")

        date_line = _text_nodes(body_paragraphs[1])
        if len(date_line) >= 2:
            _set_text_node(
                date_line,
                1,
                f" درخواست: {_string(data.get('request_date'))}",
            )

    tables = body.findall(f"{W}tbl")
    if len(tables) < 2:
        raise ValueError("Purchase-request Word template is missing its tables")

    item_rows = tables[0].findall(f"{W}tr")[1:10]
    items = _items(data.get("items"))
    for row_index, row in enumerate(item_rows):
        cells = row.findall(f"{W}tc")
        item = items[row_index] if row_index < len(items) else {}
        values = [
            _string(item.get("row_number")) or str(row_index + 1),
            _string(item.get("item_title")),
            _string(item.get("requested_quantity")),
            _string(item.get("usage_reason")),
            _string(item.get("technical_specs")),
            _string(item.get("stock_quantity")),
            _string(item.get("purchase_quantity")),
        ]
        for cell, value in zip(cells, values):
            _set_cell_lines(cell, [value])

    signature_rows = tables[1].findall(f"{W}tr")
    if len(signature_rows) >= 2:
        signature_cells = signature_rows[1].findall(f"{W}tc")
        for cell, (name_key, date_key) in zip(signature_cells, SIGNATURE_FIELDS):
            _set_cell_lines(
                cell,
                [
                    f"نام و نام خانوادگی: {_string(data.get(name_key))}",
                    f"تاریخ و امضا: {_string(data.get(date_key))}",
                ],
            )

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def build_purchase_request_docx(data: dict[str, Any]) -> bytes:
    if not TEMPLATE_PATH.is_file():
        raise FileNotFoundError("Purchase-request Word template was not found")

    output = io.BytesIO()
    with zipfile.ZipFile(TEMPLATE_PATH, "r") as source, zipfile.ZipFile(
        output, "w", zipfile.ZIP_DEFLATED
    ) as target:
        for entry in source.infolist():
            content = source.read(entry.filename)
            if entry.filename == "word/document.xml":
                content = _fill_document_xml(content, deepcopy(data))
            target.writestr(entry, content)
    return output.getvalue()
