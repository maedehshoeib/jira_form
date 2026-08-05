import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Newspaper,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { Button } from "../../components/ui/button";
import { emptyBanner, SiteBanner } from "../../features/banner";
import { SiteNews } from "../../features/news";
import { formatPersianDateTime } from "../../lib/persianDate";

const formatNewsDate = (value: string) => formatPersianDateTime(value);

type NewsDraft = {
  title: string;
  body: string;
  image: File | null;
  previewUrl: string | null;
  removeImage: boolean;
};

const emptyDraft = (): NewsDraft => ({
  title: "",
  body: "",
  image: null,
  previewUrl: null,
  removeImage: false,
});

export default function AdminBannerPage() {
  const [banner, setBanner] = useState<SiteBanner>(emptyBanner);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [newsItems, setNewsItems] = useState<SiteNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [newsSaved, setNewsSaved] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [draft, setDraft] = useState<NewsDraft>(emptyDraft());

  useEffect(() => {
    client
      .get<SiteBanner>(endpoints.adminBanner)
      .then(({ data }) => setBanner(data))
      .catch(() => setError("دریافت تنظیمات بنر با مشکل مواجه شد."))
      .finally(() => setLoading(false));

    client
      .get<SiteNews[]>(endpoints.adminNews)
      .then(({ data }) => setNewsItems(data))
      .catch(() => setNewsError("دریافت اخبار با مشکل مواجه شد."))
      .finally(() => setNewsLoading(false));
  }, []);

  useEffect(() => {
    const objectUrls = selectedImages.map((image) => URL.createObjectURL(image));
    setPreviewUrls(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    };
  }, [draft.previewUrl]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      for (const selectedImage of selectedImages) {
        const formData = new FormData();
        formData.append("image", selectedImage);
        await client.post<SiteBanner>(
          `${endpoints.adminBanner}/image`,
          formData
        );
      }

      const { data } = await client.put<SiteBanner>(endpoints.adminBanner, {
        is_active: banner.is_active,
        interval_seconds: banner.interval_seconds,
      });
      setBanner(data);
      setSelectedImages([]);
      setSaved(true);
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "ذخیره تصویر بنر با مشکل مواجه شد."
      );
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async (imageId: number) => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { data } = await client.delete<SiteBanner>(
        `${endpoints.adminBanner}/images/${imageId}`,
      );
      setBanner(data);
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "حذف تصویر بنر با مشکل مواجه شد.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateNews = () => {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setEditingId(null);
    setDraft(emptyDraft());
    setShowNewsForm(true);
    setNewsError("");
    setNewsSaved(false);
  };

  const openEditNews = (item: SiteNews) => {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setEditingId(item.id);
    setDraft({
      title: item.title,
      body: item.body,
      image: null,
      previewUrl: null,
      removeImage: false,
    });
    setShowNewsForm(true);
    setNewsError("");
    setNewsSaved(false);
  };

  const cancelNewsForm = () => {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setShowNewsForm(false);
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const setNewsImage = (file: File | null) => {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setDraft((current) => ({
      ...current,
      image: file,
      previewUrl: file ? URL.createObjectURL(file) : null,
      removeImage: false,
    }));
  };

  const submitNews = async (event: FormEvent) => {
    event.preventDefault();
    setNewsSaving(true);
    setNewsError("");
    setNewsSaved(false);
    try {
      const formData = new FormData();
      formData.append("title", draft.title);
      formData.append("body", draft.body);
      if (draft.image) formData.append("image", draft.image);
      if (editingId !== null) {
        formData.append("remove_image", draft.removeImage ? "true" : "false");
      }

      const { data } =
        editingId === null
          ? await client.post<SiteNews>(endpoints.adminNews, formData)
          : await client.put<SiteNews>(
              `${endpoints.adminNews}/${editingId}`,
              formData,
            );

      setNewsItems((current) => {
        if (editingId === null) return [data, ...current];
        return current.map((item) => (item.id === data.id ? data : item));
      });
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      setShowNewsForm(false);
      setEditingId(null);
      setDraft(emptyDraft());
      setNewsSaved(true);
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      setNewsError(
        typeof detail === "string" ? detail : "ذخیره خبر با مشکل مواجه شد.",
      );
    } finally {
      setNewsSaving(false);
    }
  };

  const deleteNews = async (newsId: number) => {
    if (!window.confirm("آیا از حذف این خبر مطمئن هستید؟")) return;
    setNewsSaving(true);
    setNewsError("");
    setNewsSaved(false);
    try {
      await client.delete(`${endpoints.adminNews}/${newsId}`);
      setNewsItems((current) => current.filter((item) => item.id !== newsId));
      if (editingId === newsId) cancelNewsForm();
      setNewsSaved(true);
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      setNewsError(
        typeof detail === "string" ? detail : "حذف خبر با مشکل مواجه شد.",
      );
    } finally {
      setNewsSaving(false);
    }
  };

  const totalImageCount = banner.images.length + selectedImages.length;
  const editingItem =
    editingId === null
      ? null
      : newsItems.find((item) => item.id === editingId) || null;
  const newsPreviewSrc =
    draft.previewUrl ||
    (!draft.removeImage && editingItem?.image_url ? editingItem.image_url : null);

  return (
    <AppShell>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ImageIcon size={25} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900">مدیریت بنر و اخبار</h2>
          <p className="mt-1 text-sm text-slate-500">
            بنر بالای صفحه اصلی و ستون اخبار را از این بخش مدیریت کنید.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin text-red-600" />
          در حال دریافت تنظیمات...
        </div>
      ) : (
        <div className="space-y-10">
          <form onSubmit={submit} className="space-y-6">
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800">تصاویر اسلایدر</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    چند تصویر JPG، PNG یا WebP انتخاب کنید؛ حداکثر حجم هر تصویر ۱۰ مگابایت است.
                  </p>
                </div>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700">
                  <Upload size={17} />
                  افزودن تصاویر
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      setSelectedImages((current) => [...current, ...files]);
                      setSaved(false);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

              {totalImageCount > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {banner.images.map((image, index) => (
                    <div
                      key={image.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <div className="relative">
                        <img
                          src={image.image_url}
                          alt={image.image_name || `بنر ${index + 1}`}
                          className="aspect-[16/7] w-full object-cover"
                        />
                        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          aria-label={`حذف ${image.image_name || `بنر ${index + 1}`}`}
                          disabled={saving}
                          onClick={() => removeImage(image.id)}
                          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <p className="truncate px-3 py-2 text-xs text-slate-500" dir="ltr">
                        {image.image_name}
                      </p>
                    </div>
                  ))}
                  {selectedImages.map((image, index) => (
                    <div
                      key={`${image.name}-${image.lastModified}-${index}`}
                      className="overflow-hidden rounded-2xl border border-dashed border-red-300 bg-red-50/40"
                    >
                      <div className="relative">
                        <img
                          src={previewUrls[index]}
                          alt={`پیش‌نمایش ${image.name}`}
                          className="aspect-[16/7] w-full object-cover"
                        />
                        <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                          جدید
                        </span>
                        <button
                          type="button"
                          aria-label={`حذف ${image.name} از انتخاب‌ها`}
                          onClick={() =>
                            setSelectedImages((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow transition hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <p className="truncate px-3 py-2 text-xs text-slate-500" dir="ltr">
                        {image.name} · {(image.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-[16/7] min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                  <ImageIcon size={44} strokeWidth={1.5} />
                  <p className="text-sm">هنوز تصویری برای اسلایدر انتخاب نشده است.</p>
                </div>
              )}
            </section>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="font-bold text-slate-800">زمان نمایش هر تصویر</p>
                <p className="mt-1 text-xs text-slate-500">
                  اسلایدر پس از این تعداد ثانیه به تصویر بعدی می‌رود.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={banner.interval_seconds}
                  onChange={(event) => {
                    setBanner((current) => ({
                      ...current,
                      interval_seconds: Number(event.target.value),
                    }));
                    setSaved(false);
                  }}
                  className="h-10 w-20 rounded-xl border border-slate-200 px-3 text-center outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                <span className="text-sm text-slate-500">ثانیه</span>
              </div>
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="font-bold text-slate-800">نمایش بنر در صفحه اصلی</p>
                <p className="mt-1 text-xs text-slate-500">
                  بنر فقط زمانی نمایش داده می‌شود که تصویر داشته باشد و این گزینه فعال باشد.
                </p>
              </div>
              <input
                type="checkbox"
                checked={banner.is_active}
                onChange={(event) => {
                  setBanner((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }));
                  setSaved(false);
                }}
                className="h-5 w-5 accent-red-600"
              />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={saving || (totalImageCount === 0 && banner.is_active)}
                className="h-11 gap-2 rounded-xl bg-red-600 px-6 hover:bg-red-700"
              >
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                ذخیره تغییرات بنر
              </Button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 size={17} />
                  ذخیره شد
                </span>
              )}
            </div>
          </form>

          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">اخبار صفحه اصلی</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    خبر می‌تواند فقط متن، فقط تصویر، یا ترکیبی از هر دو باشد.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={openCreateNews}
                className="h-11 gap-2 rounded-xl bg-red-600 px-5 hover:bg-red-700"
              >
                <Plus size={17} />
                خبر جدید
              </Button>
            </div>

            {showNewsForm && (
              <form
                onSubmit={submitNews}
                className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-bold text-slate-800">
                    {editingId === null ? "افزودن خبر" : "ویرایش خبر"}
                  </h4>
                  <button
                    type="button"
                    onClick={cancelNewsForm}
                    className="rounded-xl p-2 text-slate-500 hover:bg-white"
                    aria-label="بستن فرم خبر"
                  >
                    <X size={18} />
                  </button>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-slate-700">عنوان</span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="عنوان خبر یا اطلاعیه"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-slate-700">متن خبر</span>
                  <textarea
                    value={draft.body}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, body: event.target.value }))
                    }
                    rows={5}
                    placeholder="متن کامل خبر (اختیاری)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </label>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:text-red-600">
                      <Upload size={16} />
                      {newsPreviewSrc ? "تغییر تصویر" : "افزودن تصویر"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setNewsImage(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {newsPreviewSrc && (
                      <button
                        type="button"
                        onClick={() => {
                          if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
                          setDraft((current) => ({
                            ...current,
                            image: null,
                            previewUrl: null,
                            removeImage: true,
                          }));
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                        حذف تصویر
                      </button>
                    )}
                  </div>

                  {newsPreviewSrc && (
                    <img
                      src={newsPreviewSrc}
                      alt="پیش‌نمایش تصویر خبر"
                      className="max-h-56 w-full rounded-2xl border border-slate-200 object-cover"
                    />
                  )}
                </div>

                {newsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {newsError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={newsSaving}
                    className="h-10 gap-2 rounded-xl bg-red-600 px-5 hover:bg-red-700"
                  >
                    {newsSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    ذخیره خبر
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelNewsForm}
                    className="h-10 rounded-xl"
                  >
                    انصراف
                  </Button>
                </div>
              </form>
            )}

            {newsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
                <Loader2 className="animate-spin text-red-600" size={18} />
                در حال دریافت اخبار...
              </div>
            ) : newsItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-slate-400">
                <Newspaper size={40} strokeWidth={1.5} />
                <p className="text-sm">هنوز خبری ثبت نشده است.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {newsItems.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-24 w-full shrink-0 rounded-xl object-cover sm:h-20 sm:w-28"
                      />
                    ) : (
                      <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-slate-300 sm:w-28">
                        <Newspaper size={22} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-bold text-slate-800">{item.title}</h4>
                      {item.body && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {item.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {formatNewsDate(item.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openEditNews(item)}
                        className="h-9 rounded-xl px-3 text-sm"
                      >
                        ویرایش
                      </Button>
                      <button
                        type="button"
                        disabled={newsSaving}
                        onClick={() => deleteNews(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                        aria-label={`حذف ${item.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!showNewsForm && newsError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {newsError}
              </div>
            )}
            {newsSaved && !showNewsForm && (
              <div className="mt-4 flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 size={17} />
                تغییرات اخبار ذخیره شد
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
