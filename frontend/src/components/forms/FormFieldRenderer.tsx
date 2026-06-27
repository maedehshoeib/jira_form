import { FormField } from '../../config/portal';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';

type Props = {
  field: FormField;
  value: any;
  onChange: (name: string, value: any) => void;
};

export default function FormFieldRenderer({
  field,
  value,
  onChange,
}: Props) {
  const commonClass =
    'h-12 rounded-xl border border-slate-200 bg-slate-50 text-right shadow-sm focus-visible:ring-2 focus-visible:ring-red-500';

  if (field.type === 'textarea') {
    return (
      <Textarea
        className="
          min-h-[140px]
          rounded-xl
          border-slate-200
          bg-slate-50
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
          className="
            h-12
            rounded-xl
            border-slate-200
            bg-slate-50
            text-right
            shadow-sm
          "
        >
          <SelectValue placeholder="انتخاب کنید" />
        </SelectTrigger>

        <SelectContent>
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
    return (
      <DatePicker
        calendar={persian}
        locale={persian_fa}
        value={value}
        onChange={(date) =>
          onChange(
            field.name,
            date?.format?.('YYYY/MM/DD') ?? ''
          )
        }
        inputClass={`
          w-full
          h-12
          rounded-xl
          border
          border-slate-200
          bg-slate-50
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
          border-slate-300
          bg-slate-50
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
            file:bg-red-50
            file:px-4
            file:py-2
            file:text-red-600
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
      className={commonClass}
      placeholder={field.placeholder || field.label}
      value={value || ''}
      onChange={(e) =>
        onChange(field.name, e.target.value)
      }
    />
  );
}