export type JobDescriptionItem = {
  id: number;
  organizational_position: string;
  organizational_unit: string;
  unit_responsibility: string;
  qualification_requirements: string;
  photo_url: string | null;
  photo_name: string;
  has_attachment: boolean;
  attachment_name: string;
  attachment_size: number;
  uploaded_by_id: number | null;
  created_at: string;
  updated_at: string;
};

export type JobDescriptionDraft = {
  organizational_position: string;
  organizational_unit: string;
  unit_responsibility: string;
  qualification_requirements: string;
  photo: File | null;
  attachment: File | null;
  remove_photo: boolean;
  remove_attachment: boolean;
};

export const emptyJobDescriptionDraft = (): JobDescriptionDraft => ({
  organizational_position: "",
  organizational_unit: "",
  unit_responsibility: "",
  qualification_requirements: "",
  photo: null,
  attachment: null,
  remove_photo: false,
  remove_attachment: false,
});
