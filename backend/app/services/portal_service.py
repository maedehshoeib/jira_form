from app.schemas.portal import Department, Section, FormTemplate, FormField, SelectOption

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

IT_SUPPORT_FIELDS = [
    FormField(name="subject", label="موضوع درخواست", type="text", required=True),
    FormField(name="product", label="محصول", type="text"),
    FormField(name="attachment", label="پیوست", type="file"),
    FormField(
        name="priority",
        label="اولویت درخواست",
        type="select",
        options=[
            SelectOption(label="کم", value="low"),
            SelectOption(label="متوسط", value="medium"),
            SelectOption(label="زیاد", value="high"),
        ],
    ),
    FormField(name="delivery_time", label="زمان تحویل", type="date"),
    FormField(name="description", label="توضیحات", type="textarea", required=True),
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
        Section(id="management-report", title="گزارش عملکرد شورای معاونین و مدیران", form_id="common-form"),
    ]),
]

FORM_TEMPLATES = {
    "common-form": FormTemplate(id="common-form", title="فرم عمومی درخواست", department_id="", section_id="", fields=COMMON_FIELDS),
    "software-support-form": FormTemplate(id="software-support-form", title="درخواست پشتیبانی نرم افزار", department_id="it", section_id="software-support", fields=IT_SUPPORT_FIELDS),
    "digital-marketing-form": FormTemplate(id="digital-marketing-form", title="درخواست دیجیتال مارکتینگ", department_id="business", section_id="digital-marketing", fields=DIGITAL_MARKETING_FIELDS),
    "business-form": FormTemplate(id="business-form", title="درخواست کسب و کار", department_id="business", section_id="business-projects", fields=BUSINESS_FIELDS),
    "hr-form": FormTemplate(id="hr-form", title="فرم منابع انسانی", department_id="hr", section_id="new-hire", fields=COMMON_FIELDS + [FormField(name="personnel_code", label="کد پرسنلی", type="text")]),
}