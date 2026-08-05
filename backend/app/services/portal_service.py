from app.schemas.portal import Department, Section, FormTemplate, FormField, SelectOption, TableColumn
from app.services.performance_report_schema import (
    PERFORMANCE_TABLE_COLUMNS,
    MANAGER_SCORING_DEFAULT_ROWS,
    GENERAL_SPECS_DEFAULT_ROWS,
)

COMMON_FIELDS = [
    FormField(name="subject", label="موضوع درخواست", type="text", required=True),
    FormField(name="description", label="توضیحات", type="textarea", required=True),
    FormField(name="attachment", label="پیوست", type="file", required=False),
]

DIGITAL_MARKETING_FIELDS = [
    FormField(name="row", label="ردیف", type="text", required=False),
    FormField(name="date", label="تاریخ", type="date", required=False),
    FormField(name="department", label="دپارتمان", type="text", required=False),
    FormField(name="company_name", label="نام شرکت / کسب‌وکار / اتحادیه", type="text", required=True),
    FormField(
        name="activity_type",
        label="نوع فعالیت",
        type="select",
        required=False,
        options=[
            SelectOption(label="طراحی بنر", value="banner_design"),
            SelectOption(label="تولید محتوا", value="content"),
            SelectOption(label="تولید محتوا استانی", value="provincial_content"),
            SelectOption(label="تولید محتوا سایت", value="site_content"),
            SelectOption(label="تولید محتوا مقاله", value="article_content"),
            SelectOption(label="تبلیغات", value="advertising"),
            SelectOption(label="معرفی خدمات", value="service_intro"),
            SelectOption(label="معرفی کانال ها", value="channel_intro"),
            SelectOption(label="باز نشر محتوا", value="republish"),
            SelectOption(label="معرفی کانال به واحد دیجیتال", value="channel_to_digital"),
            SelectOption(label="شناسایی و عضویت در کانال ها", value="channel_membership"),
            SelectOption(label="پیگیری امور وثوق یاران", value="followup"),
            SelectOption(label="آموزش", value="training"),
            SelectOption(label="بولتن خبری", value="news_bulletin"),
            SelectOption(label="تنظیم گزارش", value="report"),
            SelectOption(label="عکاسی", value="photography"),
            SelectOption(label="فیلمبرداری", value="videography"),
            SelectOption(label="سناریو نویسی", value="scriptwriting"),
        ],
    ),
    FormField(
        name="project_relation",
        label="نوع ارتباط - پروژه",
        type="select",
        options=[
            SelectOption(label="سایت", value="site"),
            SelectOption(label="شبکه های اجتماعی", value="social"),
            SelectOption(label="ایمیل", value="email"),
            SelectOption(label="آفلاین- چاپی", value="offline_print"),
            SelectOption(label="موارد متفرقه", value="other"),
        ],
    ),
    FormField(
        name="social_network",
        label="نوع شبکه اجتماعی",
        type="select",
        options=[
            SelectOption(label="بله", value="yes"),
            SelectOption(label="ایتا", value="eitaa"),
            SelectOption(label="روبیکا", value="rubika"),
            SelectOption(label="آپارات", value="aparat"),
            SelectOption(label="تلگرام", value="telegram"),
            SelectOption(label="واتساپ", value="whatsapp"),
            SelectOption(label="اینستاگرام", value="instagram"),
            SelectOption(label="لینکدین", value="linkedin"),
        ],
    ),
]

BUSINESS_FIELDS = [
    FormField(name="project_name", label="نام پروژه", type="text", required=True),
    FormField(name="customer_type", label="نوع مشتری", type="text"),
    FormField(name="activity_scope", label="حوزه ی فعالیت", type="text"),
    FormField(name="communication_channel", label="کانال ارتباطی", type="text"),
    FormField(name="meeting_number", label="شماره جلسه", type="text"),
    FormField(name="meeting_agreements", label="توافقات جلسه", type="textarea"),
    FormField(name="tracking_number", label="شماره پیگیری", type="text"),
    FormField(name="followup_date", label="تاریخ پیگیری", type="date"),
    FormField(name="contract_status", label="وضعیت قرارداد", type="text"),
    FormField(name="contract_date", label="تاریخ قرارداد", type="date"),
    FormField(name="description", label="توضیحات", type="textarea"),
    FormField(name="project_manager", label="مدیر پروژه", type="text"),
    FormField(name="executor", label="مجری پروژه", type="text"),
    FormField(name="approver", label="تایید کننده پروژه", type="text"),
    FormField(name="contact_name", label="نام رابط", type="text"),
    FormField(name="position", label="سمت", type="text"),
    FormField(name="phone", label="شماره تماس", type="text"),
    FormField(name="email", label="ایمیل", type="email"),
    FormField(name="attachment", label="پیوست", type="file"),
]

PERFORMANCE_REPORT_FIELDS = [
    FormField(
        name="general_specs",
        label="مشخصات کلی گزارش",
        type="table",
        section="مشخصات کلی گزارش",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["general_specs"]],
        default_rows=GENERAL_SPECS_DEFAULT_ROWS,
    ),
    FormField(
        name="achievements",
        label="مهم‌ترین دستاوردهای دوره",
        type="textarea",
        section="خلاصه مدیریتی",
        required=True,
    ),
    FormField(
        name="problems_risks_summary",
        label="مهم‌ترین مشکلات و ریسک‌ها",
        type="textarea",
        section="خلاصه مدیریتی",
        required=False,
    ),
    FormField(
        name="management_decisions_summary",
        label="مهم‌ترین تصمیمات مورد نیاز از مدیریت",
        type="textarea",
        section="خلاصه مدیریتی",
        required=False,
    ),
    FormField(
        name="next_period_key_programs",
        label="برنامه‌های کلیدی دوره بعد",
        type="textarea",
        section="خلاصه مدیریتی",
        required=False,
    ),
    FormField(
        name="goals",
        label="اهداف و برنامه‌های دوره",
        type="table",
        section="اهداف و برنامه‌های دوره",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["goals"]],
    ),
    FormField(
        name="actions",
        label="اقدامات انجام شده",
        type="table",
        section="اقدامات انجام شده",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["actions"]],
    ),
    FormField(
        name="metrics",
        label="شاخص‌های عملکردی واحد",
        type="table",
        section="شاخص‌های عملکردی واحد",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["metrics"]],
    ),
    FormField(
        name="analysis",
        label="تحلیل عملکرد",
        type="table",
        section="تحلیل عملکرد",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["analysis"]],
    ),
    FormField(
        name="risks",
        label="مشکلات، موانع و ریسک‌ها",
        type="table",
        section="مشکلات، موانع و ریسک‌ها",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["risks"]],
    ),
    FormField(
        name="corrective_actions",
        label="اقدامات اصلاحی و پیشنهادی",
        type="table",
        section="اقدامات اصلاحی و پیشنهادی",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["corrective_actions"]],
    ),
    FormField(
        name="next_plans",
        label="برنامه دوره بعد",
        type="table",
        section="برنامه دوره بعد",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["next_plans"]],
    ),
    FormField(
        name="management_decisions",
        label="تصمیمات مورد نیاز از مدیریت",
        type="table",
        section="تصمیمات مورد نیاز از مدیریت",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["management_decisions"]],
    ),
    FormField(
        name="attachments",
        label="پیوست‌ها و مستندات",
        type="table",
        section="پیوست‌ها و مستندات",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["attachments"]],
    ),
    FormField(
        name="manager_scoring",
        label="فرم امتیازدهی و جمع‌بندی مدیر واحد",
        type="table",
        section="فرم امتیازدهی و جمع‌بندی مدیر واحد",
        columns=[TableColumn(**col) for col in PERFORMANCE_TABLE_COLUMNS["manager_scoring"]],
        default_rows=MANAGER_SCORING_DEFAULT_ROWS,
    ),
]

SOFTWARE_SUPPORT_REQUEST_TYPES = [
    "\u0628\u0627\u06af",
    "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc",
    "\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc",
    "\u06af\u0632\u0627\u0631\u0634",
    "\u062e\u0637\u0627",
    "\u062a\u0648\u0633\u0639\u0647",
]

ORGANIZATION_PROJECTS = [
    "\u062f\u0631\u0648\u0646 \u062a\u06cc\u0645\u06cc \u0646\u0631\u0645 \u0627\u0641\u0632\u0627\u0631",
    "Accounter (ACCOUNTER \u0648\u062b\u0648\u0642)",
    "AndroidPOS (\u0648\u062b\u0648\u0642 \u067e\u0648\u0632 \u0627\u0646\u062f\u0648\u0631\u06cc\u062f)",
    "APISupplier (API-SUPPLIER \u0648\u062b\u0648\u0642)",
    "BI",
    "Consulting (\u0648\u062b\u0648\u0642 \u0645\u0634\u0627\u0648\u0631\u0647)",
    "CRM",
    "Education (\u0648\u062b\u0648\u0642 \u0622\u0645\u0648\u0632\u0634)",
    "Finance (FINANCE \u0648\u062b\u0648\u0642)",
    "INFRA-Infrastructure (\u0648\u062b\u0648\u0642 \u0632\u06cc\u0631\u0633\u0627\u062e\u062a)",
    "Khadem (\u0648\u062b\u0648\u0642 \u062e\u0627\u062f\u0645)",
    "LinuxPOS (\u0648\u062b\u0648\u0642 \u067e\u0648\u0632 \u0644\u06cc\u0646\u0648\u06a9\u0633)",
    "MP",
    "\u0648\u062b\u0648\u0642 \u0645\u0646",
    "PWAVosouq (PWA \u0648\u062b\u0648\u0642)",
    "Redesigning security processes (\u0628\u0627\u0632 \u0637\u0631\u0627\u062d\u06cc \u0641\u0631\u0622\u06cc\u0646\u062f\u0647\u0627\u06cc \u0627\u0645\u0646\u06cc\u062a)",
    "Sandbox (ESB \u0648\u062b\u0648\u0642)",
    "SUPPORT-Cloud (CLOUD \u0648\u062b\u0648\u0642)",
    "\u0633\u0648\u0626\u06cc\u0686 \u0648\u062b\u0648\u0642 1",
    "\u0633\u0648\u0626\u06cc\u0686 \u0648\u062b\u0648\u0642 2",
    "USSD (USSD \u0648\u062b\u0648\u0642)",
    "VASServices (VAS \u0648\u062b\u0648\u0642 \u062e\u062f\u0645\u0627\u062a)",
    "VASSwitch (VAS-SW \u0648\u062b\u0648\u0642)",
    "\u0648\u062b\u0648\u0642 \u0647\u0645\u0631\u0627\u0647",
    "\u0648\u0628\u0633\u0627\u06cc\u062a \u0648\u062b\u0648\u0642",
    "PMO",
    "\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0628\u0627\u0646\u06a9",
    "\u067e\u0648\u0631\u062a\u0627\u0644",
    "\u0633\u0627\u0645\u0627\u0646\u0647 \u062c\u0627\u0645\u0639 \u062e\u062f\u0645\u0627\u062a",
]

IT_SUPPORT_FIELDS = [
    FormField(
        name="request_type",
        label="\u0646\u0648\u0639 \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u062b\u0628\u062a \u0634\u062f\u0647",
        type="select",
        required=True,
        options=[
            SelectOption(label=option, value=option)
            for option in SOFTWARE_SUPPORT_REQUEST_TYPES
        ],
    ),
    FormField(
        name="organization_project",
        label="\u067e\u0631\u0648\u0698\u0647 \u0647\u0627\u06cc \u0633\u0627\u0632\u0645\u0627\u0646",
        type="select",
        required=True,
        options=[
            SelectOption(label=option, value=option)
            for option in ORGANIZATION_PROJECTS
        ],
    ),
    FormField(name="subject", label="موضوع درخواست", type="text", required=True),
    FormField(name="product", label="محصول", type="text"),
    FormField(name="attachment", label="پیوست", type="file"),
    FormField(
        name="priority",
        label="اولویت درخواست",
        type="select",
        options=[
            SelectOption(label="خیلی کم", value="very_low"),
            SelectOption(label="کم", value="low"),
            SelectOption(label="متوسط", value="medium"),
            SelectOption(label="زیاد", value="high"),
            SelectOption(label="خیلی زیاد", value="very_high"),
        ],
    ),
    FormField(name="delivery_time", label="زمان تحویل", type="date"),
    FormField(name="description", label="توضیحات", type="textarea", required=True),
]

SOFTWARE_DEVELOPMENT_FIELDS = [
    FormField(name="subject", label="\u0645\u0648\u0636\u0648\u0639 \u062f\u0631\u062e\u0648\u0627\u0633\u062a", type="text", required=True),
    FormField(name="attachment", label="\u067e\u06cc\u0648\u0633\u062a", type="file"),
    FormField(name="description", label="\u0634\u0631\u062d \u062f\u0631\u062e\u0648\u0627\u0633\u062a", type="textarea", required=True),
]

DEPARTMENTS = [
    Department(id="it", title="معاونت فناوری اطلاعات", sections=[
        Section(id="it-support", title="پشتیبانی فنی", form_id="common-form"),
        Section(id="software-support", title="پشتیبانی نرم افزار", form_id="software-support-form"),
    ]),
    Department(id="business", title="معاونت کسب و کار", sections=[
        Section(id="digital-marketing", title="دیجیتال مارکتینگ", form_id="digital-marketing-form"),
        Section(id="business-projects", title="پروژه های کسب و کار", form_id="business-form"),
    ]),
    Department(id="planning", title="مدیریت طرح و توسعه", sections=[
        Section(id="market-review", title="درخواست بررسی بازار مشتری", form_id="common-form"),
        Section(id="regulation", title="درخواست آیین نامه/دستورالعمل", form_id="common-form"),
        Section(id="plan-request", title="درخواست طرح", form_id="common-form"),
        Section(id="process-review", title="درخواست فرآیند/بازبینی فرآیند", form_id="common-form"),
        Section(id="jira-access", title="درخواست دسترسی جیرا", form_id="common-form"),
        Section(id="jira-services", title="درخواست خدمات جیرا", form_id="common-form"),
        Section(id="jira-support", title="درخواست های پشتیبانی جیرا", form_id="common-form"),
    ]),
    Department(id="hr", title="منابع انسانی", sections=[
        Section(id="new-hire", title="استخدام نیروی جدید", form_id="hr-form"),
        Section(id="exit-process", title="فرآیند خروج", form_id="hr-form"),
        Section(id="supplementary-insurance", title="بیمه تکمیلی", form_id="hr-form"),
        Section(id="employment-certificate", title="گواهی اشتغال به کار", form_id="hr-form"),
        Section(id="training-request", title="درخواست آموزش", form_id="hr-form"),
    ]),
    Department(id="finance", title="مالی", sections=[
        Section(id="purchase-request", title="درخواست خرید", form_id="common-form"),
        Section(id="collection-report", title="گزارش درخواست وصولی", form_id="common-form"),
        Section(id="advance-request", title="درخواست مساعده", form_id="common-form"),
        Section(id="warehouse-request", title="درخواست کالا از انبار", form_id="common-form"),
        Section(id="special-request", title="درخواست ویژه", form_id="common-form"),
        Section(id="salary-slip-cert", title="گواهی تایید فیش حقوقی", form_id="common-form"),
        Section(id="petty-cash", title="درخواست تنخواه", form_id="common-form"),
    ]),
    Department(id="contracts", title="امور قراردادها", sections=[
        Section(id="contract-match", title="استعلام تطبیق قرارداد", form_id="common-form"),
        Section(id="new-contract", title="ایجاد قرارداد جدید(هزینه ای-درآمدی)", form_id="common-form"),
        Section(id="contract-approve", title="تایید قرارداد تیپ", form_id="common-form"),
        Section(id="contract-edit", title="ویرایش قرارداد", form_id="common-form"),
    ]),
    Department(id="bank", title="بانک", sections=[
        Section(id="bank-request", title="درخواست بانک", form_id="common-form"),
    ]),
    Department(id="reports", title="گزارشات", sections=[
        Section(
            id="management-report",
            title="گزارش عملکرد شورای معاونین و مدیران",
            form_id="performance-report-form",
        ),
    ]),
    Department(id="contract-archive", title="ارشیو قراردادها", sections=[]),
    Department(id="management-workflow", title="گردش کار مدیریت", sections=[]),
]

DEPARTMENTS[0].sections.append(
    Section(
        id="software-development",
        title="\u062a\u0648\u0633\u0639\u0647 \u0646\u0631\u0645 \u0627\u0641\u0632\u0627\u0631",
        form_id="software-development-form",
    )
)

MANAGEMENT_WORKFLOW_ID = "management-workflow"
MANAGEMENT_LETTER_SECTION = "send-letter"
MANAGEMENT_LETTER_FORM_ID = "management-letter-form"

FORM_TEMPLATES = {
    "software-development-form": FormTemplate(
        id="software-development-form",
        title="\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u062a\u0648\u0633\u0639\u0647 \u0646\u0631\u0645 \u0627\u0641\u0632\u0627\u0631",
        department_id="it",
        section_id="software-development",
        fields=SOFTWARE_DEVELOPMENT_FIELDS,
    ),
    MANAGEMENT_LETTER_FORM_ID: FormTemplate(
        id=MANAGEMENT_LETTER_FORM_ID,
        title="ارسال نامه",
        department_id=MANAGEMENT_WORKFLOW_ID,
        section_id=MANAGEMENT_LETTER_SECTION,
        fields=COMMON_FIELDS,
    ),
    "common-form": FormTemplate(id="common-form", title="فرم عمومی درخواست", department_id="", section_id="", fields=COMMON_FIELDS),
    "software-support-form": FormTemplate(id="software-support-form", title="درخواست پشتیبانی نرم افزار", department_id="it", section_id="software-support", fields=IT_SUPPORT_FIELDS),
    "digital-marketing-form": FormTemplate(id="digital-marketing-form", title="درخواست دیجیتال مارکتینگ", department_id="business", section_id="digital-marketing", fields=DIGITAL_MARKETING_FIELDS),
    "business-form": FormTemplate(id="business-form", title="درخواست کسب و کار", department_id="business", section_id="business-projects", fields=BUSINESS_FIELDS),
    "hr-form": FormTemplate(id="hr-form", title="فرم منابع انسانی", department_id="hr", section_id="new-hire", fields=COMMON_FIELDS + [FormField(name="personnel_code", label="کد پرسنلی", type="text")]),
    "performance-report-form": FormTemplate(
        id="performance-report-form",
        title="گزارش عملکرد شورای معاونین و مدیران",
        department_id="reports",
        section_id="management-report",
        fields=PERFORMANCE_REPORT_FIELDS,
    ),
}