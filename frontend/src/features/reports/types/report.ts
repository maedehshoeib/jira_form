export type ReportStatus =
  | "جدید"
  | "در حال بررسی"
  | "در حال انجام"
  | "تکمیل شده"
  | "رد شده";

export interface Report {

  id: string;

  trackingCode: string;

  department: string;

  requestType: string;

  requester: string;

  createdAt: string;

  updatedAt: string;

  status: ReportStatus;

  fields: Record<string, any>;

  attachments?: string[];

}