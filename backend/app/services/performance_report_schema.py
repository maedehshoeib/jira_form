"""Column definitions for گزارش عملکرد شورای معاونین و مدیران."""

PERFORMANCE_TABLE_COLUMNS = {
    "general_specs": [
        {"key": "title", "title": "عنوان"},
        {"key": "value", "title": "شرح/مقدار"},
    ],
    "goals": [
        {"key": "goal", "title": "هدف / برنامه"},
        {"key": "priority", "title": "اولویت"},
        {"key": "responsible", "title": "مسئول"},
        {"key": "timeline", "title": "زمان‌بندی"},
        {"key": "status", "title": "وضعیت"},
        {"key": "progress", "title": "درصد پیشرفت"},
        {"key": "notes", "title": "توضیحات"},
    ],
    "actions": [
        {"key": "action_title", "title": "عنوان اقدام"},
        {"key": "action_description", "title": "شرح اقدام"},
        {"key": "result", "title": "نتیجه"},
        {"key": "responsible", "title": "مسئول"},
        {"key": "completion_date", "title": "تاریخ انجام"},
        {"key": "status", "title": "وضعیت"},
        {"key": "related_document", "title": "مستند مرتبط"},
    ],
    "metrics": [
        {"key": "indicator_name", "title": "نام شاخص"},
        {"key": "definition", "title": "تعریف شاخص"},
        {"key": "target", "title": "هدف"},
        {"key": "actual", "title": "عملکرد واقعی"},
        {"key": "realization_pct", "title": "درصد تحقق"},
        {"key": "status", "title": "وضعیت"},
        {"key": "short_analysis", "title": "تحلیل کوتاه"},
    ],
    "analysis": [
        {"key": "subject", "title": "موضوع"},
        {"key": "status", "title": "وضعیت"},
        {"key": "cause", "title": "علت"},
        {"key": "company_effect", "title": "اثر بر شرکت"},
        {"key": "corrective_action", "title": "اقدام اصلاحی پیشنهادی"},
    ],
    "risks": [
        {"key": "problem_risk", "title": "مشکل - ریسک"},
        {"key": "effect", "title": "اثر"},
        {"key": "severity", "title": "شدت"},
        {"key": "probability", "title": "احتمال وقوع"},
        {"key": "unit_suggestion", "title": "پیشنهاد واحد"},
        {"key": "follow_up_responsible", "title": "مسئول پیگیری"},
    ],
    "corrective_actions": [
        {"key": "subject", "title": "موضوع"},
        {"key": "proposed_action", "title": "اقدام پیشنهادی"},
        {"key": "proposed_responsible", "title": "مسئول پیشنهادی"},
        {"key": "proposed_time", "title": "زمان پیشنهادی"},
        {"key": "required_resources", "title": "منابع مورد نیاز"},
        {"key": "status", "title": "وضعیت"},
    ],
    "next_plans": [
        {"key": "program", "title": "برنامه ی دوره بعد"},
        {"key": "priority", "title": "اولویت"},
        {"key": "expected_output", "title": "خروجی مورد انتظار"},
        {"key": "responsible", "title": "مسئول"},
        {"key": "timeline", "title": "زمان‌بندی"},
        {"key": "dependencies", "title": "وابستگی‌ها"},
        {"key": "possible_risk", "title": "ریسک احتمالی"},
    ],
    "management_decisions": [
        {"key": "decision_subject", "title": "موضوع تصمیم"},
        {"key": "description", "title": "شرح موضوع"},
        {"key": "unit_suggestion", "title": "پیشنهاد واحد"},
        {"key": "urgency", "title": "فوریت"},
        {"key": "no_decision_effect", "title": "اثر عدم تصمیم"},
        {"key": "decision_deadline", "title": "مهلت تصمیم"},
    ],
    "attachments": [
        {"key": "document_title", "title": "عنوان مستند"},
        {"key": "document_type", "title": "نوع مستند"},
        {"key": "date", "title": "تاریخ"},
        {"key": "owner", "title": "مالک مستند"},
        {"key": "storage_location", "title": "محل نگهداری"},
        {"key": "notes", "title": "توضیحات"},
    ],
    "manager_scoring": [
        {"key": "evaluation_axis", "title": "محور ارزیابی"},
        {"key": "score", "title": "امتیاز از ۱۰۰"},
        {"key": "explanation", "title": "توضیح"},
    ],
}

MANAGER_SCORING_DEFAULT_ROWS = [
    {"evaluation_axis": "برنامه‌ها تحقق", "score": "", "explanation": ""},
    {"evaluation_axis": "خروجی‌ها کیفیت", "score": "", "explanation": ""},
    {"evaluation_axis": "زمان‌بندی رعایت", "score": "", "explanation": ""},
    {"evaluation_axis": "ریسک‌ها مدیریت", "score": "", "explanation": ""},
    {"evaluation_axis": "بین‌واحدی همکاری", "score": "", "explanation": ""},
    {"evaluation_axis": "نهایی جمع‌بندی", "score": "", "explanation": ""},
]

GENERAL_SPECS_DEFAULT_ROWS = [
    {"title": "واحد سازمانی", "value": ""},
    {"title": "دوره گزارش", "value": ""},
    {"title": "بازه زمانی", "value": ""},
    {"title": "مدیر واحد", "value": ""},
]
