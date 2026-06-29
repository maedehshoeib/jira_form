import AppShell from "../../components/layout/AppShell";

import ReportSection from "../../components/reports/ReportSection";
import SummaryTable from "../../components/reports/SummaryTable";
import TextSection from "../../components/reports/TextSection";
import ReportTable from "../../components/reports/ReportTable";
import ReportHeader from "../../components/reports/ReportHeader";

export default function PerformanceReports() {
  const summary = [
    {
      label: "واحد سازمانی",
      value: "فناوری اطلاعات",
    },
    {
      label: "عنوان گزارش",
      value: "گزارش عملکرد شورای معاونین و مدیران",
    },
    {
      label: "ثبت کننده",
      value: "مائده شعیب",
    },
    {
      label: "تاریخ ثبت",
      value: "1405/04/08",
    },
    {
      label: "آخرین بروزرسانی",
      value: "1405/04/08",
    },
    {
      label: "وضعیت",
      value: "ثبت شده",
    },
  ];

  const goalsColumns = [
    {
      key: "goal",
      title: "هدف",
    },
    {
      key: "owner",
      title: "مسئول",
    },
    {
      key: "progress",
      title: "درصد پیشرفت",
    },
  ];

  const goalsRows = [
    {
      goal: "پیاده سازی سامانه",
      owner: "واحد فناوری",
      progress: "70%",
    },
    {
      goal: "بهبود زیرساخت",
      owner: "واحد شبکه",
      progress: "55%",
    },
  ];

  const actionsColumns = [
    {
      key: "title",
      title: "اقدام",
    },
    {
      key: "status",
      title: "وضعیت",
    },
    {
      key: "description",
      title: "توضیحات",
    },
  ];

  const actionsRows = [
    {
      title: "راه اندازی سرویس",
      status: "انجام شد",
      description: "بدون مشکل",
    },
    {
      title: "به روزرسانی تجهیزات",
      status: "در حال انجام",
      description: "50 درصد",
    },
  ];

  return (
    <AppShell>

      <div className="space-y-8">

        <div>

          <h1 className="text-3xl font-bold text-slate-800">
            گزارش عملکرد شورای معاونین و مدیران
          </h1>

          <p className="mt-2 text-slate-500">
            اطلاعات ثبت شده فرم ها در این قسمت نمایش داده می شود.
          </p>

        </div>
        <ReportHeader
    title="گزارش عملکرد شورای معاونین و مدیران"
    createdAt="1405/04/08"
    createdBy="مائده شعیب"
    status="ثبت شده"
/>

        <ReportSection title="مشخصات کلی گزارش">

          <SummaryTable items={summary} />

        </ReportSection>

        <ReportSection title="مهمترین دستاوردهای دوره">

          <TextSection
            title=""
            value="پیاده سازی نسخه جدید سامانه خدمات، افزایش سرعت پاسخگویی، بهبود فرآیندهای داخلی."
          />

        </ReportSection>

        <ReportSection title="مهمترین مشکلات و چالش ها">

          <TextSection
            title=""
            value="کمبود منابع انسانی، محدودیت بودجه و نیاز به ارتقاء زیرساخت."
          />

        </ReportSection>

        <ReportSection title="اهداف و برنامه های دوره">

          <ReportTable
            columns={goalsColumns}
            rows={goalsRows}
          />

        </ReportSection>

        <ReportSection title="اقدامات انجام شده">

          <ReportTable
            columns={actionsColumns}
            rows={actionsRows}
          />

        </ReportSection>

        <ReportSection title="شاخص های عملکرد">

          <ReportTable
            columns={[
              {
                key: "name",
                title: "شاخص",
              },
              {
                key: "value",
                title: "مقدار",
              },
            ]}
            rows={[
              {
                name: "درصد رضایت",
                value: "91%",
              },
              {
                name: "تعداد درخواست ها",
                value: "245",
              },
            ]}
          />

        </ReportSection>

        <ReportSection title="تحلیل عملکرد">

          <TextSection
            title=""
            value="عملکرد واحد در این دوره نسبت به دوره قبل بهبود قابل توجهی داشته است."
          />

        </ReportSection>

        <ReportSection title="ریسک ها و مشکلات">

          <TextSection
            title=""
            value="احتمال افزایش بار سامانه و کمبود منابع سخت افزاری."
          />

        </ReportSection>

        <ReportSection title="اقدامات اصلاحی">

          <TextSection
            title=""
            value="افزایش ظرفیت سرورها و بهینه سازی فرآیند پاسخگویی."
          />

        </ReportSection>

        <ReportSection title="برنامه های دوره بعد">

          <TextSection
            title=""
            value="تکمیل پروژه، توسعه داشبورد مدیریتی و اتصال کامل به Jira."
          />

        </ReportSection>

        <ReportSection title="تصمیمات مورد نیاز مدیریت">

          <TextSection
            title=""
            value="تخصیص بودجه برای ارتقاء زیرساخت و جذب نیروی متخصص."
          />

        </ReportSection>

      </div>

    </AppShell>
  );
}