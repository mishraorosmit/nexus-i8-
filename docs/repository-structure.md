# Repository Structure & Asset Architecture

This document defines the structural layout of the `nexus-i8-` repository and the authoritative conventions for frontend applications, backend services, and static assets.

---

## 1. High-Level Architecture

The repository integrates both the primary NEXUS website and the official NEXUS E-ID Card platform within a single monorepo:

```
nexus-i8/
├── frontend/                  # Main NEXUS website application (React + Vite)
│   ├── src/                   # Main website UI source code
│   │   ├── components/        # Navigation, pages, showcases, and design primitives
│   │   ├── context/           # App state, themes, motion contexts
│   │   └── data/              # Static club datasets and metadata
│   ├── public/                # Public assets served at website root
│   └── index.html             # Main website HTML entry point
│
├── Eid-card/                  # Official NEXUS E-ID Card platform
│   ├── data/                  # Authoritative dataset (members.json)
│   └── ui/                    # E-ID frontend application (React + Vite)
│       ├── src/               # Dynamic card rendering engine, QR generation, canvas export
│       └── index.html         # E-ID web application entry point
│
├── backend/                   # NEXUS REST API & Database engine (Express + SQLite)
│   ├── api/                   # Public and admin route controllers
│   ├── db/                    # Migrations, seeders, and repository layer
│   └── tests/                 # Automated test suites (admin, media, hardening, eid)
│
├── images/                    # THE SINGLE CANONICAL IMAGE REPOSITORY
│   ├── team/                  # Member portraits (WebP format, kebab-case)
│   ├── gallery/               # Club photo showcase and event highlights
│   ├── projects/              # Project visual assets and thumbnails
│   ├── events/                # Event posters and banners
│   ├── eid/                   # E-ID theme textures, card skins, badges
│   ├── logos/                 # NEXUS and partner SVG/PNG logos
│   └── misc/                  # Mascot sprites, icons, and illustrations
│
├── scripts/                   # Migration, sync, optimization, and dataset utilities
├── docs/                      # Architectural documentation and migration records
└── dist/                      # Production build output directory
```

---

## 2. Main Website & E-ID Locations

- **Main Website**: Located at `frontend/` (entry point `frontend/index.html`, source in `frontend/src/`).
- **E-ID Application**: Located at `Eid-card/ui/` (entry point `Eid-card/ui/index.html`, source in `Eid-card/ui/src/`).
- **E-ID Data**: Authoritative member records live at `Eid-card/data/members.json`.

---

## 3. Canonical Image Repository (`/images/`)

There is **EXACTLY ONE** canonical image repository in the entire codebase:

```
/images/
```

### Folder Conventions

| Folder | Content | Format / Spec |
| :--- | :--- | :--- |
| `/images/team/` | Member portraits for all active, mentor, and coordinator crew | `.webp` (recommended 800x800px, kebab-case `first-last.webp`) |
| `/images/gallery/` | High-resolution photography of club activities and exhibitions | `.webp` (optimized 1440px wide) |
| `/images/projects/` | Screenshots, mockups, and diagrams of club projects | `.webp` / `.png` |
| `/images/events/` | Event promotional art, session graphics, and posters | `.webp` / `.png` |
| `/images/eid/` | E-ID card backgrounds, tactile holograms, foil overlays | `.png` / `.webp` |
| `/images/logos/` | Official NEXUS, university, sponsor, and partner logos | `.svg` / `.png` |
| `/images/misc/` | Mascot animation sprites (e.g. penguin frames) and ASCII art | `.png` / `.webp` / `.jpg` |

### Explicit Rule: No Duplicate Image Repositories

> [!IMPORTANT]
> **NEVER** create a new image folder anywhere else in the repository (e.g., `frontend/public/images/`, `Eid-card/ui/public/images/`, `assets/images/`, or `static/images/`).
>
> All image assets across both applications **must** be stored directly in `/images/`.

---

## 4. How Applications Reference Shared Images

Both Vite applications are configured to seamlessly serve images from `/images/` in both development and production:

### In Source Code
All components, CSS, and database entries reference images using absolute paths starting with `/images/`:

```tsx
// Team profile portrait
<img src="/images/team/orosmit-mishra.webp" alt="Orosmit Mishra" />

// E-ID card holographic background
<div style={{ backgroundImage: 'url("/images/eid/nexus-card-theme.png")' }} />

// Club logo
<img src="/images/logos/nexus-logo.svg" alt="NEXUS" />
```

### Development Mode Resolution
Both `vite.config.ts` (main site) and `Eid-card/ui/vite.config.ts` configure:
- `publicDir`: points to the canonical `/images/` directory or serves it via Vite's static asset pipeline.
- Express backend / Vite dev server middleware serves `/images/*` requests directly from the root `/images/` directory.

### Production Build (`dist/images/`)
During production build (`vite build`), both applications use `vite-plugin-static-copy` to copy all assets from the root `/images/` directory directly into the build output:

```typescript
// vite.config.ts
viteStaticCopy({
  targets: [
    {
      src: normalizePath(path.resolve(__dirname, 'images')) + '/**/*',
      dest: '', // copies into dist/images/...
    },
  ],
})
```

Resulting in:
```
dist/
├── index.html
├── assets/
└── images/
    ├── team/
    ├── gallery/
    ├── projects/
    ├── events/
    ├── eid/
    ├── logos/
    └── misc/
```

---

## 5. Adding New Images (Developer Guide)

When adding new image assets:

1. **Place the file in `/images/<category>/`**:
   - For a member photo: save to `/images/team/first-last.webp`
   - For a project banner: save to `/images/projects/project-name.webp`
   - For a gallery photo: save to `/images/gallery/gallery-XX.webp`
2. **Naming Convention**:
   - Use strictly lowercase alphanumeric characters with hyphens: `[a-z0-9-]+.[ext]`.
   - Prefer modern web formats (`.webp` for photos, `.svg` for vector art, `.png` for transparency).
3. **Reference in Code**:
   - Always reference as `/images/<category>/<filename>`.
   - Never use relative traversal (`../../images/...`) in frontend components.
4. **Validation**:
   - Run `npm run lint` and `npm test` to ensure no broken references.
   - Run `npm run build` to confirm static copy picks up the new assets.
