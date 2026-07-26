import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { Button } from "../../components/ui/button";
import { emptyBanner, SiteBanner } from "../../features/banner";

export default function AdminBannerPage() {
  const [banner, setBanner] = useState<SiteBanner>(emptyBanner);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    client
      .get<SiteBanner>(endpoints.adminBanner)
      .then(({ data }) => setBanner(data))
      .catch(() => setError("دریافت تنظیمات بنر با مشکل مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const objectUrls = selectedImages.map((image) => URL.createObjectURL(image));
    setPreviewUrls(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedImages]);

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

  const totalImageCount = banner.images.length + selectedImages.length;

  return (
    <AppShell>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ImageIcon size={25} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900">مدیریت بنر صفحه اصلی</h2>
          <p className="mt-1 text-sm text-slate-500">
            تصویر بالای عنوان «واحدهای سازمانی» را بارگذاری یا جایگزین کنید.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin text-red-600" />
          در حال دریافت تنظیمات...
        </div>
      ) : (
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
              ذخیره تغییرات
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 size={17} />
                ذخیره شد
              </span>
            )}
          </div>
        </form>
      )}
    </AppShell>
  );
}
