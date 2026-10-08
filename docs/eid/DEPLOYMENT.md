# NEXUS E-ID: Deployment & Operations Guide

This guide covers environment configuration, production builds, reverse proxy setups, and operational verification checks for the NEXUS E-ID system.

---

## 1. Runtime Requirements

- **Node.js**: `v20.x` or `v22.x` LTS
- **Package Manager**: `npm` (v10+)
- **Database**: SQLite3 (native Node.js `node:sqlite` or SQLite file `data/nexus.db`)
- **Ports**:
  - `3001`: Express Backend API
  - `3000`: Main Website Frontend (Vite)
  - `3002`: E-ID Dynamic Frontend (Vite)

---

## 2. Environment Variables

### Backend (`nexus-i8-/.env`):
```ini
# Application Mode
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# API Settings
API_PREFIX=/api
CORS_ALLOWED_ORIGINS=https://nexusopen.dev,http://localhost:3000,http://localhost:3002

# Media Storage
MEDIA_STORAGE_DRIVER=local
MEDIA_STORAGE_LOCAL_DIR=./data/media
```

### E-ID Frontend (`Eid-card/ui/.env`):
```ini
# API Gateway Target
VITE_API_BASE_URL=http://localhost:3001
```

---

## 3. Production Build Pipeline

### Step 1: Build the Main Application & Apply Migrations
```bash
cd nexus-i8-
npm run db:migrate
npm run db:seed
npm run db:import:eid
npm run build
```

### Step 2: Build the E-ID Frontend
```bash
cd Eid-card/ui
npm install
npm run build
```
The compiled SPA bundle will be written to `Eid-card/ui/dist/`.

---

## 4. Reverse Proxy Configuration (Nginx Example)

In production environments, both the main site and the E-ID system should be unified under the domain `nexusopen.dev`:

```nginx
server {
    listen 443 ssl http2;
    server_name nexusopen.dev;

    # 1. Main Website Frontend
    location / {
        root /var/www/nexus/main/dist;
        try_files $uri $uri/ /index.html;
    }

    # 2. Dynamic Public E-ID Routing
    location /memberID/ {
        root /var/www/nexus/eid/dist;
        try_files $uri $uri/ /index.html;
    }

    # 3. Backend API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 4. Static Team Images
    location /images/team/ {
        alias /var/www/nexus/images/team/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 5. Post-Deployment Smoke Test Checklist

- [ ] `GET /api/health` returns HTTP 200 `{ "status": "ok" }`.
- [ ] `GET /api/eid/members/NX-026` returns valid DTO for Orosmit Mishra.
- [ ] Direct navigation to `/memberID/orosmit-mishra/NX-026` loads without white screen.
- [ ] Flipping card displays QR code with URL matching the browser URL bar.
- [ ] Accessing invalid ID `/memberID/unknown/NX-999` renders styled 404 state without crashing.
