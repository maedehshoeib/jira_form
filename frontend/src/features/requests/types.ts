export type WorkflowStatus =
  | "unseen"
  | "seen"
  | "referred"
  | "in_progress"
  | "completed"
  | "rejected";

export type StatusTab = "all" | WorkflowStatus;

export type InitialAssignee = {
  user_id: number;
  username: string;
  display_name: string;
};

export type ReferralItem = {
  id: number;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  note: string;
  attachment_name?: string | null;
  created_at: string;
};

export type TimelineItem = {
  id: number | string;
  event_type: string;
  actor_id?: number | null;
  actor_name: string;
  from_status?: string | null;
  note: string;
  progress_percent: number | null;
  to_status?: string | null;
  from_progress_percent?: number | null;
  to_progress_percent?: number | null;
  to_user_id?: number | null;
  to_user_name?: string | null;
  attachment_name?: string | null;
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
  workflow_status: WorkflowStatus;
  progress_percent: number;
  jira_issue_key?: string;
  jira_status?: string;
  first_viewed_at: string | null;
  initial_assignees?: InitialAssignee[];
  referrals?: ReferralItem[];
  attachment_name: string | null;
  status_attachment_name?: string | null;
  created_at: string;
  submitted_by?: string;
  submitted_by_username?: string;
};

export type SubmissionDetail = SubmissionListItem & {
  data: Record<string, unknown>;
  timeline: TimelineItem[];
};

export type TimeRange = "all" | "today" | "7days" | "30days" | "90days";
export type SortOrder = "newest" | "oldest";
export type ViewMode = "cards" | "table";
