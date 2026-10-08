# NEXUS Frontend Performance Baseline

> **Baseline Timestamp**: September 2026  
> **Measurement Standard**: Recorded Only — Zero synthetic or simulated metrics.  
> **Build Target**: Production Vite Bundle (`npm run build`)  
> **Environment**: Windows 11 x64, Node.js v22+, Vite v6.4.3

---

## 1. Production Bundle Size & Chunk Distribution

*Measured directly from the production output of `vite build` targeting `dist/`:*

| Chunk File | Output Path | Raw Size (KB) | Gzip Compressed (KB) | Nature / Contents |
| :--- | :--- | :---: | :---: | :--- |
| `index.html` | `dist/index.html` | 1.94 KB | 0.82 KB | SPA root entry |
| **`index-DthEnkXH.js`** | `dist/assets/` | 325.21 KB | 91.37 KB | Core application logic, routing, preloader, layout |
| **`vendor-react-C3CMbvI9.js`** | `dist/assets/` | 217.98 KB | 69.23 KB | React, React-DOM, scheduler runtime |
| **`vendor-motion-B5liYccZ.js`** | `dist/assets/` | 135.36 KB | 45.86 KB | Motion for React (`motion/react`) runtime |
| **`index-BYQs_XKg.css`** | `dist/assets/` | 117.74 KB | 18.72 KB | Compiled Tailwind v4 styles, custom design tokens, fonts |
| `TeamPage-DhhDNv_6.js` | `dist/assets/` | 66.20 KB | 19.63 KB | Lazy-loaded Team page, directory database, profile cards |
| `ProjectsPage-Cy7Uhvm6.js` | `dist/assets/` | 57.94 KB | 13.10 KB | Lazy-loaded Linux desktop simulation and file explorer |
| `AboutPage-BM73H8db.js` | `dist/assets/` | 49.73 KB | 14.48 KB | Lazy-loaded editorial story chapters, ASCII canvas engine |
| `vendor-icons-BHLU2WS1.js` | `dist/assets/` | 20.62 KB | 4.48 KB | Lucide React icon symbols |
| `ContactPage-DqXOoEot.js` | `dist/assets/` | 12.74 KB | 3.41 KB | Lazy-loaded Contact page form and submission logic |
| `TeamPage-DeBWt_H_.css` | `dist/assets/` | 9.71 KB | 2.78 KB | 3D holographic ProfileCard perspective and glare styles |
| `GalleryPage-CMEOQzuL.js` | `dist/assets/` | 9.50 KB | 3.26 KB | Lazy-loaded photo gallery grid |
| `ColorBends-2-UqB_ch.js` | `dist/assets/` | 9.13 KB | 3.68 KB | Three.js / WebGL shader background |
| **TOTAL (JS + CSS)** | | **1,025.79 KB** | **~288.82 KB** | **Complete production bundle footprint** |

---

## 2. Asset Weight Inventory

### Image Assets (Canonical Source: `images/`)

| Directory | File Count | Raw Weight (KB / MB) | Primary File Formats | Optimization Opportunity |
| :--- | :---: | :---: | :---: | :--- |
| **`images/eid/`** | 2 | **11,031.2 KB (11.03 MB)** | `.png` | **Critical**: High-res uncompressed PNG textures (`nexus-card-theme.png` is 6.1 MB, `nexus-card-back-theme.png` is 4.9 MB). WebP conversion will achieve ~90% reduction. |
| **`images/team/`** | 31 | **2,897.8 KB (2.90 MB)** | `.webp`, `.png`, `.jpeg` | Student portraits. Mostly optimized WebP (~70 KB avg), with 3 unoptimized JPEG/PNGs (`Imtiaz_Allam.jpeg`, `siba-hoops.png`). |
| **`images/events/`** | 4 | **2,650.7 KB (2.65 MB)** | `.png`, `.jpg` | Uncompressed event photography (`event-coding-ninjas.png`, `event-faculty.png`, `event-speaker.png`). |
| **`images/gallery/`** | 9 | **446.4 KB (0.45 MB)** | `.webp` | Fully converted WebP gallery images (~50 KB avg). |
| **`images/misc/`** | 26 | **248.8 KB (0.25 MB)** | `.png`, `.jpg` | Mascot penguin sprite animation frames (small pixel art). |
| **`images/logos/`** | 8 | **201.9 KB (0.20 MB)** | `.png`, `.svg` | Community branding marks and partner logos. |
| **`images/projects/`** | 6 | **42.2 KB (0.04 MB)** | `.svg` | Vector diagram illustrations. |
| **TOTAL IMAGES** | **86** | **17,519.0 KB (17.11 MB)** | | **Converting `images/eid/` and `images/events/` will drop total image weight below 4.5 MB.** |

---

## 3. Dependency Footprint

*Measured from `package.json` manifest files:*

| Scope | Category | Count | Notable Packages |
| :--- | :--- | :---: | :--- |
| **Root Runtime** | Dependencies | 17 | `react`, `react-dom`, `motion`, `lucide-react`, `tailwindcss`, `clsx`, `tailwind-merge`, `three` *(unused)*, `@paper-design/shaders` *(unused)* |
| **Root Build** | DevDependencies | 10 | `vite`, `typescript`, `tsx`, `esbuild`, `sharp`, `autoprefixer`, `vite-plugin-static-copy` |
| **Eid-card/ui** | Dependencies | 11 | `react`, `react-dom`, `motion`, `lucide-react`, `qrcode`, `html-to-image`, `@google/genai` *(unused)* |
| **Eid-card/ui** | DevDependencies | 9 | `vite`, `typescript`, `tsx`, `tailwindcss` |

### Unused Dependency Cost:
- `three` & `@types/three`: ~2.5 MB disk weight in `node_modules`. Contributes 0 bytes to bundle because it is unreferenced, but adds install latency and chunk configuration clutter.
- `@paper-design/shaders` & `@paper-design/shaders-react`: Unused runtime dependencies.
- `@google/genai`: Unused AI dependency in `Eid-card/ui`.

---

## 4. Network Request & Font Overhead

*Measured from DOM headers in `frontend/index.html`:*

1. **Google Fonts (`fonts.googleapis.com`)**:
   - `Bitter` (weights 300–800, italic)
   - `Dosis` (weights 400–800)
   - `Fraunces` (weights 300–900, optical size 9–144)
   - *Network cost*: 2 initial HTTP roundtrips (preconnect to `fonts.googleapis.com` and `fonts.gstatic.com`).
2. **External Render-Blocking Font CDN (`db.onlinewebfonts.com`)**:
   - `<link href="https://db.onlinewebfonts.com/c/088f292cf151a6e496fc8cdc5441b3e3?family=Lovelo-Black" rel="stylesheet">`
   - *Network cost*: Resolves third-party DNS `db.onlinewebfonts.com` without preconnect. If the remote CDN has high TTFB, the browser holds First Contentful Paint.

---

## 5. Animation & Runtime Measurement

*Measured via static code pattern scan across active frontend files:*

| Metric / Pattern | Occurrences | High-Frequency Hotspots | Impact on Client |
| :--- | :---: | :--- | :--- |
| **`requestAnimationFrame` Loops** | 14 components | `MetallicPaint.tsx` (continuous WebGL loop), `ProfileCard.tsx` (tilt RAF), `AboutScrollManager.tsx` | Constant GPU/CPU usage on low-end hardware if running in background. |
| **`getBoundingClientRect()` Calls** | 5 components | `Hero.tsx` (5 calls), `AboutScrollManager.tsx` (3 calls), `FinalCTA.tsx` (2 calls), `Button.tsx` (2 calls) | **Forced synchronous layout reflow** when called inside rapid event handlers. |
| **Active Scroll Listeners** | 5 components | `Hero.tsx`, `AboutScrollManager.tsx`, `NexusStoryScroll.tsx`, `Navbar.tsx`, `MemberProfilePage.tsx` | Layout thrashing if not throttled with `requestAnimationFrame`. |
| **Global Mousemove Listeners** | 3 components | `ContextCursor.tsx`, `MetallicPaint.tsx`, `MorphSlider.tsx` | High-frequency events (up to 1000/sec) updating React state. |
| **Timers (`setTimeout` / `setInterval`)** | 8 components | `InteractiveFooterPenguin.tsx` (7 timeouts, 1 cleanup) | **Memory Leak**: 6 timers survive component unmount. |

---

## 6. Client Architecture Summary

- **Rendering Mode**: Single-Page Application (SPA) client-side rendered via Vite + React 19.
- **Hydration Cost**: N/A (No SSR hydration mismatch overhead; pure client DOM mounting).
- **Code Splitting**: Routes (`AboutPage`, `ProjectsPage`, `GalleryPage`, `TeamPage`, `ContactPage`) are code-split using `React.lazy()` and `Suspense`, ensuring initial load only transfers `index-DthEnkXH.js` (91 KB gzip) and `vendor-react` (69 KB gzip).
