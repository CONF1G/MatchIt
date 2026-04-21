// src/services/storage.ts
// Gestionarea upload-ului de fișiere în Supabase Storage.
// Buckets folosite: "avatars", "catalog-photos", "thumbnails"
//
// Instalare dependențe:
//   npx expo install expo-image-manipulator expo-file-system

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { supabase } from "./supabase";

// ─── Constante bucket-uri ─────────────────────────────────────────────────────

export const BUCKET_AVATARS    = "avatars";
export const BUCKET_CATALOG    = "catalog-photos";
export const BUCKET_THUMBNAILS = "thumbnails";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

export type UploadResult = {
  path:         string; // calea relativă în bucket
  url:          string; // URL public complet
  thumbnailUrl: string; // URL thumbnail
};

export type StorageResponse<T> = {
  data:  T | null;
  error: string | null;
};

// ─── Helpers interne ──────────────────────────────────────────────────────────

function uniqueFileName(ext = "jpg"): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${Date.now()}_${rand}.${ext}`;
}

function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Citește un fișier local ca ArrayBuffer pentru upload în Supabase.
 * Folosește expo-file-system care funcționează pe iOS și Android.
 */
async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Comprimă și redimensionează o imagine locală.
 */
async function compressImage(
  uri:      string,
  maxWidth: number = 1200,
  quality:  number = 0.8
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Generează un thumbnail mic (400px lățime).
 */
async function generateThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 400 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// ─── UPLOAD AVATAR ────────────────────────────────────────────────────────────

/**
 * Uploadează avatarul unui utilizator.
 * Path: avatars/{userId}/avatar.jpg
 * upsert=true → suprascrie avatarul vechi automat.
 *
 * @example
 * const { data, error } = await uploadAvatar(pickerResult.uri, user.id);
 * if (data) await supabase.from("profiles").update({ avatar_url: data.url }).eq("id", user.id);
 */
export async function uploadAvatar(
  localUri: string,
  userId:   string
): Promise<StorageResponse<{ url: string }>> {
  try {
    const compressedUri = await compressImage(localUri, 400, 0.85);
    const buffer        = await readFileAsArrayBuffer(compressedUri);
    const filePath      = `${userId}/avatar.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET_AVATARS)
      .upload(filePath, buffer, {
        contentType:  "image/jpeg",
        upsert:       true,
        cacheControl: "3600",
      });

    if (error) return { data: null, error: error.message };

    return { data: { url: getPublicUrl(BUCKET_AVATARS, filePath) }, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Eroare upload avatar" };
  }
}

// ─── UPLOAD POZĂ CATALOG ──────────────────────────────────────────────────────

/**
 * Uploadează o poză într-un catalog + thumbnail automat.
 * Path principal:  catalog-photos/{userId}/{catalogId}/{fileName}
 * Path thumbnail:  thumbnails/{userId}/{catalogId}/thumb_{fileName}
 *
 * @example
 * const { data, error } = await uploadCatalogPhoto(uri, user.id, catalog.id);
 * if (data) {
 *   await supabase.from("photos").insert({
 *     image_url:     data.url,
 *     thumbnail_url: data.thumbnailUrl,
 *     storage_path:  data.path,
 *   });
 * }
 */
export async function uploadCatalogPhoto(
  localUri:  string,
  userId:    string,
  catalogId: string
): Promise<StorageResponse<UploadResult>> {
  try {
    const fileName  = uniqueFileName("jpg");
    const mainPath  = `${userId}/${catalogId}/${fileName}`;
    const thumbPath = `${userId}/${catalogId}/thumb_${fileName}`;

    // Comprimăm și generăm thumbnail în paralel
    const [compressedUri, thumbnailUri] = await Promise.all([
      compressImage(localUri, 1200, 0.8),
      generateThumbnail(localUri),
    ]);

    // Citim ambele buffere în paralel
    const [mainBuffer, thumbBuffer] = await Promise.all([
      readFileAsArrayBuffer(compressedUri),
      readFileAsArrayBuffer(thumbnailUri),
    ]);

    // Uploadăm în paralel
    const [mainUpload, thumbUpload] = await Promise.all([
      supabase.storage.from(BUCKET_CATALOG).upload(mainPath, mainBuffer, {
        contentType: "image/jpeg", upsert: false, cacheControl: "3600",
      }),
      supabase.storage.from(BUCKET_THUMBNAILS).upload(thumbPath, thumbBuffer, {
        contentType: "image/jpeg", upsert: false, cacheControl: "3600",
      }),
    ]);

    if (mainUpload.error)  return { data: null, error: mainUpload.error.message };
    if (thumbUpload.error) return { data: null, error: thumbUpload.error.message };

    return {
      data: {
        path:         mainPath,
        url:          getPublicUrl(BUCKET_CATALOG, mainPath),
        thumbnailUrl: getPublicUrl(BUCKET_THUMBNAILS, thumbPath),
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Eroare upload poză" };
  }
}

// ─── UPLOAD MULTIPLE ──────────────────────────────────────────────────────────

/**
 * Uploadează mai multe poze în batch-uri de 3 simultan.
 * @param onProgress Callback cu (pozeFăcute, total) după fiecare batch
 *
 * @example
 * const results = await uploadMultiplePhotos(uris, userId, catalogId, (done, total) => {
 *   setProgress(done / total);
 * });
 * const succeeded = results.filter(r => r.data !== null);
 */
export async function uploadMultiplePhotos(
  uris:        string[],
  userId:      string,
  catalogId:   string,
  onProgress?: (done: number, total: number) => void
): Promise<Array<StorageResponse<UploadResult>>> {
  const results: Array<StorageResponse<UploadResult>> = [];
  const BATCH = 3;

  for (let i = 0; i < uris.length; i += BATCH) {
    const batch        = uris.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map((uri) => uploadCatalogPhoto(uri, userId, catalogId))
    );
    results.push(...batchResults);
    onProgress?.(Math.min(i + BATCH, uris.length), uris.length);
  }

  return results;
}

// ─── ȘTERGERE ─────────────────────────────────────────────────────────────────

/**
 * Șterge un singur fișier din orice bucket.
 */
export async function deleteStorageFile(
  bucket: string,
  path:   string
): Promise<StorageResponse<null>> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Șterge poza și thumbnail-ul ei din Storage.
 * Apelat automat din deletePhoto() — nu blocăm dacă eșuează.
 */
export async function deleteCatalogPhotoFiles(
  storagePath: string
): Promise<void> {
  const parts     = storagePath.split("/");
  const fileName  = parts[parts.length - 1];
  const thumbPath = [...parts.slice(0, -1), `thumb_${fileName}`].join("/");

  await Promise.allSettled([
    supabase.storage.from(BUCKET_CATALOG).remove([storagePath]),
    supabase.storage.from(BUCKET_THUMBNAILS).remove([thumbPath]),
  ]);
}