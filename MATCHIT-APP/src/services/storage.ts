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

/**
 * Generate a timestamped unique filename using a short random suffix.
 *
 * @param ext - File extension to use (without a leading dot). Defaults to `"jpg"`.
 * @returns A filename in the form `{timestamp}_{rand}.{ext}`, where `{rand}` is a short base36 string.
 */

function uniqueFileName(ext = "jpg"): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${Date.now()}_${rand}.${ext}`;
}

/**
 * Constructs a public URL for a storage object.
 *
 * @param bucket - The storage bucket name
 * @param path - The object's path inside the bucket
 * @returns The publicly accessible URL for the object
 */
function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Read a local file and return its contents as an ArrayBuffer.
 *
 * @param uri - Local file URI readable by Expo FileSystem (e.g., file://...)
 * @returns The file's raw bytes as an `ArrayBuffer`
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
 * Compresses and resizes a local image to the specified maximum width and JPEG quality.
 *
 * @param uri - Local file URI of the image to process
 * @param maxWidth - Maximum output width in pixels; aspect ratio is preserved
 * @param quality - JPEG compression quality between 0 and 1
 * @returns The URI of the processed image file
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
 * Creates a JPEG thumbnail with a width of 400 pixels from a local image URI.
 *
 * @param uri - Local file URI of the source image
 * @returns The local file URI of the generated JPEG thumbnail
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
 * Uploads and replaces a user's avatar image in the avatars storage bucket.
 *
 * @param localUri - Local file URI of the image to upload
 * @param userId - User identifier used to build the storage path (`{userId}/avatar.jpg`)
 * @returns An object whose `data` contains `{ url }` with the public URL of the uploaded avatar on success, or whose `error` contains an error message on failure
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
 * Uploads an image into the catalog bucket and a generated thumbnail into the thumbnails bucket.
 *
 * @param localUri - Local file URI of the image to upload
 * @param userId - User identifier used to build the storage path
 * @param catalogId - Catalog identifier used to build the storage path
 * @returns `data` contains `{ path, url, thumbnailUrl }` on success where `path` is the storage path of the main image, `url` is the public URL of the main image, and `thumbnailUrl` is the public URL of the thumbnail; `error` contains a failure message otherwise.
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
 * Uploads multiple catalog photos in concurrent batches of three.
 *
 * Processes the provided URIs in batches and uploads each photo via the catalog upload routine.
 *
 * @param uris - Array of local URIs for the photos to upload
 * @param userId - Identifier of the user who owns the catalog
 * @param catalogId - Identifier of the catalog where photos will be stored
 * @param onProgress - Optional callback invoked after each batch with `(done, total)` indicating how many items have been processed and the total count
 * @returns An array of `StorageResponse<UploadResult>` entries corresponding to the input `uris`, in the same processing order
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
 * Delete a single file from the specified storage bucket.
 *
 * @param bucket - The name of the storage bucket containing the file
 * @param path - The file's storage path inside the bucket (relative path/key)
 * @returns An object where `data` is always `null` and `error` is `null` on success or contains an error message on failure
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
 * Deletes a catalog image and its associated thumbnail from storage without throwing on failure.
 *
 * Attempts to remove the main file at `storagePath` (in the catalog bucket) and the corresponding
 * thumbnail (same folder, filename prefixed with `thumb_`). Failures during deletion are ignored.
 *
 * @param storagePath - The storage path of the main catalog image (path inside the catalog bucket)
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