import {
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  GitBranch,
  Loader2,
  Save,
  Search,
  X,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import UserAvatar from "../../components/UserAvatar";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  DutyEdgeInput,
  edgeKey,
  fetchFormDuties,
  fetchFormDutyCatalog,
  FormDutyCatalogTarget,
  formTargetKey,
  saveFormDuties,
} from "../../features/admin/formDuties";

type ManagedUser = {
  id: number;
  username: string;
  display_name: string;
  department: string;
  job_title: string;
  avatar_url: string;
  is_active: boolean;
  is_admin: boolean;
};

type LocalEdge = DutyEdgeInput;

type DragState =
  | {
      from: "form" | "user";
      formKey: string;
      userId: number | null;
      x: number;
      y: number;
    }
  | null;

type Point = { x: number; y: number };

const bezierPath = (from: Point, to: Point) => {
  const mid = Math.max(40, Math.abs(to.x - from.x) * 0.5);
  const direction = to.x >= from.x ? 1 : -1;
  const c1x = from.x + direction * mid;
  const c2x = to.x - direction * mid;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
};

export default function AdminDutiesPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const formHandleRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userHandleRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const [catalog, setCatalog] = useState<FormDutyCatalogTarget[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [edges, setEdges] = useState<LocalEdge[]>([]);
  const [savedEdges, setSavedEdges] = useState<LocalEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [formQuery, setFormQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [drag, setDrag] = useState<DragState>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalogData, dutiesData, usersRes] = await Promise.all([
        fetchFormDutyCatalog(),
        fetchFormDuties(),
        client.get<ManagedUser[]>(endpoints.adminUsers),
      ]);
      setCatalog(catalogData);
      const nextEdges = dutiesData.assignments.map((edge) => ({
        user_id: edge.user_id,
        target_key: edge.target_key,
      }));
      setEdges(nextEdges);
      setSavedEdges(nextEdges);
      setUsers(usersRes.data.filter((user) => user.is_active && !user.is_admin));
    } catch {
      setError("دریافت اطلاعات مسیریابی وظایف با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onResize = () => setLayoutTick((tick) => tick + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const dirty = useMemo(() => {
    const normalize = (list: LocalEdge[]) =>
      [...list]
        .map((edge) => edgeKey(edge.user_id, edge.target_key))
        .sort()
        .join("|");
    return normalize(edges) !== normalize(savedEdges);
  }, [edges, savedEdges]);

  const filteredCatalog = useMemo(() => {
    const q = formQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((target) => {
      const hay = [
        target.portal_department_title,
        target.section_title,
        target.form_id,
        target.portal_department_id,
        target.section_id,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, formQuery]);

  const groupedForms = useMemo(() => {
    const groups = new Map<string, FormDutyCatalogTarget[]>();
    for (const target of filteredCatalog) {
      const key = target.portal_department_title || target.portal_department_id;
      const list = groups.get(key) ?? [];
      list.push(target);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [filteredCatalog]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const hay = [
        user.display_name,
        user.username,
        user.department,
        user.job_title,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, userQuery]);

  const canvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleCenter = useCallback(
    (el: HTMLElement | null | undefined): Point | null => {
      if (!el || !canvasRef.current) return null;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - canvasRect.left + rect.width / 2,
        y: rect.top - canvasRect.top + rect.height / 2,
      };
    },
    [],
  );

  const addEdge = useCallback((userId: number, targetKey: string) => {
    setEdges((prev) => {
      if (prev.some((edge) => edge.user_id === userId && edge.target_key === targetKey)) {
        return prev;
      }
      return [...prev, { user_id: userId, target_key: targetKey }];
    });
    setSaved(false);
    setSelectedEdge(edgeKey(userId, targetKey));
  }, []);

  const removeEdge = useCallback((userId: number, targetKey: string) => {
    setEdges((prev) =>
      prev.filter((edge) => !(edge.user_id === userId && edge.target_key === targetKey)),
    );
    setSelectedEdge((current) =>
      current === edgeKey(userId, targetKey) ? null : current,
    );
    setSaved(false);
  }, []);

  const beginDragFromForm = (
    event: PointerEvent<HTMLButtonElement>,
    targetKey: string,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event.clientX, event.clientY);
    setDrag({
      from: "form",
      formKey: targetKey,
      userId: null,
      x: point.x,
      y: point.y,
    });
    setSelectedEdge(null);
  };

  const beginDragFromUser = (
    event: PointerEvent<HTMLButtonElement>,
    userId: number,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event.clientX, event.clientY);
    setDrag({
      from: "user",
      formKey: "",
      userId,
      x: point.x,
      y: point.y,
    });
    setSelectedEdge(null);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const point = canvasPoint(event.clientX, event.clientY);
    setDrag({ ...drag, x: point.x, y: point.y });
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const target = document.elementFromPoint(event.clientX, event.clientY) as
      | HTMLElement
      | null;
    const formKey = target?.closest<HTMLElement>("[data-form-key]")?.dataset.formKey;
    const userIdRaw = target?.closest<HTMLElement>("[data-user-id]")?.dataset.userId;
    const userId = userIdRaw ? Number(userIdRaw) : null;

    if (drag.from === "form" && userId) {
      addEdge(userId, drag.formKey);
    } else if (drag.from === "user" && formKey && drag.userId != null) {
      addEdge(drag.userId, formKey);
    }
    setDrag(null);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    finishDrag(event);
  };

  const onPointerCancel = () => setDrag(null);

  const edgeGeometry = useMemo(() => {
    void layoutTick;
    return edges
      .map((edge) => {
        const from = handleCenter(formHandleRefs.current.get(edge.target_key));
        const to = handleCenter(userHandleRefs.current.get(edge.user_id));
        if (!from || !to) return null;
        return {
          key: edgeKey(edge.user_id, edge.target_key),
          userId: edge.user_id,
          targetKey: edge.target_key,
          from,
          to,
          path: bezierPath(from, to),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [edges, handleCenter, layoutTick, filteredCatalog, filteredUsers]);

  useEffect(() => {
    // Recalculate after DOM settles from filters / data load
    const id = window.requestAnimationFrame(() => setLayoutTick((tick) => tick + 1));
    return () => window.cancelAnimationFrame(id);
  }, [filteredCatalog, filteredUsers, edges, loading]);

  const dragPreview = useMemo(() => {
    if (!drag) return null;
    if (drag.from === "form") {
      const from = handleCenter(formHandleRefs.current.get(drag.formKey));
      if (!from) return null;
      return bezierPath(from, { x: drag.x, y: drag.y });
    }
    if (drag.userId == null) return null;
    const from = handleCenter(userHandleRefs.current.get(drag.userId));
    if (!from) return null;
    return bezierPath(from, { x: drag.x, y: drag.y });
  }, [drag, handleCenter]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await saveFormDuties(edges);
      const nextEdges = data.assignments.map((edge) => ({
        user_id: edge.user_id,
        target_key: edge.target_key,
      }));
      setEdges(nextEdges);
      setSavedEdges(nextEdges);
      setSaved(true);
    } catch {
      setError("ذخیره مسیریابی وظایف انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  const connectedFormCount = useMemo(
    () => new Set(edges.map((edge) => edge.target_key)).size,
    [edges],
  );
  const connectedUserCount = useMemo(
    () => new Set(edges.map((edge) => edge.user_id)).size,
    [edges],
  );

  return (
    <AppShell>
      <div className="space-y-5" dir="rtl">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              <GitBranch className="h-3.5 w-3.5" />
              مدیریت سامانه
            </div>
            <h1 className="text-2xl font-bold text-slate-900">مسیریابی وظایف</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              در سمت راست کارمند را انتخاب کنید و از سمت چپ فرم‌ها را با کشیدن
              فلش به او متصل کنید. هر کارمند متصل، درخواست‌های همان فرم را در
              «وظایف من» می‌بیند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
              {edges.length.toLocaleString("fa-IR")} اتصال ·{" "}
              {connectedFormCount.toLocaleString("fa-IR")} فرم ·{" "}
              {connectedUserCount.toLocaleString("fa-IR")} نفر
            </div>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || !dirty}
              className="min-w-28"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              ذخیره
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {saved && !dirty ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            مسیریابی وظایف ذخیره شد.
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[28rem] items-center justify-center rounded-[1.75rem] border border-white/70 bg-white/70">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="relative grid min-h-[36rem] gap-4 overflow-hidden rounded-[1.75rem] border border-white/70 bg-[linear-gradient(160deg,#fff_0%,#f8fafc_45%,#fff1f2_100%)] p-4 shadow-sm lg:grid-cols-[1fr_1.15fr_1fr]"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            {/* Users column — visual LEFT in RTL = employees (plan: right side choose employee;
                with RTL dir, first column is right. Plan says right=employee, left=forms.
                In RTL first grid column appears on the right. So: col1=users, col3=forms. */}
            <section className="relative z-10 flex min-h-0 flex-col rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-sm font-semibold text-slate-900">کارکنان</h2>
                <p className="mt-1 text-xs text-slate-500">
                  دستگیره را بکشید و روی یک فرم رها کنید
                </p>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    placeholder="جستجوی کارمند..."
                    className="pr-9"
                  />
                </div>
              </div>
              <div
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
                onScroll={() => setLayoutTick((tick) => tick + 1)}
              >
                {filteredUsers.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-500">
                    کارمندی یافت نشد.
                  </p>
                ) : (
                  filteredUsers.map((user) => {
                    const linkCount = edges.filter(
                      (edge) => edge.user_id === user.id,
                    ).length;
                    return (
                      <div
                        key={user.id}
                        data-user-id={user.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <UserAvatar
                          name={user.display_name || user.username}
                          avatarUrl={user.avatar_url}
                          className="h-9 w-9 rounded-xl"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {user.display_name || user.username}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {user.job_title || user.department || user.username}
                          </p>
                        </div>
                        {linkCount > 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            {linkCount.toLocaleString("fa-IR")}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          data-user-id={user.id}
                          ref={(el) => {
                            if (el) userHandleRefs.current.set(user.id, el);
                            else userHandleRefs.current.delete(user.id);
                          }}
                          onPointerDown={(event) => beginDragFromUser(event, user.id)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-red-500 bg-red-50 text-red-600 transition hover:bg-red-100"
                          title="کشیدن برای اتصال"
                          aria-label={`اتصال وظایف برای ${user.display_name || user.username}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="relative z-0 hidden items-center justify-center lg:flex">
              <div className="rounded-full border border-dashed border-slate-300 bg-white/70 px-4 py-2 text-xs text-slate-500">
                فلش را بین فرم و کارمند بکشید
              </div>
            </section>

            <section className="relative z-10 flex min-h-0 flex-col rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-sm font-semibold text-slate-900">فرم‌ها</h2>
                <p className="mt-1 text-xs text-slate-500">
                  دستگیره را بکشید و روی یک کارمند رها کنید
                </p>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={formQuery}
                    onChange={(event) => setFormQuery(event.target.value)}
                    placeholder="جستجوی فرم..."
                    className="pr-9"
                  />
                </div>
              </div>
              <div
                className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
                onScroll={() => setLayoutTick((tick) => tick + 1)}
              >
                {groupedForms.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-500">
                    فرمی یافت نشد.
                  </p>
                ) : (
                  groupedForms.map(([departmentTitle, targets]) => (
                    <div key={departmentTitle} className="space-y-2">
                      <p className="px-1 text-xs font-semibold text-slate-500">
                        {departmentTitle}
                      </p>
                      {targets.map((target) => {
                        const key = formTargetKey(target);
                        const linkCount = edges.filter(
                          (edge) => edge.target_key === key,
                        ).length;
                        return (
                          <div
                            key={key}
                            data-form-key={key}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                          >
                            <button
                              type="button"
                              data-form-key={key}
                              ref={(el) => {
                                if (el) formHandleRefs.current.set(key, el);
                                else formHandleRefs.current.delete(key);
                              }}
                              onPointerDown={(event) => beginDragFromForm(event, key)}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-500 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                              title="کشیدن برای اتصال"
                              aria-label={`اتصال فرم ${target.section_title}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {target.section_title}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {target.portal_department_title}
                              </p>
                            </div>
                            {linkCount > 0 ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {linkCount.toLocaleString("fa-IR")}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </section>

            <svg
              className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
              aria-hidden
            >
              <defs>
                <marker
                  id="duty-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
                </marker>
              </defs>
              {edgeGeometry.map((edge) => {
                const active = selectedEdge === edge.key;
                return (
                  <g key={edge.key} className="pointer-events-auto">
                    <path
                      d={edge.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedEdge((current) =>
                          current === edge.key ? null : edge.key,
                        )
                      }
                    />
                    <path
                      d={edge.path}
                      fill="none"
                      stroke={active ? "#b91c1c" : "#dc2626"}
                      strokeWidth={active ? 2.5 : 1.75}
                      strokeOpacity={active ? 1 : 0.75}
                      markerEnd="url(#duty-arrow)"
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedEdge((current) =>
                          current === edge.key ? null : edge.key,
                        )
                      }
                    />
                    {active ? (
                      <foreignObject
                        x={(edge.from.x + edge.to.x) / 2 - 14}
                        y={(edge.from.y + edge.to.y) / 2 - 14}
                        width={28}
                        height={28}
                      >
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow"
                          onClick={() => removeEdge(edge.userId, edge.targetKey)}
                          title="حذف اتصال"
                          aria-label="حذف اتصال"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </foreignObject>
                    ) : null}
                  </g>
                );
              })}
              {dragPreview ? (
                <path
                  d={dragPreview}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  markerEnd="url(#duty-arrow)"
                />
              ) : null}
            </svg>
          </div>
        )}

        {!loading && edges.length > 0 ? (
          <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">اتصالات فعلی</h2>
            <div className="flex flex-wrap gap-2">
              {edges.map((edge) => {
                const user = users.find((item) => item.id === edge.user_id);
                const form = catalog.find(
                  (target) => formTargetKey(target) === edge.target_key,
                );
                return (
                  <button
                    key={edgeKey(edge.user_id, edge.target_key)}
                    type="button"
                    onClick={() => removeEdge(edge.user_id, edge.target_key)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    title="حذف اتصال"
                  >
                    <span className="font-medium">
                      {form?.section_title || edge.target_key}
                    </span>
                    <span className="text-slate-400">←</span>
                    <span>{user?.display_name || user?.username || edge.user_id}</span>
                    <X className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
