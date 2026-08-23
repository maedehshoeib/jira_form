from pydantic import BaseModel
from typing import Any, Optional

class SelectOption(BaseModel):
    label: str
    value: str

class TableColumn(BaseModel):
    key: str
    title: str

class FormField(BaseModel):
    name: str
    label: str
    type: str
    required: bool = False
    placeholder: Optional[str] = None
    options: list[SelectOption] = []
    section: Optional[str] = None
    columns: list[TableColumn] = []
    default_rows: list[dict[str, str]] = []
    visible_when_field: Optional[str] = None
    visible_when_value: Optional[str] = None

class FormTemplate(BaseModel):
    id: str
    title: str
    department_id: str
    section_id: str
    fields: list[FormField]

class Section(BaseModel):
    id: str
    title: str
    form_id: str

class Department(BaseModel):
    id: str
    title: str
    icon: Optional[str] = None
    sections: list[Section]
