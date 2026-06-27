import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { API_BASE, Department } from '../config/portal';
import { Card, CardContent } from '../components/ui/card';

export default function DepartmentPage() {
  const { departmentId } = useParams();
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    if (!departmentId) return;

    fetch(`${API_BASE}/departments/${departmentId}`)
      .then((res) => res.json())
      .then(setDepartment);
  }, [departmentId]);

  if (!department)
    return <AppShell>در حال بارگذاری...</AppShell>;

  return (
    <AppShell>
      <div className="mb-10 flex items-center justify-between">
        <Link
          to="/"
          className="font-medium text-red-600 hover:text-red-700"
        >
          بازگشت
        </Link>

        <h2 className="text-3xl font-bold">
          {department.title}
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {department.sections.map((s) => (
          <Link key={s.id} to={`/forms/${s.form_id}`}>
            <Card
              className="
                h-full
                cursor-pointer
                border-0
                rounded-3xl
                bg-white/95
                shadow-md
                transition-all
                duration-300
                hover:-translate-y-2
                hover:shadow-xl
                hover:shadow-red-100
              "
            >
              <CardContent className="p-8 text-right">
                <h3 className="text-xl font-bold text-slate-800">
                  {s.title}
                </h3>

                <p className="mt-3 text-sm text-red-500">
                  ورود به فرم
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}