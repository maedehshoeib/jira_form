export type SiteBanner = {
  is_active: boolean;
  image_url: string | null;
  image_name: string;
  updated_at?: string | null;
};

export const emptyBanner: SiteBanner = {
  is_active: false,
  image_url: null,
  image_name: "",
};
