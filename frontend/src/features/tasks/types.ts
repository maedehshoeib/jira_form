export type ReferralItem = {
  id: number;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  note: string;
  attachment_name?: string | null;
  attachment_names?: string[];
  created_at: string;
};

export type TimelineItem = {
  id: string;
  event_type: string;
  actor_id?: number | null;
  actor_name?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  note?: string;
  attachment_name?: string | null;
  attachment_names?: string[];
  created_at: string;
};

export type InitialAssignee = {
  user_id: number;
  username: string;
  display_name: string;
  assigned_at: string;
};

export type CcRecipient = {
  user_id: number;
  username: string;
  display_name: string;
  mentioned_by_id: number;
  mentioned_by_name: string;
  created_at: string;
};

export type SubmissionListItem = {
  id: number;
  form_id: string;
  form_title: string;
  department_id: string;
  department_title: string;
  section_id: string;
  section_title: string;
  subject: string;
  status: string;
  workflow_status: string;
  progress_percent: number;
  jira_issue_key?: string;
  jira_status?: string;
  is_read: boolean;
  first_viewed_at: string | null;
  attachment_name: string | null;
  attachment_names?: string[];
  created_at: string;
  submitted_by?: string;
  submitted_by_username?: string;
  status_updated_by?: string | null;
  status_updated_at?: string | null;
  status_note?: string;
  status_attachment_name?: string | null;
  initial_assignees?: InitialAssignee[];
  referrals?: ReferralItem[];
  cc_recipients?: CcRecipient[];
  can_act?: boolean;
  timeline?: TimelineItem[];
};

export type SubmissionDetail = SubmissionListItem & {
  data: Record<string, unknown>;
};

export type Colleague = {
  id: number;
  username: string;
  display_name: string;
  department: string;
  job_title: string;
  birth_date?: string | null;
  is_birthday?: boolean;
};

export type TimeRange = "all" | "today" | "7days" | "30days" | "90days";
export type SortOrder = "newest" | "oldest";
export type StatusTab = "pending" | "in_progress" | "rejected" | "approved" | "referred";
