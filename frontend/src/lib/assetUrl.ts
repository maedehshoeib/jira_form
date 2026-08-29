type StaticAsset = string | { src: string };

export function assetUrl(asset: StaticAsset): string {
  return typeof asset === "string" ? asset : asset.src;
}
