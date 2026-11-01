// Progress photos (P3): images stay on this phone in IndexedDB, never the gallery.
import { del, get, set } from "idb-keyval";

const key = (id: string) => `8020jacked:photo:${id}`;

export async function savePhotoBlob(id: string, blob: Blob): Promise<void> {
  await set(key(id), blob);
}

export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  return get<Blob>(key(id));
}

export async function deletePhotoBlob(id: string): Promise<void> {
  await del(key(id));
}

export async function deletePhotoBlobs(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => del(key(id))));
}
