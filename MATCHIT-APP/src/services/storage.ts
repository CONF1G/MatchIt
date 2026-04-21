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
 * Generates a unique filename using the current timestamp and a short random token.
 *
 * @param ext - File extension to use (without leading dot). Defaults to "jpg".
 * @returns A filename in the form `<timestamp>_<token>.<ext>`.
 */

function uniqueFileName(ext = "jpg"): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${Date.now()}_${rand}.${ext}`;
}

/**
 * Builds the public URL for an object stored in the specified storage bucket.
 *
 * @param bucket - The name of the storage bucket
 * @param path - The object's path within the bucket
 * @returns The public URL of the object
 */
function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Reads a local file URI and returns its contents as an ArrayBuffer suitable for uploads.
 *
 * @param uri - Local file URI (for example `file://...`) to read
 * @returns The file contents as an `ArrayBuffer`
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
 * Compresses and resizes a local image file.
 *
 * The output is saved as a JPEG.
 *
 * @param uri - Local file URI of the source image
 * @param maxWidth - Target maximum width in pixels; the image will be resized to this width
 * @param quality - JPEG compression quality between 0 and 1
 * @returns The URI of the resulting JPEG image
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
 * Create a 400px-wide JPEG thumbnail from a local image URI.
 *
 * @param uri - Local file URI of the source image
 * @returns The local file URI of the generated thumbnail saved as a JPEG with 75% compression
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
 * Uploads a user's avatar image to the avatars bucket at `avatars/{userId}/avatar.jpg`, overwriting any existing avatar.
 *
 * @param localUri - Local file URI of the image to upload
 * @param userId - Identifier of the user (used to build the storage path)
 * @returns A StorageResponse whose `data` is an object containing the uploaded avatar's public `url` on success, or `data` `null` and `error` set on failure
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
 * Uploads a catalog image and a generated thumbnail to storage, returning their storage path and public URLs.
 *
 * @returns `StorageResponse<UploadResult>` where `data` contains `path` (storage path for the main image), `url` (public URL of the main image), and `thumbnailUrl` (public URL of the thumbnail) on success; `error` contains an error message on failure.
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
 * Processes the input URIs in batches of 3, uploading each batch in parallel and invoking
 * the optional progress callback after every batch.
 *
 * @param onProgress - Optional callback invoked after each batch with `(done, total)` where `done` is the number of URIs processed so far and `total` is the total number of URIs
 * @returns An array of `StorageResponse<UploadResult>` objects, one per input `uri`, in the same order as the `uris` array. Each element contains `data` with the upload paths/URLs on success or `error` with a message on failure.
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
 * Remove a single object from the specified storage bucket.
 *
 * @param bucket - Name of the storage bucket (e.g., "avatars", "catalog-photos")
 * @param path - Object path within the bucket (relative path to the file to remove)
 * @returns `StorageResponse<null>` where `error` contains the error message if deletion failed, `null` on success
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
 * Attempts to remove the file at `storagePath` from the catalog bucket and the corresponding
 * `thumb_<filename>` from the thumbnails bucket in parallel; failures are suppressed.
 *
 * @param storagePath - The storage path of the catalog image (e.g., "userId/catalogId/filename.jpg")
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