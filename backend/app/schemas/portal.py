from pydantic import BaseModel
from typing import Any, Optional

class SelectOption(BaseModel):
    label: str
    value: str

class FormField(BaseModel):
    name: str
    label: str
    type: str
    required: bool = False
    placeholder: Optional[str] = None
    options: list[SelectOption] = []

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