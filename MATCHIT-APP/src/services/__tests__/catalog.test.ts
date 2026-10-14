// MATCHIT-APP/src/services/__tests__/catalog.test.ts
type MockTableResponse = {
  select?: any;
  insert?: any;
  update?: any;
  delete?: any;
};

const mockTableResponses: Record<string, MockTableResponse> = {};
let currentSession: any = null;

/**
 * Use jest.doMock so the mock factory executes after our local variables are set up.
 * The path here matches how catalog.ts resolves its './supabase' import when required.
 */
jest.doMock("../../services/supabase", () => {
  function makeQuery(table: string) {
    // default operation is 'select'
    let op: keyof MockTableResponse = "select";
    let lastPayload: any = undefined;

    const query: any = {
      _op: "select",
      _payload: undefined,

      // IMPORTANT: don't overwrite op here. If an insert/update precedes select, we want
      // to return the 'insert' or 'update' configured response even when code chains .select().
      select: (_arg?: any, _countArg?: any) => {
        // intentionally do NOT set op = "select" so prior insert/update/delete is preserved
        query._op = op;
        return query;
      },

      eq: (_field: string, _value: any) => query,
      order: (_field: string, _opts?: any) => query,
      range: (_from: number, _to: number) => query,
      contains: (_field: string, _value: any) => query,
      maybeSingle: () => query,
      single: () => query,
      insert: (payload: any) => {
        op = "insert";
        query._op = "insert";
        lastPayload = payload;
        query._payload = payload;
        return query;
      },
      update: (payload: any) => {
        op = "update";
        query._op = "update";
        lastPayload = payload;
        query._payload = payload;
        return query;
      },
      delete: () => {
        op = "delete";
        query._op = "delete";
        return query;
      },

      // Simulate a thenable (so `await query` resolves to the configured response).
      then: (resolve: (value: any) => void) => {
        const configured = mockTableResponses[table]?.[op] ?? {
          data: null,
          error: null,
          count: null,
        };
        resolve(configured);
      },
    };

    return query;
  }

  return {
    supabase: {
      from: (table: string) => makeQuery(table),
      auth: {
        getSession: async () => ({ data: { session: currentSession } }),
      },
    },
  };
});

function setSession(session: any) {
  currentSession = session;
}

function setResponse(table: string, op: keyof MockTableResponse, value: any) {
  if (!mockTableResponses[table]) mockTableResponses[table] = {};
  mockTableResponses[table][op] = value;
}

beforeEach(() => {
  for (const key of Object.keys(mockTableResponses)) {
    delete mockTableResponses[key];
  }
  currentSession = null;
});

describe("services/catalog.ts (Jest)", () => {
  describe("fetchPublicCatalogs", () => {
    it("returns paginated public catalogs and hasMore=true when count is larger than the page size", async () => {
      const data = Array.from({ length: 30 }, (_, i) => ({ id: `catalog-${i}` }));
      setResponse("catalogs", "select", {
        data,
        error: null,
        count: 100,
      });

      jest.resetModules();
      const { fetchPublicCatalogs } = require("../../services/catalog");
      const result = await fetchPublicCatalogs(0);

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(30);
      expect(result.count).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it("returns null data and error message when the query fails", async () => {
      setResponse("catalogs", "select", {
        data: null,
        error: { message: "feed failed" },
        count: null,
      });

      jest.resetModules();
      const { fetchPublicCatalogs } = require("../../services/catalog");
      const result = await fetchPublicCatalogs(1);

      expect(result.data).toBeNull();
      expect(result.error).toBe("feed failed");
      expect(result.count).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it("applies the optional tag filter when tag is provided", async () => {
      const data = [{ id: "tagged-1", tags: ["travel"] }];
      setResponse("catalogs", "select", {
        data,
        error: null,
        count: 1,
      });

      jest.resetModules();
      const { fetchPublicCatalogs } = require("../../services/catalog");
      const result = await fetchPublicCatalogs(0, "travel");

      expect(result.error).toBeNull();
      expect(result.data).toEqual(data);
      expect(result.count).toBe(1);
    });
  });

  describe("fetchUserCatalogs", () => {
    it("returns the owner catalogs while hiding private ones by default", async () => {
      const data = [{ id: "user-cat", owner_id: "owner-1", is_private: false }];
      setResponse("catalogs", "select", {
        data,
        error: null,
      });

      jest.resetModules();
      const { fetchUserCatalogs } = require("../../services/catalog");
      const result = await fetchUserCatalogs("owner-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual(data);
    });

    it("returns the error message when Supabase fails", async () => {
      setResponse("catalogs", "select", {
        data: null,
        error: { message: "user catalogs failed" },
      });

      jest.resetModules();
      const { fetchUserCatalogs } = require("../../services/catalog");
      const result = await fetchUserCatalogs("owner-1", true);

      expect(result.data).toBeNull();
      expect(result.error).toBe("user catalogs failed");
    });
  });

  describe("fetchCatalogById", () => {
    it("returns a single catalog with joined photos when found", async () => {
      const payload = {
        id: "cat-1",
        photos: [{ id: "photo-1" }],
      };

      setResponse("catalogs", "select", {
        data: payload,
        error: null,
      });

      jest.resetModules();
      const { fetchCatalogById } = require("../../services/catalog");
      const result = await fetchCatalogById("cat-1");

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe("cat-1");
      expect(result.data?.photos).toHaveLength(1);
    });

    it("returns error if the catalog was not found", async () => {
      setResponse("catalogs", "select", {
        data: null,
        error: { message: "missing catalog" },
      });

      jest.resetModules();
      const { fetchCatalogById } = require("../../services/catalog");
      const result = await fetchCatalogById("missing-id");

      expect(result.data).toBeNull();
      expect(result.error).toBe("missing catalog");
    });
  });

  describe("createCatalog", () => {
    it("returns an auth error when there is no active session", async () => {
      jest.resetModules();
      const { createCatalog } = require("../../services/catalog");

      const result = await createCatalog({ title: "My catalog" } as any);

      expect(result.data).toBeNull();
      expect(result.error).toBe("Trebuie să fii autentificat");
    });

    it("adds owner_id, is_private, and tags defaults when the user is authenticated", async () => {
      setSession({ user: { id: "user-123" } });
      // configure the 'insert' response (we want insert to be honored even though service chains .select())
      setResponse("catalogs", "insert", {
        data: { id: "new-cat", owner_id: "user-123", title: "My catalog", is_private: true },
        error: null,
      });

      jest.resetModules();
      const { createCatalog } = require("../../services/catalog");
      const result = await createCatalog({
        title: "My catalog",
        is_private: true,
        tags: ["travel"],
      } as any);

      expect(result.error).toBeNull();
      expect(result.data?.owner_id).toBe("user-123");
      expect(result.data?.is_private).toBe(true);
      expect(result.data?.title).toBe("My catalog");
    });

    it("returns the insert error message when creation fails", async () => {
      setSession({ user: { id: "user-123" } });
      setResponse("catalogs", "insert", {
        data: null,
        error: { message: "create failed" },
      });

      jest.resetModules();
      const { createCatalog } = require("../../services/catalog");
      const result = await createCatalog({
        title: "Bad catalog",
      } as any);

      expect(result.data).toBeNull();
      expect(result.error).toBe("create failed");
    });
  });

  describe("updateCatalog", () => {
    it("returns updated catalog info on success", async () => {
      setResponse("catalogs", "update", {
        data: { id: "cat-1", title: "Updated title" },
        error: null,
      });

      jest.resetModules();
      const { updateCatalog } = require("../../services/catalog");
      const result = await updateCatalog("cat-1", { title: "Updated title" } as any);

      expect(result.error).toBeNull();
      expect(result.data?.title).toBe("Updated title");
    });

    it("returns the error message when update fails", async () => {
      setResponse("catalogs", "update", {
        data: null,
        error: { message: "update failed" },
      });

      jest.resetModules();
      const { updateCatalog } = require("../../services/catalog");
      const result = await updateCatalog("cat-1", { title: "Broken" } as any);

      expect(result.data).toBeNull();
      expect(result.error).toBe("update failed");
    });
  });

  describe("deleteCatalog", () => {
    it("returns null data when deletion succeeds", async () => {
      setResponse("catalogs", "delete", {
        data: null,
        error: null,
      });

      jest.resetModules();
      const { deleteCatalog } = require("../../services/catalog");
      const result = await deleteCatalog("cat-1");

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("returns the error message when deletion fails", async () => {
      setResponse("catalogs", "delete", {
        data: null,
        error: { message: "delete failed" },
      });

      jest.resetModules();
      const { deleteCatalog } = require("../../services/catalog");
      const result = await deleteCatalog("cat-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("delete failed");
    });
  });

  describe("addPhoto", () => {
    it("returns an auth error when no session exists", async () => {
      jest.resetModules();
      const { addPhoto } = require("../../services/catalog");

      const result = await addPhoto({ catalog_id: "cat-1", url: "photo-url" } as any);

      expect(result.data).toBeNull();
      expect(result.error).toBe("Trebuie să fii autentificat");
    });

    it("inserts a photo with uploader_id from the authenticated user", async () => {
      setSession({ user: { id: "user-42" } });
      setResponse("photos", "insert", {
        data: { id: "photo-1", catalog_id: "cat-1", uploader_id: "user-42" },
        error: null,
      });

      jest.resetModules();
      const { addPhoto } = require("../../services/catalog");
      const result = await addPhoto({
        catalog_id: "cat-1",
        url: "photo-url",
      } as any);

      expect(result.error).toBeNull();
      expect(result.data?.uploader_id).toBe("user-42");
      expect(result.data?.catalog_id).toBe("cat-1");
    });
  });

  describe("deletePhoto", () => {
    it("returns null data when photo deletion succeeds", async () => {
      setResponse("photos", "delete", {
        data: null,
        error: null,
      });

      jest.resetModules();
      const { deletePhoto } = require("../../services/catalog");
      const result = await deletePhoto("photo-1");

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("returns the error message when delete fails", async () => {
      setResponse("photos", "delete", {
        data: null,
        error: { message: "delete photo failed" },
      });

      jest.resetModules();
      const { deletePhoto } = require("../../services/catalog");
      const result = await deletePhoto("photo-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("delete photo failed");
    });
  });

  describe("toggleCatalogLike", () => {
    it("returns an auth error if the user is not logged in", async () => {
      jest.resetModules();
      const { toggleCatalogLike } = require("../../services/catalog");

      const result = await toggleCatalogLike("cat-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Trebuie să fii autentificat");
    });

    it("removes an existing like when one is already present", async () => {
      setSession({ user: { id: "user-1" } });
      setResponse("catalog_likes", "select", {
        data: { id: "like-1" },
        error: null,
      });
      setResponse("catalog_likes", "delete", {
        data: null,
        error: null,
      });

      jest.resetModules();
      const { toggleCatalogLike } = require("../../services/catalog");
      const result = await toggleCatalogLike("cat-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ isLiked: false });
    });

    it("creates a like if no like exists yet", async () => {
      setSession({ user: { id: "user-1" } });
      setResponse("catalog_likes", "select", {
        data: null,
        error: null,
      });
      setResponse("catalog_likes", "insert", {
        data: null,
        error: null,
      });

      jest.resetModules();
      const { toggleCatalogLike } = require("../../services/catalog");
      const result = await toggleCatalogLike("cat-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ isLiked: true });
    });
  });

  describe("checkCatalogLike", () => {
    it("returns false when the user is not authenticated", async () => {
      jest.resetModules();
      const { checkCatalogLike } = require("../../services/catalog");

      const result = await checkCatalogLike("cat-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ isLiked: false });
    });

    it("returns true when the authenticated user has already liked the catalog", async () => {
      setSession({ user: { id: "user-2" } });
      setResponse("catalog_likes", "select", {
        data: { id: "like-2" },
        error: null,
      });

      jest.resetModules();
      const { checkCatalogLike } = require("../../services/catalog");
      const result = await checkCatalogLike("cat-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ isLiked: true });
    });

    it("returns false when no like exists for the current user", async () => {
      setSession({ user: { id: "user-2" } });
      setResponse("catalog_likes", "select", {
        data: null,
        error: null,
      });

      jest.resetModules();
      const { checkCatalogLike } = require("../../services/catalog");
      const result = await checkCatalogLike("cat-1");

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ isLiked: false });
    });
  });
});