import { ReactNode } from "react";

interface ReportSectionProps {
  title: string;
  children: ReactNode;
}

export default function ReportSection({
  title,
  children,
}: ReportSectionProps) {
  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">
          {title}
        </h2>

        <div className="h-px flex-1 bg-slate-200 mr-6"></div>
      </div>

      {children}
    </section>
  );
}