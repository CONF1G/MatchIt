// src/types/database.ts
// Tipurile tabelelor din Supabase, aliniate cu 001_initial_schema.sql.
// După ce rulezi `supabase gen types typescript --linked > src/types/database.ts`
// acest fișier va fi suprascris automat cu tipuri generate.
// Până atunci, aceste tipuri manuale sunt funcționale și complete.

// ─── ENUMS (din schema SQL) ───────────────────────────────────────────────────

export type LobbyMode    = "first_match" | "deck" | "tournament";
export type LobbyStatus  = "waiting" | "in_progress" | "finished" | "cancelled";
export type SwipeAction  = "like" | "dislike" | "super_like";
export type ParticipantRole = "host" | "player" | "guest";
export type NotificationType =
  | "lobby_invite" | "lobby_started" | "match_result"
  | "new_follower" | "catalog_like" | "comment" | "system";

// ─── TABELE — Row = ce primești din SELECT ────────────────────────────────────

export type Profile = {
  id:              string;
  username:        string;
  display_name:    string | null;
  avatar_url:      string | null;
  bio:             string | null;
  is_guest:        boolean;
  guest_code:      string | null;
  followers_count: number;
  following_count: number;
  catalogs_count:  number;
  created_at:      string;
  updated_at:      string;
};

export type Catalog = {
  id:           string;
  owner_id:     string;
  title:        string;
  description:  string | null;
  cover_url:    string | null;
  is_private:   boolean;
  tags:         string[];
  likes_count:  number;
  photos_count: number;
  views_count:  number;
  created_at:   string;
  updated_at:   string;
};

export type Photo = {
  id:            string;
  catalog_id:    string;
  uploader_id:   string;
  storage_path:  string;
  url:           string;
  thumbnail_url: string | null;
  title:         string | null;
  description:   string | null;
  ai_tags:       string[];
  width:         number | null;
  height:        number | null;
  file_size:     number | null;
  sort_order:    number;
  likes_count:   number;
  created_at:    string;
  updated_at:    string;
};

export type Lobby = {
  id:          string;
  host_id:     string;
  catalog_id:  string | null;
  title:       string | null;
  mode:        LobbyMode;
  status:      LobbyStatus;
  invite_code: string;
  max_players: number;
  is_public:   boolean;
  settings:    Record<string, unknown>;
  started_at:  string | null;
  finished_at: string | null;
  created_at:  string;
  updated_at:  string;
};

export type LobbyParticipant = {
  id:        string;
  lobby_id:  string;
  user_id:   string;
  role:      ParticipantRole;
  score:     number;
  is_ready:  boolean;
  joined_at: string;
  left_at:   string | null;
};

export type SwipeSession = {
  id:             string;
  lobby_id:       string;
  participant_id: string;
  total_cards:    number;
  cards_swiped:   number;
  likes_count:    number;
  started_at:     string;
  completed_at:   string | null;
};

export type Swipe = {
  id:         string;
  session_id: string;
  photo_id:   string;
  action:     SwipeAction;
  created_at: string;
};

export type Match = {
  id:         string;
  lobby_id:   string;
  photo_id:   string;
  matched_by: string[];
  created_at: string;
};

export type Comment = {
  id:         string;
  catalog_id: string;
  author_id:  string;
  parent_id:  string | null;
  body:       string;
  created_at: string;
  updated_at: string;
};

export type AppNotification = {
  id:         string;
  user_id:    string;
  type:       NotificationType;
  title:      string;
  body:       string | null;
  data:       Record<string, string>;
  is_read:    boolean;
  created_at: string;
};

export type Follow = {
  id:           string;
  follower_id:  string;
  following_id: string;
  created_at:   string;
};

// ─── TIPURI CU JOIN-URI (pentru query-uri cu select extins) ──────────────────

export type CatalogWithProfile = Catalog & {
  profiles: Pick<Profile, "username" | "avatar_url"> | null;
};

export type PhotoWithUploader = Photo & {
  profiles: Pick<Profile, "username" | "avatar_url"> | null;
};

export type ParticipantWithProfile = LobbyParticipant & {
  profiles: Pick<Profile, "username" | "avatar_url"> | null;
};

export type CommentWithAuthor = Comment & {
  profiles: Pick<Profile, "username" | "avatar_url"> | null;
  replies?: CommentWithAuthor[];
};

export type LobbyWithCatalog = Lobby & {
  catalogs: Pick<Catalog, "title" | "cover_url"> | null;
  profiles: Pick<Profile, "username" | "avatar_url"> | null;
};

// ─── TIPURI PENTRU INSERT (câmpuri obligatorii la creare) ─────────────────────

export type NewCatalog = {
  title:       string;
  description?: string;
  cover_url?:  string;
  is_private?: boolean;
  tags?:       string[];
};

export type NewPhoto = {
  catalog_id:    string;
  storage_path:  string;
  url:           string;
  thumbnail_url?: string;
  title?:        string;
  description?:  string;
  sort_order?:   number;
};

export type NewLobby = {
  catalog_id?:  string;
  title?:       string;
  mode?:        LobbyMode;
  max_players?: number;
  is_public?:   boolean;
  settings?:    Record<string, unknown>;
};

// ─── TIPURI PENTRU UPDATE (totul opțional) ───────────────────────────────────

export type UpdateProfile = Partial<Pick<Profile,
  "display_name" | "avatar_url" | "bio" | "username"
>>;

export type UpdateCatalog = Partial<Pick<Catalog,
  "title" | "description" | "cover_url" | "is_private" | "tags"
>>;

export type UpdateLobby = Partial<Pick<Lobby,
  "title" | "mode" | "status" | "max_players" | "is_public" | "settings" | "started_at" | "finished_at"
>>;

// ─── TIPURI PENTRU RĂSPUNSURI SUPABASE ───────────────────────────────────────

/** Răspuns standard pentru orice operație — fie date, fie eroare */
export type ServiceResponse<T> = {
  data: T | null;
  error: string | null;
};

/** Răspuns paginat */
export type PaginatedResponse<T> = ServiceResponse<T[]> & {
  count: number | null;
  hasMore: boolean;
};