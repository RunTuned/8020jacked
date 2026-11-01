"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

export const PHOTO_MAX_PX = 1280;
export const PHOTO_QUALITY = 0.8;

async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: b, w: b.width, h: b.height, done: () => b.close() };
    } catch {
      // fall back to <img>
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Shrink on the phone before saving: longest side 1280px, JPEG 0.8. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const { src, w, h, done } = await decode(file);
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(src, 0, 0, cw, ch);
  done();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/jpeg", PHOTO_QUALITY),
  );
}

/** Loads a photo from IndexedDB through the store. */
export function usePhotoUrl(id: string | null): string | null {
  const getPhoto = useAppStore((s) => s.getPhoto);
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    let made: string | null = null;
    getPhoto(id).then((b) => {
      if (!live || !b) return;
      made = URL.createObjectURL(b);
      setUrl({ id, url: made });
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, getPhoto]);
  return url && url.id === id ? url.url : null;
}

export function PhotoImage({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const url = usePhotoUrl(id);
  if (!url) return <div role="img" aria-label={alt} className={`bg-neutral ${className ?? ""}`} />;
  // eslint-disable-next-line @next/next/no-img-element -- local blob URL, not an optimisable asset
  return <img src={url} alt={alt} className={className} />;
}
