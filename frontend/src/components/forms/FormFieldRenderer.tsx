import { FormField } from '../../config/portal';
import { getTodayPersian, normalizePersianDate, PERSIAN_DATE_FORMAT } from '../../lib/persianDate';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import FormTableField from './FormTableField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

import DateObject from 'react-date-object';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';

type Props = {
  field: FormField;
  value: any;
  onChange: (name: string, value: any) => void;
  dateMin?: string;
  dateMax?: string;
  inputKey?: string | number;
};

function resolveDateConstraint(
  value: 'today' | string | undefined
): DateObject | undefined {
  if (!value) return undefined;
  if (value === 'today') {
    return new DateObject({
      date: getTodayPersian(),
      format: PERSIAN_DATE_FORMAT,
      calendar: persian,
      locale: persian_fa,
    });
  }
  try {
    return new DateObject({ date: value, calendar: persian });
  } catch {
    return undefined;
  }
}

export default function FormFieldRenderer({
  field,
  value,
  onChange,
  dateMin,
  dateMax,
  inputKey,
}: Props) {
  const commonClass =
    'h-12 rounded-xl border border-border bg-muted/40 text-right shadow-sm focus-visible:ring-2 focus-visible:ring-red-500';

  if (field.type === 'table') {
    const columns = field.columns ?? [];
    const defaultRows = field.default_rows ?? [];
    const rows = Array.isArray(value) && value.length > 0
      ? value
      : defaultRows.length > 0
        ? defaultRows.map((row) => ({ ...row }))
        : [];

    return (
      <FormTableField
        columns={columns}
        rows={rows}
        defaultRows={defaultRows}
        onChange={(nextRows) => onChange(field.name, nextRows)}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <Textarea
        className="
          min-h-[140px]
          rounded-xl
          border-border
          bg-muted/40
          text-right
          shadow-sm
          focus-visible:ring-2
          focus-visible:ring-red-500
        "
        placeholder={field.placeholder || field.label}
        value={value || ''}
        onChange={(e) =>
          onChange(field.name, e.target.value)
        }
      />
    );
  }

  if (field.type === 'select') {
    return (
      <Select
        value={value || ''}
        onValueChange={(val) =>
          onChange(field.name, val)
        }
      >
        <SelectTrigger
          className="h-12 w-full rounded-xl border-border bg-muted/40 text-right shadow-sm"
        >
          <SelectValue placeholder="انتخاب کنید" />
        </SelectTrigger>

        <SelectContent position="popper" sideOffset={4}>
          {field.options?.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'date') {
    const maxDate = resolveDateConstraint(dateMax ?? field.maxDate);
    const minDate = resolveDateConstraint(dateMin ?? field.minDate);

    return (
      <DatePicker
        key={inputKey ?? field.name}
        calendar={persian}
        locale={persian_fa}
        format={PERSIAN_DATE_FORMAT}
        value={value || undefined}
        maxDate={maxDate}
        minDate={minDate}
        onChange={(date) =>
          onChange(field.name, normalizePersianDate(date))
        }
        inputClass={`
          w-full
          h-12
          rounded-xl
          border
          border-border
          bg-muted/40
          px-4
          text-right
          shadow-sm
        `}
        calendarPosition="bottom-right"
        placeholder="انتخاب تاریخ"
      />
    );
  }

  if (field.type === 'file') {
    return (
      <div
        className="
          rounded-xl
          border-2
          border-dashed
          border-border
          bg-muted/40
          p-4
        "
      >
        <Input
          type="file"
          className="
            border-0
            bg-transparent
            shadow-none
            file:ml-3
            file:rounded-lg
            file:border-0
            file:bg-primary/10
            file:px-4
            file:py-2
            file:text-primary
            file:font-medium
          "
          onChange={(e) =>
            onChange(
              field.name,
              e.target.files?.[0] || null
            )
          }
        />
      </div>
    );
  }

  return (
    <Input
      type={field.type}
      required={field.required}
      className={commonClass}
      placeholder={field.placeholder || field.label}
      value={value || ''}
      onChange={(e) =>
        onChange(field.name, e.target.value)
      }
    />
  );
}
