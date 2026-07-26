export type SiteBannerImage = {
  id: number;
  image_url: string;
  image_name: string;
};

export type SiteBanner = {
  is_active: boolean;
  images: SiteBannerImage[];
  interval_seconds: number;
  image_url: string | null;
  image_name: string;
  updated_at?: string | null;
};

export const emptyBanner: SiteBanner = {
  is_active: false,
  images: [],
  interval_seconds: 5,
  image_url: null,
  image_name: "",
};
