import { Textarea } from "../ui/textarea";

interface TextSectionProps {
  title: string;
  value: string;
  editable?: boolean;
  rows?: number;
}

export default function TextSection({
  title,
  value,
  editable = false,
  rows = 6,
}: TextSectionProps) {
  return (
    <div className="space-y-3">

      <h3 className="text-base font-semibold text-foreground">
        {title}
      </h3>

      {editable ? (
        <Textarea
          rows={rows}
          defaultValue={value}
          className="
            min-h-[140px]
            rounded-xl
            border-border
            focus:border-red-500
            focus:ring-red-500
          "
        />
      ) : (
        <div
          className="
            rounded-xl
            border
            border-border
            bg-muted/40
            p-5
            leading-8
            whitespace-pre-wrap
            text-foreground
          "
        >
          {value || "موردی ثبت نشده است."}
        </div>
      )}

    </div>
  );
}