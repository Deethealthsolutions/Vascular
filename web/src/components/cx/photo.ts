"use client";

/**
 * Downscale an image file in the browser and return a JPEG data URL.
 * Re-encoding through a canvas also drops EXIF metadata (GPS location, device),
 * which rule A29 requires on ingest. Production: upload the original to object
 * storage via a signed URL and keep only metadata in the database.
 */
export async function downscale(file: File, max = 900, quality = 0.72): Promise<{ dataUrl: string; w: number; h: number; kb: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Not an image the browser can read"));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", quality);
    return { dataUrl, w, h, kb: Math.round((dataUrl.length * 3) / 4 / 1024) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
