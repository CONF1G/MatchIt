# MatchIt

Proiect licenta

## Instalare și rulare

```bash
cd MATCHIT-APP
npm install
npx expo start
```

## Rulare pe rețele externe (tunnel)

Dacă vrei să accesezi aplicația de pe alt dispozitiv sau rețea diferită:

**Terminal 1 — Supabase tunnel:**
```bash
npx cloudflared tunnel --url http://localhost:54321
```

**Terminal 2 — App tunnel:**
```bash
npx cloudflared tunnel --url http://localhost:8081
```

**Terminal 3 — Expo:**
```bash
npx expo start
```

Actualizează `.env` cu URL-ul generat de Terminal 1:
```
EXPO_PUBLIC_SUPABASE_URL=https://yyyy.trycloudflare.com
```

Apoi repornește Expo:
```bash
npx expo start --clear
```

> ⚠️ URL-urile Cloudflare se schimbă la fiecare restart al tunnel-ului — actualizează `.env` de fiecare dată.
