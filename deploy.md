# Deploy Roadmap (Production)

## 1) En mantikli mimari (onerilen)

Bu proje icin en guvenli ve operasyonu en kolay model:

- **Backend (Express + Socket.IO): Render Web Service**
- **Frontend (Next.js): Render Web Service**
- **DB: Render Postgres**
- **Cache/PubSub: Render Key Value (Redis uyumlu)**
- **Media: LiveKit Cloud (zaten kullaniyorsun)**

Neden bu model?

- Socket.IO/WebSocket backendi **surekli acik baglanti** istiyor.
- Vercel Functions websocket server olarak calismaz; bu yuzden backendi Vercel'e koymak bu proje icin dogru degil.
- Render tek platformda backend + frontend + Postgres + Redis + private network verdigi icin CORS/cookie/OAuth yonetimi daha temiz olur.

## 2) Alternatif model

- **Frontend: Vercel**
- **Backend + DB + Redis: Render**

Bu da iyi bir secenek. Ancak iki platform oldugu icin:

- CORS ve cookie ayarlari daha dikkatli yapilacak
- OAuth callback/domain yonetimi daha karmasik olacak

## 3) Go-live oncesi zorunlu checklist

- `engines.node` degerini sabitle: `20.x` (`>=20` yerine)
- Backend icin prod env tam doldur
- `npm run preflight:prod` hatasiz gecmeli
- Frontend `npm run build` hatasiz gecmeli
- OAuth callback URL'lerini prod domain'e cevir
- Canli domain + SSL aktif olmadan cookie testine gecme

## 4) Render uzerinde adim adim kurulum

### A. Altyapiyi olustur

1. Render'da **Postgres** olustur (paid plan onerilir).
2. Render'da **Key Value** olustur (paid plan onerilir).
3. Her ikisini backend ile **ayni region** sec.

### B. Backend servisini deploy et

- Service type: **Web Service**
- Root: repo koku (`/`)
- Build Command:

```bash
npm install && npm run build
```

- Start Command:

```bash
npm start
```

- Health Check path: `/ready`

#### Backend kritik env (minimum)

```env
NODE_ENV=production
PORT=3000
RUN_MIGRATIONS=true
REQUIRE_MIGRATIONS_UP_TO_DATE=true

DATABASE_URL=<Render Postgres Internal URL>
DATABASE_SSL=true

REDIS_HOST=<internal host>
REDIS_PORT=<internal port>
REDIS_PASSWORD=<varsa>
REDIS_TLS=true

JWT_SECRET=<guclu 32+>
JWT_REFRESH_SECRET=<guclu 32+>

FRONTEND_URL=https://app.senindomain.com
API_URL=https://api.senindomain.com
ALLOWED_ORIGINS=https://app.senindomain.com

REFRESH_COOKIE_SECURE=true
REFRESH_COOKIE_SAMESITE=lax
# Eger frontend ve backend farkli site ise: none

LIVEKIT_URL=<livekit wss>
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>

EMAIL_REQUIRED=false
SMS_REQUIRED=false

ENABLE_SWAGGER=false
ENABLE_PUBLIC_METRICS=false
```

> Not: SMTP simdilik acik olmayacaksa `EMAIL_REQUIRED=false` kalmali.

### C. Frontend servisini deploy et

- Service type: **Web Service**
- Root: `apps/web`
- Build Command:

```bash
npm install && npm run build
```

- Start Command:

```bash
npm start
```

#### Frontend env

```env
NEXT_PUBLIC_API_BASE_URL=https://api.senindomain.com
NEXT_PUBLIC_LIVEKIT_URL=wss://debate-mh8zwlcc.livekit.cloud
NEXT_PUBLIC_SOCKET_ROOM_PATH=/room
NEXT_PUBLIC_SOCKET_MIC_PATH=/mic
```

## 5) Domain, CORS, Cookie, OAuth sirasi

1. API domain: `api.senindomain.com` -> backend service
2. Web domain: `app.senindomain.com` -> frontend service
3. Backend env guncelle:
   - `FRONTEND_URL`
   - `API_URL`
   - `ALLOWED_ORIGINS`
4. Google/X OAuth panelinde callback URL'leri guncelle:
   - `https://api.senindomain.com/auth/oauth/google/callback`
   - `https://api.senindomain.com/auth/oauth/twitter/callback`
5. Frontend OAuth geri donus yolu backend ile uyumlu kalmali (`/oauth/callback`).

## 6) Production smoke test plani

Backend deploy sonrasi:

```bash
npm run preflight:prod
npm run smoke:infra
npm run smoke:api
```

Canli E2E:

1. Register/Login (email/password)
2. Oda olustur/join/leave
3. Iki kullanici ile realtime participant sync
4. Request Mic -> owner queue -> accept/reject
5. Unmute/mute ve ses transferi
6. OAuth login (Google + X)

## 7) Operasyon ve olcekleme

- Baslangic:
  - Backend: en az 1 paid instance
  - Postgres: daily backup
  - Redis: persistence acik
- Trafik artinca:
  - Backend'i 2+ instance scale et (Redis adapter zaten var)
  - DB connection pool ve query metriklerini izle
- Gozlemlenebilirlik:
  - `/health`, `/ready`, `/live`
  - merkezi log takibi (requestId ile)

## 8) Hangi secenegi secmelisin?

Eger hedefin **en az risk + en hizli stabil canliya cikis** ise:

- **Secim: Tum stack Render + LiveKit Cloud**

Eger hedefin frontend CDN performansini maksimumlamaksa ve ekstra operasyonu kabul ediyorsan:

- **Secim: Frontend Vercel, backend/DB/Redis Render**

---

## Referanslar

- Vercel Limits (WebSocket notu): https://vercel.com/docs/platform/limits
- Render WebSockets: https://render.com/docs/websocket
- Render Private Network: https://render.com/docs/private-network
- Render Postgres: https://render.com/docs/postgresql
- Render Key Value: https://render.com/redis
- Vercel Monorepo Root Directory: https://vercel.com/docs/monorepos/
- Railway Deployments (alternatif platform): https://docs.railway.com/deploy/deployments
