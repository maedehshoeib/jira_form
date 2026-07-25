import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Save,
  Upload,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { Button } from "../../components/ui/button";
import { emptyBanner, SiteBanner } from "../../features/banner";

export default function AdminBannerPage() {
  const [banner, setBanner] = useState<SiteBanner>(emptyBanner);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
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
    if (!selectedImage) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (selectedImage) {
        const formData = new FormData();
        formData.append("image", selectedImage);
        await client.post<SiteBanner>(
          `${endpoints.adminBanner}/image`,
          formData
        );
      }

      const { data } = await client.put<SiteBanner>(endpoints.adminBanner, {
        is_active: banner.is_active,
      });
      setBanner(data);
      setSelectedImage(null);
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

  const displayedImage = previewUrl || banner.image_url || "";

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
                <h3 className="font-bold text-slate-800">تصویر بنر</h3>
                <p className="mt-1 text-xs text-slate-500">
                  فرمت JPG، PNG یا WebP، حداکثر ۱۰ مگابایت. تصویر عریض پیشنهاد می‌شود.
                </p>
              </div>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700">
                <Upload size={17} />
                {displayedImage ? "جایگزینی تصویر" : "انتخاب تصویر"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    setSelectedImage(event.target.files?.[0] || null);
                    setSaved(false);
                  }}
                />
              </label>
            </div>

            <div className="overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50">
              {displayedImage ? (
                <img
                  src={displayedImage}
                  alt="پیش‌نمایش بنر"
                  className="aspect-[16/7] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/7] min-h-56 flex-col items-center justify-center gap-3 text-slate-400">
                  <ImageIcon size={44} strokeWidth={1.5} />
                  <p className="text-sm">هنوز تصویری برای بنر انتخاب نشده است.</p>
                </div>
              )}
            </div>
            {selectedImage && (
              <p className="mt-3 text-xs text-slate-500" dir="ltr">
                {selectedImage.name} · {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </section>

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
              disabled={saving || (!displayedImage && banner.is_active)}
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
