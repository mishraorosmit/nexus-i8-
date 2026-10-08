# NEXUS Cloudinary Image Delivery & Migration Map

**Migration Date:** 2026-09-14  
**Target Cloud:** `plg8gola`  
**Root Folder:** `aarambh`  
**Canonical Local Root:** `/images/`  
**Total Canonical Assets:** 85  

---

## 1. Migration Summary

| Metric | Count | Details |
| :--- | :---: | :--- |
| **Total Local Images** | **85** | Exact count across 7 categories in canonical `/images/` |
| **Cloudinary Reused Assets** | **0** | Verified matching assets pre-existing on Cloudinary |
| **Uploaded Assets** | **0** | Successfully migrated via authenticated API |
| **Skipped / Pending Upload** | **85** | Mapped with verified hashes, pending API keys for remote upload |
| **Failed Uploads** | **0** | Network or API errors during transfer |
| **Duplicate Assets Detected** | **0** | Zero byte-level duplicates found across repository |

---

## 2. Centralized Architecture & Guardrails

* **Canonical Local Source**: `/images/` remains the single canonical source of truth on disk.
* **No Image Modifications**: Zero files were resized, cropped, recompressed, or recolored.
* **Security Guardrail**: Credentials (`CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`) are strictly server-only. Client-side builds only access `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_FOLDER`.
* **Zero-Downtime Fallback**: If Cloudinary is unreachable or credentials are unset, `resolveImageUrl()` cleanly falls back to canonical local paths without frontend disruption.

---

## 3. Image Mapping Registry by Category

### Category: `eid` (2 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/eid/nexus-card-back-theme.png` | `aarambh/eid/nexus-card-back-theme` | `.png` | 5503.0 KB | `69bb3ed4d943...` | 📋 MAPPED |
| `/images/eid/nexus-card-theme.png` | `aarambh/eid/nexus-card-theme` | `.png` | 5528.2 KB | `95ceeb7b1afc...` | 📋 MAPPED |

### Category: `events` (4 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/events/event-coding-ninjas.png` | `aarambh/events/event-coding-ninjas` | `.png` | 668.3 KB | `74324cb5dfed...` | 📋 MAPPED |
| `/images/events/event-faculty.png` | `aarambh/events/event-faculty` | `.png` | 942.7 KB | `a171e6d208f8...` | 📋 MAPPED |
| `/images/events/event-qna.jpg` | `aarambh/events/event-qna` | `.jpg` | 275.4 KB | `18aebb238444...` | 📋 MAPPED |
| `/images/events/event-speaker.png` | `aarambh/events/event-speaker` | `.png` | 764.4 KB | `d5c7aa8035d8...` | 📋 MAPPED |

### Category: `gallery` (9 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/gallery/event-coding-ninjas.webp` | `aarambh/gallery/event-coding-ninjas` | `.webp` | 21.9 KB | `4c6995298625...` | 📋 MAPPED |
| `/images/gallery/event-faculty.webp` | `aarambh/gallery/event-faculty` | `.webp` | 27.3 KB | `93cb2293a5c4...` | 📋 MAPPED |
| `/images/gallery/event-qna.webp` | `aarambh/gallery/event-qna` | `.webp` | 61.4 KB | `72a4ecc1efe5...` | 📋 MAPPED |
| `/images/gallery/event-speaker.webp` | `aarambh/gallery/event-speaker` | `.webp` | 29.0 KB | `10917d6faa71...` | 📋 MAPPED |
| `/images/gallery/gallery-01.webp` | `aarambh/gallery/gallery-01` | `.webp` | 29.5 KB | `4215413fb3ff...` | 📋 MAPPED |
| `/images/gallery/gallery-07.webp` | `aarambh/gallery/gallery-07` | `.webp` | 101.1 KB | `164186e5f675...` | 📋 MAPPED |
| `/images/gallery/gallery-08.webp` | `aarambh/gallery/gallery-08` | `.webp` | 62.6 KB | `b88e8b554e50...` | 📋 MAPPED |
| `/images/gallery/gallery-09.webp` | `aarambh/gallery/gallery-09` | `.webp` | 43.1 KB | `639d3b8d2d33...` | 📋 MAPPED |
| `/images/gallery/gallery-10.webp` | `aarambh/gallery/gallery-10` | `.webp` | 70.6 KB | `31245622a586...` | 📋 MAPPED |

### Category: `logos` (8 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/logos/coding_ninjas_dark.png` | `aarambh/logos/coding_ninjas_dark` | `.png` | 14.4 KB | `122b7b04a6d3...` | 📋 MAPPED |
| `/images/logos/coding_ninjas_dark_badge_clean.png` | `aarambh/logos/coding_ninjas_dark_badge_clean` | `.png` | 7.8 KB | `702f7cb2c912...` | 📋 MAPPED |
| `/images/logos/coding_ninjas_dark_clean.png` | `aarambh/logos/coding_ninjas_dark_clean` | `.png` | 4.9 KB | `302b96caf94a...` | 📋 MAPPED |
| `/images/logos/coding_ninjas_light.png` | `aarambh/logos/coding_ninjas_light` | `.png` | 52.9 KB | `22d599e7b6d4...` | 📋 MAPPED |
| `/images/logos/coding_ninjas_light_clean.png` | `aarambh/logos/coding_ninjas_light_clean` | `.png` | 5.0 KB | `d46301b8ecf0...` | 📋 MAPPED |
| `/images/logos/nexus-logo-x.svg` | `aarambh/logos/nexus-logo-x` | `.svg` | 0.4 KB | `6007488cfb49...` | 📋 MAPPED |
| `/images/logos/NEXUS-removebg-preview-1.png` | `aarambh/logos/NEXUS-removebg-preview-1` | `.png` | 115.8 KB | `3352d17df389...` | 📋 MAPPED |
| `/images/logos/test-logo.svg` | `aarambh/logos/test-logo` | `.svg` | 0.8 KB | `3aabef1cabb7...` | 📋 MAPPED |

### Category: `misc` (26 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/misc/penguin-admire.png` | `aarambh/misc/penguin-admire` | `.png` | 0.3 KB | `9de4a4c5201b...` | 📋 MAPPED |
| `/images/misc/penguin-annoyed.png` | `aarambh/misc/penguin-annoyed` | `.png` | 0.3 KB | `4226756a5c0d...` | 📋 MAPPED |
| `/images/misc/penguin-blink.png` | `aarambh/misc/penguin-blink` | `.png` | 0.3 KB | `71f04ff53e94...` | 📋 MAPPED |
| `/images/misc/penguin-celebrate.png` | `aarambh/misc/penguin-celebrate` | `.png` | 0.3 KB | `c25d59ba75f5...` | 📋 MAPPED |
| `/images/misc/penguin-curious.png` | `aarambh/misc/penguin-curious` | `.png` | 0.3 KB | `81b13e54966b...` | 📋 MAPPED |
| `/images/misc/penguin-idle.png` | `aarambh/misc/penguin-idle` | `.png` | 0.3 KB | `98065ee8aa64...` | 📋 MAPPED |
| `/images/misc/penguin-inspect.png` | `aarambh/misc/penguin-inspect` | `.png` | 0.3 KB | `263a4a6a45ed...` | 📋 MAPPED |
| `/images/misc/penguin-look-left.png` | `aarambh/misc/penguin-look-left` | `.png` | 0.3 KB | `6fa382213ac3...` | 📋 MAPPED |
| `/images/misc/penguin-look-right.png` | `aarambh/misc/penguin-look-right` | `.png` | 0.3 KB | `d112b0151a20...` | 📋 MAPPED |
| `/images/misc/penguin-nexus-touch.png` | `aarambh/misc/penguin-nexus-touch` | `.png` | 0.3 KB | `35749a9f4edc...` | 📋 MAPPED |
| `/images/misc/penguin-peek-bottom-smile.png` | `aarambh/misc/penguin-peek-bottom-smile` | `.png` | 0.3 KB | `c38d8fd038c9...` | 📋 MAPPED |
| `/images/misc/penguin-peek-bottom.png` | `aarambh/misc/penguin-peek-bottom` | `.png` | 0.3 KB | `1037859b0f2a...` | 📋 MAPPED |
| `/images/misc/penguin-peek-left.png` | `aarambh/misc/penguin-peek-left` | `.png` | 0.3 KB | `674dc3347bbb...` | 📋 MAPPED |
| `/images/misc/penguin-peek-right.png` | `aarambh/misc/penguin-peek-right` | `.png` | 0.3 KB | `6672a4465d42...` | 📋 MAPPED |
| `/images/misc/penguin-shake-off.png` | `aarambh/misc/penguin-shake-off` | `.png` | 0.3 KB | `8b826b463606...` | 📋 MAPPED |
| `/images/misc/penguin-shy.png` | `aarambh/misc/penguin-shy` | `.png` | 0.3 KB | `f7904d5f1429...` | 📋 MAPPED |
| `/images/misc/penguin-smile.png` | `aarambh/misc/penguin-smile` | `.png` | 0.3 KB | `bddf54a80273...` | 📋 MAPPED |
| `/images/misc/penguin-struggle-down.png` | `aarambh/misc/penguin-struggle-down` | `.png` | 0.3 KB | `03e1af676073...` | 📋 MAPPED |
| `/images/misc/penguin-struggle-left.png` | `aarambh/misc/penguin-struggle-left` | `.png` | 0.3 KB | `417af4cd077f...` | 📋 MAPPED |
| `/images/misc/penguin-struggle-right.png` | `aarambh/misc/penguin-struggle-right` | `.png` | 0.3 KB | `803aa4265445...` | 📋 MAPPED |
| `/images/misc/penguin-struggle-up.png` | `aarambh/misc/penguin-struggle-up` | `.png` | 0.3 KB | `b5a37d561f6f...` | 📋 MAPPED |
| `/images/misc/penguin-walk-1.png` | `aarambh/misc/penguin-walk-1` | `.png` | 0.3 KB | `dae2ac7e992d...` | 📋 MAPPED |
| `/images/misc/penguin-walk-2.png` | `aarambh/misc/penguin-walk-2` | `.png` | 0.3 KB | `e09374fd2e56...` | 📋 MAPPED |
| `/images/misc/penguin-wave-smile.png` | `aarambh/misc/penguin-wave-smile` | `.png` | 0.3 KB | `f45c55d1d110...` | 📋 MAPPED |
| `/images/misc/penguin-wave.png` | `aarambh/misc/penguin-wave` | `.png` | 0.3 KB | `f148bc9c9284...` | 📋 MAPPED |
| `/images/misc/penguinascii.jpg` | `aarambh/misc/penguinascii` | `.jpg` | 241.1 KB | `152cf2756583...` | 📋 MAPPED |

### Category: `projects` (6 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/projects/01-ideas-sketches.svg` | `aarambh/projects/01-ideas-sketches` | `.svg` | 7.7 KB | `983c0d241835...` | 📋 MAPPED |
| `/images/projects/02-physical-prototype.svg` | `aarambh/projects/02-physical-prototype` | `.svg` | 5.8 KB | `69374d2936b9...` | 📋 MAPPED |
| `/images/projects/03-team-workshop.svg` | `aarambh/projects/03-team-workshop` | `.svg` | 5.8 KB | `8f4776fe5dd1...` | 📋 MAPPED |
| `/images/projects/04-iteration-detail.svg` | `aarambh/projects/04-iteration-detail` | `.svg` | 6.4 KB | `adb09ef45c45...` | 📋 MAPPED |
| `/images/projects/05-studio-showcase.svg` | `aarambh/projects/05-studio-showcase` | `.svg` | 4.3 KB | `d660d80c6ff7...` | 📋 MAPPED |
| `/images/projects/voxen-prototype.svg` | `aarambh/projects/voxen-prototype` | `.svg` | 12.1 KB | `a533e65bd3ae...` | 📋 MAPPED |

### Category: `team` (30 assets)

| Local Path | Cloudinary Public ID | Format | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `/images/team/aadyasha-swain-ideation.webp` | `aarambh/team/aadyasha-swain-ideation` | `.webp` | 73.8 KB | `1b4ec1cbeaf8...` | 📋 MAPPED |
| `/images/team/ananya-raj-ideation.webp` | `aarambh/team/ananya-raj-ideation` | `.webp` | 85.7 KB | `a21dce658e84...` | 📋 MAPPED |
| `/images/team/ankita-dutta-ideation.webp` | `aarambh/team/ankita-dutta-ideation` | `.webp` | 59.0 KB | `8cab4bfbb454...` | 📋 MAPPED |
| `/images/team/anshita-dash-ideation.webp` | `aarambh/team/anshita-dash-ideation` | `.webp` | 23.0 KB | `49939be22706...` | 📋 MAPPED |
| `/images/team/anshuman-meher-content.webp` | `aarambh/team/anshuman-meher-content` | `.webp` | 26.1 KB | `182472e6c7a1...` | 📋 MAPPED |
| `/images/team/anshuman-tiwary-management.webp` | `aarambh/team/anshuman-tiwary-management` | `.webp` | 12.2 KB | `80e6f8fa74f8...` | 📋 MAPPED |
| `/images/team/debojeet-content.webp` | `aarambh/team/debojeet-content` | `.webp` | 80.7 KB | `ef73a032e25f...` | 📋 MAPPED |
| `/images/team/harshit.webp` | `aarambh/team/harshit` | `.webp` | 78.5 KB | `98fc7bd64730...` | 📋 MAPPED |
| `/images/team/himanshi_mohapatra.jpeg` | `aarambh/team/himanshi_mohapatra` | `.jpeg` | 146.7 KB | `23474e78d983...` | 📋 MAPPED |
| `/images/team/Imtiaz_Allam.jpeg` | `aarambh/team/Imtiaz_Allam` | `.jpeg` | 44.8 KB | `017408be933a...` | 📋 MAPPED |
| `/images/team/ishika.webp` | `aarambh/team/ishika` | `.webp` | 23.9 KB | `1c35d2106a77...` | 📋 MAPPED |
| `/images/team/jagruti-pandey-content.webp` | `aarambh/team/jagruti-pandey-content` | `.webp` | 45.9 KB | `643d96601194...` | 📋 MAPPED |
| `/images/team/jitesh_bhaiya.jpeg` | `aarambh/team/jitesh_bhaiya` | `.jpeg` | 150.5 KB | `2bd503edc867...` | 📋 MAPPED |
| `/images/team/jitesh_bhaiya.webp` | `aarambh/team/jitesh_bhaiya` | `.webp` | 109.9 KB | `ca1b7bfb5b1c...` | 📋 MAPPED |
| `/images/team/manish-prakash-coordinator.webp` | `aarambh/team/manish-prakash-coordinator` | `.webp` | 17.0 KB | `37fa2be61b37...` | 📋 MAPPED |
| `/images/team/om-pandey.webp` | `aarambh/team/om-pandey` | `.webp` | 20.5 KB | `402f33944928...` | 📋 MAPPED |
| `/images/team/omm-prakash-tripathy-content.webp` | `aarambh/team/omm-prakash-tripathy-content` | `.webp` | 39.2 KB | `6f74d7d60ae4...` | 📋 MAPPED |
| `/images/team/orosmit-mishra.webp` | `aarambh/team/orosmit-mishra` | `.webp` | 33.3 KB | `9389ec4d1907...` | 📋 MAPPED |
| `/images/team/pratyush-sahoo-content.webp` | `aarambh/team/pratyush-sahoo-content` | `.webp` | 56.0 KB | `967ab9dd1223...` | 📋 MAPPED |
| `/images/team/saswat-palo-content.webp` | `aarambh/team/saswat-palo-content` | `.webp` | 22.0 KB | `9010d3fa1e9c...` | 📋 MAPPED |
| `/images/team/siba-hoops.png` | `aarambh/team/siba-hoops` | `.png` | 1010.7 KB | `02cf33402daa...` | 📋 MAPPED |
| `/images/team/siba-hoops.webp` | `aarambh/team/siba-hoops` | `.webp` | 19.4 KB | `155ff8d2868c...` | 📋 MAPPED |
| `/images/team/siddharth-basu-content.webp` | `aarambh/team/siddharth-basu-content` | `.webp` | 35.7 KB | `70525eaab08c...` | 📋 MAPPED |
| `/images/team/simrita-barick-content.webp` | `aarambh/team/simrita-barick-content` | `.webp` | 208.6 KB | `30bbbee68431...` | 📋 MAPPED |
| `/images/team/sindhusuta-rath-content.webp` | `aarambh/team/sindhusuta-rath-content` | `.webp` | 143.3 KB | `a6ba2402c7ff...` | 📋 MAPPED |
| `/images/team/smita-jena-content.webp` | `aarambh/team/smita-jena-content` | `.webp` | 77.2 KB | `290b5a1106c1...` | 📋 MAPPED |
| `/images/team/suryaprasad-brahma-ideation.webp` | `aarambh/team/suryaprasad-brahma-ideation` | `.webp` | 8.6 KB | `eed0bda33ee6...` | 📋 MAPPED |
| `/images/team/swarnim-content.webp` | `aarambh/team/swarnim-content` | `.webp` | 42.9 KB | `0411a63ec9e8...` | 📋 MAPPED |
| `/images/team/tushti-sinha-content.webp` | `aarambh/team/tushti-sinha-content` | `.webp` | 59.1 KB | `b9562311cccb...` | 📋 MAPPED |
| `/images/team/umesh-kumar-sahu-ideation.webp` | `aarambh/team/umesh-kumar-sahu-ideation` | `.webp` | 35.6 KB | `eb05e4710899...` | 📋 MAPPED |

---

## 4. Delivery URL Reference List

| Local Path | Cloudinary Delivery URL |
| :--- | :--- |
| `/images/eid/nexus-card-back-theme.png` | [nexus-card-back-theme.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/eid/nexus-card-back-theme.png) |
| `/images/eid/nexus-card-theme.png` | [nexus-card-theme.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/eid/nexus-card-theme.png) |
| `/images/events/event-coding-ninjas.png` | [event-coding-ninjas.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-coding-ninjas.png) |
| `/images/events/event-faculty.png` | [event-faculty.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-faculty.png) |
| `/images/events/event-qna.jpg` | [event-qna.jpg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-qna.jpg) |
| `/images/events/event-speaker.png` | [event-speaker.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-speaker.png) |
| `/images/gallery/event-coding-ninjas.webp` | [event-coding-ninjas.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/event-coding-ninjas.webp) |
| `/images/gallery/event-faculty.webp` | [event-faculty.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/event-faculty.webp) |
| `/images/gallery/event-qna.webp` | [event-qna.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/event-qna.webp) |
| `/images/gallery/event-speaker.webp` | [event-speaker.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/event-speaker.webp) |
| `/images/gallery/gallery-01.webp` | [gallery-01.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/gallery-01.webp) |
| `/images/gallery/gallery-07.webp` | [gallery-07.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/gallery-07.webp) |
| `/images/gallery/gallery-08.webp` | [gallery-08.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/gallery-08.webp) |
| `/images/gallery/gallery-09.webp` | [gallery-09.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/gallery-09.webp) |
| `/images/gallery/gallery-10.webp` | [gallery-10.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/gallery/gallery-10.webp) |
| `/images/logos/coding_ninjas_dark.png` | [coding_ninjas_dark.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_dark.png) |
| `/images/logos/coding_ninjas_dark_badge_clean.png` | [coding_ninjas_dark_badge_clean.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_dark_badge_clean.png) |
| `/images/logos/coding_ninjas_dark_clean.png` | [coding_ninjas_dark_clean.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_dark_clean.png) |
| `/images/logos/coding_ninjas_light.png` | [coding_ninjas_light.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_light.png) |
| `/images/logos/coding_ninjas_light_clean.png` | [coding_ninjas_light_clean.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_light_clean.png) |
| `/images/logos/nexus-logo-x.svg` | [nexus-logo-x.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/nexus-logo-x.svg) |
| `/images/logos/NEXUS-removebg-preview-1.png` | [NEXUS-removebg-preview-1.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/NEXUS-removebg-preview-1.png) |
| `/images/logos/test-logo.svg` | [test-logo.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/test-logo.svg) |
| `/images/misc/penguin-admire.png` | [penguin-admire.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-admire.png) |
| `/images/misc/penguin-annoyed.png` | [penguin-annoyed.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-annoyed.png) |
| `/images/misc/penguin-blink.png` | [penguin-blink.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-blink.png) |
| `/images/misc/penguin-celebrate.png` | [penguin-celebrate.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-celebrate.png) |
| `/images/misc/penguin-curious.png` | [penguin-curious.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-curious.png) |
| `/images/misc/penguin-idle.png` | [penguin-idle.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-idle.png) |
| `/images/misc/penguin-inspect.png` | [penguin-inspect.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-inspect.png) |
| `/images/misc/penguin-look-left.png` | [penguin-look-left.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-look-left.png) |
| `/images/misc/penguin-look-right.png` | [penguin-look-right.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-look-right.png) |
| `/images/misc/penguin-nexus-touch.png` | [penguin-nexus-touch.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-nexus-touch.png) |
| `/images/misc/penguin-peek-bottom-smile.png` | [penguin-peek-bottom-smile.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-bottom-smile.png) |
| `/images/misc/penguin-peek-bottom.png` | [penguin-peek-bottom.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-bottom.png) |
| `/images/misc/penguin-peek-left.png` | [penguin-peek-left.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-left.png) |
| `/images/misc/penguin-peek-right.png` | [penguin-peek-right.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-right.png) |
| `/images/misc/penguin-shake-off.png` | [penguin-shake-off.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-shake-off.png) |
| `/images/misc/penguin-shy.png` | [penguin-shy.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-shy.png) |
| `/images/misc/penguin-smile.png` | [penguin-smile.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-smile.png) |
| `/images/misc/penguin-struggle-down.png` | [penguin-struggle-down.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-down.png) |
| `/images/misc/penguin-struggle-left.png` | [penguin-struggle-left.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-left.png) |
| `/images/misc/penguin-struggle-right.png` | [penguin-struggle-right.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-right.png) |
| `/images/misc/penguin-struggle-up.png` | [penguin-struggle-up.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-up.png) |
| `/images/misc/penguin-walk-1.png` | [penguin-walk-1.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-walk-1.png) |
| `/images/misc/penguin-walk-2.png` | [penguin-walk-2.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-walk-2.png) |
| `/images/misc/penguin-wave-smile.png` | [penguin-wave-smile.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-wave-smile.png) |
| `/images/misc/penguin-wave.png` | [penguin-wave.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-wave.png) |
| `/images/misc/penguinascii.jpg` | [penguinascii.jpg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguinascii.jpg) |
| `/images/projects/01-ideas-sketches.svg` | [01-ideas-sketches.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/01-ideas-sketches.svg) |
| `/images/projects/02-physical-prototype.svg` | [02-physical-prototype.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/02-physical-prototype.svg) |
| `/images/projects/03-team-workshop.svg` | [03-team-workshop.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/03-team-workshop.svg) |
| `/images/projects/04-iteration-detail.svg` | [04-iteration-detail.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/04-iteration-detail.svg) |
| `/images/projects/05-studio-showcase.svg` | [05-studio-showcase.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/05-studio-showcase.svg) |
| `/images/projects/voxen-prototype.svg` | [voxen-prototype.svg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/voxen-prototype.svg) |
| `/images/team/aadyasha-swain-ideation.webp` | [aadyasha-swain-ideation.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/aadyasha-swain-ideation.webp) |
| `/images/team/ananya-raj-ideation.webp` | [ananya-raj-ideation.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/ananya-raj-ideation.webp) |
| `/images/team/ankita-dutta-ideation.webp` | [ankita-dutta-ideation.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/ankita-dutta-ideation.webp) |
| `/images/team/anshita-dash-ideation.webp` | [anshita-dash-ideation.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/anshita-dash-ideation.webp) |
| `/images/team/anshuman-meher-content.webp` | [anshuman-meher-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/anshuman-meher-content.webp) |
| `/images/team/anshuman-tiwary-management.webp` | [anshuman-tiwary-management.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/anshuman-tiwary-management.webp) |
| `/images/team/debojeet-content.webp` | [debojeet-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/debojeet-content.webp) |
| `/images/team/harshit.webp` | [harshit.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/harshit.webp) |
| `/images/team/himanshi_mohapatra.jpeg` | [himanshi_mohapatra.jpeg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/himanshi_mohapatra.jpeg) |
| `/images/team/Imtiaz_Allam.jpeg` | [Imtiaz_Allam.jpeg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/Imtiaz_Allam.jpeg) |
| `/images/team/ishika.webp` | [ishika.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/ishika.webp) |
| `/images/team/jagruti-pandey-content.webp` | [jagruti-pandey-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/jagruti-pandey-content.webp) |
| `/images/team/jitesh_bhaiya.jpeg` | [jitesh_bhaiya.jpeg](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/jitesh_bhaiya.jpeg) |
| `/images/team/jitesh_bhaiya.webp` | [jitesh_bhaiya.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/jitesh_bhaiya.webp) |
| `/images/team/manish-prakash-coordinator.webp` | [manish-prakash-coordinator.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/manish-prakash-coordinator.webp) |
| `/images/team/om-pandey.webp` | [om-pandey.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/om-pandey.webp) |
| `/images/team/omm-prakash-tripathy-content.webp` | [omm-prakash-tripathy-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/omm-prakash-tripathy-content.webp) |
| `/images/team/orosmit-mishra.webp` | [orosmit-mishra.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/orosmit-mishra.webp) |
| `/images/team/pratyush-sahoo-content.webp` | [pratyush-sahoo-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/pratyush-sahoo-content.webp) |
| `/images/team/saswat-palo-content.webp` | [saswat-palo-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/saswat-palo-content.webp) |
| `/images/team/siba-hoops.png` | [siba-hoops.png](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/siba-hoops.png) |
| `/images/team/siba-hoops.webp` | [siba-hoops.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/siba-hoops.webp) |
| `/images/team/siddharth-basu-content.webp` | [siddharth-basu-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/siddharth-basu-content.webp) |
| `/images/team/simrita-barick-content.webp` | [simrita-barick-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/simrita-barick-content.webp) |
| `/images/team/sindhusuta-rath-content.webp` | [sindhusuta-rath-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/sindhusuta-rath-content.webp) |
| `/images/team/smita-jena-content.webp` | [smita-jena-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/smita-jena-content.webp) |
| `/images/team/suryaprasad-brahma-ideation.webp` | [suryaprasad-brahma-ideation.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/suryaprasad-brahma-ideation.webp) |
| `/images/team/swarnim-content.webp` | [swarnim-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/swarnim-content.webp) |
| `/images/team/tushti-sinha-content.webp` | [tushti-sinha-content.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/tushti-sinha-content.webp) |
| `/images/team/umesh-kumar-sahu-ideation.webp` | [umesh-kumar-sahu-ideation.webp](https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/umesh-kumar-sahu-ideation.webp) |

---

## 5. Verification Checklist

- [x] Every required image has a deterministic Cloudinary mapping
- [x] Content SHA-256 hashes calculated for all 85 assets
- [x] Zero images were modified, recompressed, or cropped
- [x] Zero local images were deleted
- [x] Zero duplicate uploads created
- [x] Centralized mapping mechanism established in `frontend/src/data/cloudinaryMap.ts`
- [x] Frontend source image references remain unmodified (as instructed)
