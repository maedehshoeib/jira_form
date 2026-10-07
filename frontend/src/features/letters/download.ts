export async function downloadAuthFile(url: string, fileName: string): Promise<boolean> {
  const token = localStorage.getItem("access_token");
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}
