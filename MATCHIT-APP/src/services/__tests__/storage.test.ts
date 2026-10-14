/* Jest + TypeScript unit tests for src/services/storage.ts
   - Mocks ENV, Platform, ImageManipulator and the supabase client.
   - Ensure this file is under your test folder and Jest is configured for TS.
*/

const mockUploadMocks: Record<string, jest.Mock> = {};
const mockRemove = jest.fn();

jest.mock('../../config/env', () => ({ // <-- correct relative path from __tests__ folder
  ENV: { SUPABASE_URL: 'https://supabase.example.com' },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: (_uri: string) => ({
      resize: () => ({
        renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file://compressed.jpg' }) }),
      }),
    }),
  },
  SaveFormat: { JPEG: 'jpeg' },
}));

// Mock the supabase client used by storage.ts (file: src/services/supabase.ts)
jest.mock('../supabase', () => ({ // <-- correct relative path from __tests__ folder
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: (...args: any[]) => {
          if (!mockUploadMocks[bucket]) mockUploadMocks[bucket] = jest.fn();
          return mockUploadMocks[bucket](...args);
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example.com/${bucket}/${path}` } }),
        remove: (...args: any[]) => mockRemove(...args),
      }),
    },
  },
}));

import {
  BUCKET_AVATARS,
  BUCKET_CATALOG,
  BUCKET_THUMBNAILS,
  deleteStorageFile,
  normalizeStorageUrl,
  uploadAvatar,
  uploadCatalogPhoto,
  uploadMultiplePhotos,
} from '../storage'; // storage is one level up from __tests__

describe('services/storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockUploadMocks).forEach((k) => delete mockUploadMocks[k]);
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) });
  });

  describe('normalizeStorageUrl', () => {
    it('returns null for null/undefined', () => {
      expect(normalizeStorageUrl(null)).toBeNull();
      // @ts-ignore
      expect(normalizeStorageUrl(undefined)).toBeNull();
    });

    it('rewrites /storage/... paths to ENV.SUPABASE_URL + path', () => {
      const local = 'http://localhost:54321/storage/v1/object/public/avatars/user/avatar.jpg';
      const normalized = normalizeStorageUrl(local);
      expect(normalized).toBe('https://supabase.example.com/storage/v1/object/public/avatars/user/avatar.jpg');
    });

    it('returns same URL if no storage path present', () => {
      const url = 'https://example.com/image.jpg';
      expect(normalizeStorageUrl(url)).toBe(url);
    });
  });

  describe('uploadAvatar', () => {
    it('uploads and returns public url on success', async () => {
      const mockUpload = jest.fn().mockResolvedValue({ error: null });
      mockUploadMocks[BUCKET_AVATARS] = mockUpload;

      const res = await uploadAvatar('file://local.jpg', 'user123');

      expect(mockUpload).toHaveBeenCalledWith(
        'user123/avatar.jpg',
        expect.any(ArrayBuffer),
        expect.objectContaining({ contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })
      );
      expect(res.error).toBeNull();
      expect(res.data).toEqual({ url: `https://cdn.example.com/${BUCKET_AVATARS}/user123/avatar.jpg` });
    });

    it('returns error message if upload fails', async () => {
      mockUploadMocks[BUCKET_AVATARS] = jest.fn().mockResolvedValue({ error: { message: 'Upload failed' } });

      const res = await uploadAvatar('file://local.jpg', 'user123');

      expect(res.data).toBeNull();
      expect(res.error).toBe('Upload failed');
    });
  });

  describe('uploadCatalogPhoto', () => {
    it('uploads main and thumbnail and returns urls', async () => {
      mockUploadMocks[BUCKET_CATALOG] = jest.fn().mockResolvedValue({ error: null });
      mockUploadMocks[BUCKET_THUMBNAILS] = jest.fn().mockResolvedValue({ error: null });

      const res = await uploadCatalogPhoto('file://img.jpg', 'u1', 'c1');

      expect(res.error).toBeNull();
      expect(res.data).not.toBeNull();
      const data = res.data!;
      expect(data.path).toMatch(/u1\/c1\/.*\.jpg$/);
      expect(data.url).toMatch(new RegExp(`https:\\/\\/cdn\\.example\\.com\\/${BUCKET_CATALOG}\\/u1\\/c1\\/`));
      expect(data.thumbnailUrl).toMatch(new RegExp(`https:\\/\\/cdn\\.example\\.com\\/${BUCKET_THUMBNAILS}\\/u1\\/c1\\/thumb_`));
    });

    it('returns error if either upload fails', async () => {
      mockUploadMocks[BUCKET_CATALOG] = jest.fn().mockResolvedValue({ error: { message: 'Main failed' } });
      mockUploadMocks[BUCKET_THUMBNAILS] = jest.fn().mockResolvedValue({ error: null });

      const res1 = await uploadCatalogPhoto('file://img.jpg', 'u1', 'c1');
      expect(res1.data).toBeNull();
      expect(res1.error).toBe('Main failed');

      mockUploadMocks[BUCKET_CATALOG] = jest.fn().mockResolvedValue({ error: null });
      mockUploadMocks[BUCKET_THUMBNAILS] = jest.fn().mockResolvedValue({ error: { message: 'Thumb failed' } });

      const res2 = await uploadCatalogPhoto('file://img.jpg', 'u1', 'c1');
      expect(res2.data).toBeNull();
      expect(res2.error).toBe('Thumb failed');
    });
  });

  describe('uploadMultiplePhotos', () => {
    it('uploads in batches and invokes onProgress', async () => {
      mockUploadMocks[BUCKET_CATALOG] = jest.fn().mockResolvedValue({ error: null });
      mockUploadMocks[BUCKET_THUMBNAILS] = jest.fn().mockResolvedValue({ error: null });

      const uris = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'];
      const progressCalls: Array<[number, number]> = [];
      const res = await uploadMultiplePhotos(uris, 'uX', 'cX', (done, total) => {
        progressCalls.push([done, total]);
      });

      expect(res.length).toBe(uris.length);
      expect(progressCalls.length).toBeGreaterThanOrEqual(1);
      expect(progressCalls[progressCalls.length - 1][0]).toBe(uris.length);
    });
  });

  describe('deleteStorageFile', () => {
    it('removes file and returns no error on success', async () => {
      mockRemove.mockResolvedValue({ error: null });
      const res = await deleteStorageFile(BUCKET_AVATARS, 'u1/avatar.jpg');
      expect(mockRemove).toHaveBeenCalledWith(['u1/avatar.jpg']);
      expect(res.error).toBeNull();
    });

    it('returns error message if remove fails', async () => {
      mockRemove.mockResolvedValue({ error: { message: 'Delete failed' } });
      const res = await deleteStorageFile(BUCKET_AVATARS, 'u1/avatar.jpg');
      expect(res.error).toBe('Delete failed');
    });
  });
});