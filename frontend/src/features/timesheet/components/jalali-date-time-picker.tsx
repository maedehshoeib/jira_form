import DatePicker, { DateObject, type Value } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

type JalaliDateTimePickerProps = {
  value: Value;
  onChange: (value: DateObject | DateObject[] | null) => void;
  placeholder: string;
  format?: string;
  disableDayPicker?: boolean;
};

export function JalaliDateTimePicker({
  value,
  onChange,
  placeholder,
  format = "YYYY/MM/DD HH:mm",
  disableDayPicker = false,
}: JalaliDateTimePickerProps): JSX.Element {
  return (
    <DatePicker
      value={value}
      onChange={(next) => onChange(next as DateObject | DateObject[] | null)}
      calendar={persian}
      locale={persianFa}
      format={format}
      disableDayPicker={disableDayPicker}
      inputClass="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
      containerClassName="w-full"
      placeholder={placeholder}
    />
  );
}


