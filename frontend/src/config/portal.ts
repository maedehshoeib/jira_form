export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'file' | 'email';

export type SelectOption = {
  label: string;
  value: string;
};

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
};

export type FormTemplate = {
  id: string;
  title: string;
  department_id?: string;
  section_id?: string;
  fields: FormField[];
};

export type Section = {
  id: string;
  title: string;
  form_id: string;
};

export type Department = {
  id: string;
  title: string;
  icon?: string;
  sections: Section[];
};

export const API_BASE = "/api/v1";
