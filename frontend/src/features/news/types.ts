export type SiteNews = {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  image_name: string;
  created_at: string;
  updated_at?: string | null;
};
