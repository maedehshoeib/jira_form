from pydantic import BaseModel


class ContractListItem(BaseModel):
    id: int
    row_number: int
    start_date: str
    end_date: str
    subject: str
    contract_party: str
    contract_type: str
    contract_type_label: str
    contract_number: str
    attachment_name: str | None
    has_attachment: bool
    created_by_name: str
    created_at: str


class ContractResponse(ContractListItem):
    pass


class ContractCreateResponse(BaseModel):
    message: str
    id: int
    row_number: int
