export type DashboardChartItem = { label: string; value: number };

export type UserDashboardData = {
  user_name: string;
  summary: {
    total_tasks: number;
    open_tasks: number;
    completed_tasks: number;
    total_requests: number;
    open_requests: number;
    completed_requests: number;
    sent_letters: number;
    received_letters: number;
  };
  task_statuses: DashboardChartItem[];
  request_statuses: DashboardChartItem[];
  top_requesters: DashboardChartItem[];
  top_recipients: DashboardChartItem[];
  requester_departments: DashboardChartItem[];
  request_departments: DashboardChartItem[];
  request_forms: DashboardChartItem[];
  monthly_tasks: DashboardChartItem[];
  monthly_requests: DashboardChartItem[];
  letters: {
    sent_by_type: DashboardChartItem[];
    received_by_type: DashboardChartItem[];
    sent_by_status: DashboardChartItem[];
    received_by_status: DashboardChartItem[];
  };
};
