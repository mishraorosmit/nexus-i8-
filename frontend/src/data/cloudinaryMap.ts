/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NEXUS CENTRALIZED CLOUDINARY IMAGE MAPPING
 * 
 * Maps canonical local paths (/images/<category>/<file>) to their corresponding
 * Cloudinary public IDs and CDN delivery URLs under namespace "aarambh".
 * 
 * Provides fallback to local canonical paths during offline development or test runs.
 */

import type React from 'react';

export interface CloudinaryImageRecord {
  localPath: string;
  publicId: string;
  deliveryUrl: string;
  category: string;
  sha256: string;
}

export const CLOUDINARY_CONFIG = {
  cloudName: 'plg8gola',
  rootFolder: 'aarambh',
  deliveryDomain: 'https://res.cloudinary.com/plg8gola/image/upload',
} as const;

export const CLOUDINARY_IMAGE_MAP: Record<string, CloudinaryImageRecord> = {
  "/images/eid/nexus-card-back-theme.png": {
    localPath: "/images/eid/nexus-card-back-theme.png",
    publicId: "aarambh/eid/nexus-card-back-theme",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/eid/nexus-card-back-theme.png",
    category: "eid",
    sha256: "69bb3ed4d9433a4210eff5251afa39d59aa7505d066892bbc83646dffca87036",
  },
  "/images/eid/nexus-card-theme.png": {
    localPath: "/images/eid/nexus-card-theme.png",
    publicId: "aarambh/eid/nexus-card-theme",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/eid/nexus-card-theme.png",
    category: "eid",
    sha256: "95ceeb7b1afc37deb5fbb0fe3482228fb9ebcd52cc45dcc7091a5c01b1adfbe5",
  },
  "/images/events/event-coding-ninjas.png": {
    localPath: "/images/events/event-coding-ninjas.png",
    publicId: "aarambh/events/event-coding-ninjas",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-coding-ninjas.png",
    category: "events",
    sha256: "74324cb5dfedf4149ae3bd57260bd91f2fc42369cd79045cab0876c649ac4849",
  },
  "/images/events/event-faculty.png": {
    localPath: "/images/events/event-faculty.png",
    publicId: "aarambh/events/event-faculty",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-faculty.png",
    category: "events",
    sha256: "a171e6d208f8c89d8a03e7c55662ebd5459558f11b2e29e1df4d0a28102cb34b",
  },
  "/images/events/event-qna.jpg": {
    localPath: "/images/events/event-qna.jpg",
    publicId: "aarambh/events/event-qna",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-qna.jpg",
    category: "events",
    sha256: "18aebb23844490e372096eb1a00d23309b28436683a4d51d0beedbbef2bb277d",
  },
  "/images/events/event-speaker.png": {
    localPath: "/images/events/event-speaker.png",
    publicId: "aarambh/events/event-speaker",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/events/event-speaker.png",
    category: "events",
    sha256: "d5c7aa8035d89c8d243425897ee95bf976c49171199fd10cec06d92c65d4876d",
  },
  "/images/gallery/event-coding-ninjas.webp": {
    localPath: "/images/gallery/event-coding-ninjas.webp",
    publicId: "aarambh/gallery/event-coding-ninjas",
    deliveryUrl: "/images/gallery/event-coding-ninjas.webp",
    category: "gallery",
    sha256: "4c699529862543aa63352eb9e899dbcb0bb6a06063bfdd019ce29cfb123a7f66",
  },
  "/images/gallery/event-faculty.webp": {
    localPath: "/images/gallery/event-faculty.webp",
    publicId: "aarambh/gallery/event-faculty",
    deliveryUrl: "/images/gallery/event-faculty.webp",
    category: "gallery",
    sha256: "93cb2293a5c418ba2ddde743cc41b47026dd4ce2839e8a058f613b30c4898b46",
  },
  "/images/gallery/event-qna.webp": {
    localPath: "/images/gallery/event-qna.webp",
    publicId: "aarambh/gallery/event-qna",
    deliveryUrl: "/images/gallery/event-qna.webp",
    category: "gallery",
    sha256: "72a4ecc1efe5957fc834031e278a336ae0a56ec457a6f606b169abd8d5e84995",
  },
  "/images/gallery/event-speaker.webp": {
    localPath: "/images/gallery/event-speaker.webp",
    publicId: "aarambh/gallery/event-speaker",
    deliveryUrl: "/images/gallery/event-speaker.webp",
    category: "gallery",
    sha256: "10917d6faa715434a6bf8d5f3c4de7f271d8219e576f3a5d95cf7ffa0f02d219",
  },
  "/images/gallery/gallery-01.webp": {
    localPath: "/images/gallery/gallery-01.webp",
    publicId: "aarambh/gallery/gallery-01",
    deliveryUrl: "/images/gallery/gallery-01.webp",
    category: "gallery",
    sha256: "4215413fb3ffa9acaa5a246372083c885dc41c69b94f0096be48b678f2022789",
  },
  "/images/gallery/gallery-07.webp": {
    localPath: "/images/gallery/gallery-07.webp",
    publicId: "aarambh/gallery/gallery-07",
    deliveryUrl: "/images/gallery/gallery-07.webp",
    category: "gallery",
    sha256: "164186e5f675b784de49530b37005dcda668c7da2254d56b5d820bd6f28a38f1",
  },
  "/images/gallery/gallery-08.webp": {
    localPath: "/images/gallery/gallery-08.webp",
    publicId: "aarambh/gallery/gallery-08",
    deliveryUrl: "/images/gallery/gallery-08.webp",
    category: "gallery",
    sha256: "b88e8b554e50ee0fecac00b7186a7b5b3d037791a342418bbea8f275c6664c6f",
  },
  "/images/gallery/gallery-09.webp": {
    localPath: "/images/gallery/gallery-09.webp",
    publicId: "aarambh/gallery/gallery-09",
    deliveryUrl: "/images/gallery/gallery-09.webp",
    category: "gallery",
    sha256: "639d3b8d2d33caa2ba93febb2db17dcde37c7276b080941041526b0eb4ae6d5a",
  },
  "/images/gallery/gallery-10.webp": {
    localPath: "/images/gallery/gallery-10.webp",
    publicId: "aarambh/gallery/gallery-10",
    deliveryUrl: "/images/gallery/gallery-10.webp",
    category: "gallery",
    sha256: "31245622a5860a31acd523f711c16cd2f7064c713d45f5701f0f8d5db759f90e",
  },
  "/images/logos/coding_ninjas_dark.png": {
    localPath: "/images/logos/coding_ninjas_dark.png",
    publicId: "aarambh/logos/coding_ninjas_dark",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_dark.png",
    category: "logos",
    sha256: "122b7b04a6d3e294663af505656bef35ffa432844c987bbe3d1e9b7418e3d9d1",
  },
  "/images/logos/coding_ninjas_dark_badge_clean.png": {
    localPath: "/images/logos/coding_ninjas_dark_badge_clean.png",
    publicId: "aarambh/logos/coding_ninjas_dark_badge_clean",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_dark_badge_clean.png",
    category: "logos",
    sha256: "702f7cb2c9129b24bd68aa003e1cf258e0d7e259c1d4b702d2402ee5ce0e63fa",
  },
  "/images/logos/coding_ninjas_dark_clean.png": {
    localPath: "/images/logos/coding_ninjas_dark_clean.png",
    publicId: "aarambh/logos/coding_ninjas_dark_clean",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_dark_clean.png",
    category: "logos",
    sha256: "302b96caf94a2b738119efa57b591cc73a212b3bc93dc52341a7e663afb5ee67",
  },
  "/images/logos/coding_ninjas_light.png": {
    localPath: "/images/logos/coding_ninjas_light.png",
    publicId: "aarambh/logos/coding_ninjas_light",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_light.png",
    category: "logos",
    sha256: "22d599e7b6d444f3210fa63d13f5e66fedbe476bfc63d55775d4da1bc99f61b3",
  },
  "/images/logos/coding_ninjas_light_clean.png": {
    localPath: "/images/logos/coding_ninjas_light_clean.png",
    publicId: "aarambh/logos/coding_ninjas_light_clean",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/coding_ninjas_light_clean.png",
    category: "logos",
    sha256: "d46301b8ecf0a0d24e5323ab4067720758771a75bbf0c99b9fd7ea325ffa713b",
  },
  "/images/logos/nexus-logo-x.svg": {
    localPath: "/images/logos/nexus-logo-x.svg",
    publicId: "aarambh/logos/nexus-logo-x",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/nexus-logo-x.svg",
    category: "logos",
    sha256: "6007488cfb49601e9945c5c800142a8fff97454adb13fb0baa5234fd7926fb35",
  },
  "/images/logos/NEXUS-removebg-preview-1.png": {
    localPath: "/images/logos/NEXUS-removebg-preview-1.png",
    publicId: "aarambh/logos/NEXUS-removebg-preview-1",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/NEXUS-removebg-preview-1.png",
    category: "logos",
    sha256: "3352d17df3891b0d9d0cf2c8f5e62a58c4500179cc2591af1b38f5e7939b08e9",
  },
  "/images/logos/test-logo.svg": {
    localPath: "/images/logos/test-logo.svg",
    publicId: "aarambh/logos/test-logo",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/logos/test-logo.svg",
    category: "logos",
    sha256: "3aabef1cabb7edc8480633b627e1af7f35e843bed54269ada3dcd5b4df92f3a6",
  },
  "/images/misc/penguin-admire.png": {
    localPath: "/images/misc/penguin-admire.png",
    publicId: "aarambh/misc/penguin-admire",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-admire.png",
    category: "misc",
    sha256: "9de4a4c5201bed14c21147717f6eff194ce4d3b01c84eb378f337507cb5b305c",
  },
  "/images/misc/penguin-annoyed.png": {
    localPath: "/images/misc/penguin-annoyed.png",
    publicId: "aarambh/misc/penguin-annoyed",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-annoyed.png",
    category: "misc",
    sha256: "4226756a5c0d9402bd1d23d2235f5fe6c4011495504194817194dae3d7242e0f",
  },
  "/images/misc/penguin-blink.png": {
    localPath: "/images/misc/penguin-blink.png",
    publicId: "aarambh/misc/penguin-blink",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-blink.png",
    category: "misc",
    sha256: "71f04ff53e9415f6f3246d57cffb869c2e0fb84b18138594c6ba032b79caedba",
  },
  "/images/misc/penguin-celebrate.png": {
    localPath: "/images/misc/penguin-celebrate.png",
    publicId: "aarambh/misc/penguin-celebrate",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-celebrate.png",
    category: "misc",
    sha256: "c25d59ba75f522eb3577a990cede24ef966b8f360150779e5917dfd602e87b6c",
  },
  "/images/misc/penguin-curious.png": {
    localPath: "/images/misc/penguin-curious.png",
    publicId: "aarambh/misc/penguin-curious",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-curious.png",
    category: "misc",
    sha256: "81b13e54966ba471be0c2cbb62e9e4aafdc58e2235b3d518c509894672f260de",
  },
  "/images/misc/penguin-idle.png": {
    localPath: "/images/misc/penguin-idle.png",
    publicId: "aarambh/misc/penguin-idle",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-idle.png",
    category: "misc",
    sha256: "98065ee8aa6494da10a6884dc1dc0e66b4820ab7ae3af9ca14ffcf1bad394108",
  },
  "/images/misc/penguin-inspect.png": {
    localPath: "/images/misc/penguin-inspect.png",
    publicId: "aarambh/misc/penguin-inspect",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-inspect.png",
    category: "misc",
    sha256: "263a4a6a45ed2813f98156af00d4ef981ce037f27d4af6027aa7b9d0117fe603",
  },
  "/images/misc/penguin-look-left.png": {
    localPath: "/images/misc/penguin-look-left.png",
    publicId: "aarambh/misc/penguin-look-left",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-look-left.png",
    category: "misc",
    sha256: "6fa382213ac3b193d63242dad802f2c0f177df224705560856bd1e58eb44357c",
  },
  "/images/misc/penguin-look-right.png": {
    localPath: "/images/misc/penguin-look-right.png",
    publicId: "aarambh/misc/penguin-look-right",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-look-right.png",
    category: "misc",
    sha256: "d112b0151a2085cb61a9e86e0524d1220fc545ee31d4c21c2e36f3f5ed0f37e2",
  },
  "/images/misc/penguin-nexus-touch.png": {
    localPath: "/images/misc/penguin-nexus-touch.png",
    publicId: "aarambh/misc/penguin-nexus-touch",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-nexus-touch.png",
    category: "misc",
    sha256: "35749a9f4edcaa74c0f6e8b52ef51060a270942c0cd8bb861f59d490f775dbb7",
  },
  "/images/misc/penguin-peek-bottom-smile.png": {
    localPath: "/images/misc/penguin-peek-bottom-smile.png",
    publicId: "aarambh/misc/penguin-peek-bottom-smile",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-bottom-smile.png",
    category: "misc",
    sha256: "c38d8fd038c9b9f42f48cc1b991c2b6bf8c97edd98a2fa0ae73fec75d775456e",
  },
  "/images/misc/penguin-peek-bottom.png": {
    localPath: "/images/misc/penguin-peek-bottom.png",
    publicId: "aarambh/misc/penguin-peek-bottom",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-bottom.png",
    category: "misc",
    sha256: "1037859b0f2af9d187947ce081e72666e991f4f5f19c0dc92ec54eb84fb073cb",
  },
  "/images/misc/penguin-peek-left.png": {
    localPath: "/images/misc/penguin-peek-left.png",
    publicId: "aarambh/misc/penguin-peek-left",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-left.png",
    category: "misc",
    sha256: "674dc3347bbb9187b57e0c9350860bbc5aa13b3ff32ffb5ef47ed451bc145b26",
  },
  "/images/misc/penguin-peek-right.png": {
    localPath: "/images/misc/penguin-peek-right.png",
    publicId: "aarambh/misc/penguin-peek-right",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-peek-right.png",
    category: "misc",
    sha256: "6672a4465d4220745794d57df269db5320876728a17b26d584c3954b705212ac",
  },
  "/images/misc/penguin-shake-off.png": {
    localPath: "/images/misc/penguin-shake-off.png",
    publicId: "aarambh/misc/penguin-shake-off",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-shake-off.png",
    category: "misc",
    sha256: "8b826b4636065dfbe79271284347d6619c0f35a41d3675d36d07f79db5195849",
  },
  "/images/misc/penguin-shy.png": {
    localPath: "/images/misc/penguin-shy.png",
    publicId: "aarambh/misc/penguin-shy",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-shy.png",
    category: "misc",
    sha256: "f7904d5f1429de67ab960763512e21e5e0787d5f15c99e937155178a50875d1e",
  },
  "/images/misc/penguin-smile.png": {
    localPath: "/images/misc/penguin-smile.png",
    publicId: "aarambh/misc/penguin-smile",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-smile.png",
    category: "misc",
    sha256: "bddf54a80273b6612985fc4020eee6ecb423365809394589f1141cb2cf8ca49d",
  },
  "/images/misc/penguin-struggle-down.png": {
    localPath: "/images/misc/penguin-struggle-down.png",
    publicId: "aarambh/misc/penguin-struggle-down",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-down.png",
    category: "misc",
    sha256: "03e1af676073ab45ff44634d521975035338a22e1e7e189ca9613f2aee036961",
  },
  "/images/misc/penguin-struggle-left.png": {
    localPath: "/images/misc/penguin-struggle-left.png",
    publicId: "aarambh/misc/penguin-struggle-left",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-left.png",
    category: "misc",
    sha256: "417af4cd077fec87dd0e480647a70123c421aa57aa369f188fad686808aa1641",
  },
  "/images/misc/penguin-struggle-right.png": {
    localPath: "/images/misc/penguin-struggle-right.png",
    publicId: "aarambh/misc/penguin-struggle-right",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-right.png",
    category: "misc",
    sha256: "803aa42654450d416bdf2cbf375271eae46fbafa80934bfd641ce28b2b5d88cd",
  },
  "/images/misc/penguin-struggle-up.png": {
    localPath: "/images/misc/penguin-struggle-up.png",
    publicId: "aarambh/misc/penguin-struggle-up",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-struggle-up.png",
    category: "misc",
    sha256: "b5a37d561f6fc0b0db44610031008874a15c5a249779f132c23bfb831c34c2fb",
  },
  "/images/misc/penguin-walk-1.png": {
    localPath: "/images/misc/penguin-walk-1.png",
    publicId: "aarambh/misc/penguin-walk-1",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-walk-1.png",
    category: "misc",
    sha256: "dae2ac7e992d3e7f92d5779efbe26fe60337340f86452556663efb2ce6c7c5b3",
  },
  "/images/misc/penguin-walk-2.png": {
    localPath: "/images/misc/penguin-walk-2.png",
    publicId: "aarambh/misc/penguin-walk-2",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-walk-2.png",
    category: "misc",
    sha256: "e09374fd2e563a6ce0c38be536429c0619b51de8c46486da9bafa170461a427c",
  },
  "/images/misc/penguin-wave-smile.png": {
    localPath: "/images/misc/penguin-wave-smile.png",
    publicId: "aarambh/misc/penguin-wave-smile",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-wave-smile.png",
    category: "misc",
    sha256: "f45c55d1d1108056b4048cbd0573684dc266ae93815a6fec09cdd93c1f404ac6",
  },
  "/images/misc/penguin-wave.png": {
    localPath: "/images/misc/penguin-wave.png",
    publicId: "aarambh/misc/penguin-wave",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguin-wave.png",
    category: "misc",
    sha256: "f148bc9c928442607729747fd0d8bf5ab8a110a643d4b39b53e15349c4abad9c",
  },
  "/images/misc/penguinascii.jpg": {
    localPath: "/images/misc/penguinascii.jpg",
    publicId: "aarambh/misc/penguinascii",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/misc/penguinascii.jpg",
    category: "misc",
    sha256: "152cf27565837101abfce8a54647eb0ece96d57b63ee18db387721a208f8bcd4",
  },
  "/images/projects/01-ideas-sketches.svg": {
    localPath: "/images/projects/01-ideas-sketches.svg",
    publicId: "aarambh/projects/01-ideas-sketches",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/01-ideas-sketches.svg",
    category: "projects",
    sha256: "983c0d241835840c8d09a6ad7b5c4fd0067b3957f8bcbb943e3a3bdb98009812",
  },
  "/images/projects/02-physical-prototype.svg": {
    localPath: "/images/projects/02-physical-prototype.svg",
    publicId: "aarambh/projects/02-physical-prototype",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/02-physical-prototype.svg",
    category: "projects",
    sha256: "69374d2936b988dd9e48287e34d12fe38c589dec9aa0c76f857c4308c66f3257",
  },
  "/images/projects/03-team-workshop.svg": {
    localPath: "/images/projects/03-team-workshop.svg",
    publicId: "aarambh/projects/03-team-workshop",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/03-team-workshop.svg",
    category: "projects",
    sha256: "8f4776fe5dd14629352b42044dc32c3895b60a73b9371c95d6b009443c1917f1",
  },
  "/images/projects/04-iteration-detail.svg": {
    localPath: "/images/projects/04-iteration-detail.svg",
    publicId: "aarambh/projects/04-iteration-detail",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/04-iteration-detail.svg",
    category: "projects",
    sha256: "adb09ef45c45041f2b613b72efb98763d7ee45caa022d77a59fe83b0b78144f7",
  },
  "/images/projects/05-studio-showcase.svg": {
    localPath: "/images/projects/05-studio-showcase.svg",
    publicId: "aarambh/projects/05-studio-showcase",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/05-studio-showcase.svg",
    category: "projects",
    sha256: "d660d80c6ff7a5994d6ccd269c2c51efe6897013ec02980803763f9218dce228",
  },
  "/images/projects/voxen-prototype.svg": {
    localPath: "/images/projects/voxen-prototype.svg",
    publicId: "aarambh/projects/voxen-prototype",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/projects/voxen-prototype.svg",
    category: "projects",
    sha256: "a533e65bd3ae136e5ea4ca684d801fac2fea44e857d5446df27360adc6704256",
  },
  "/images/team/aadyasha-swain-ideation.webp": {
    localPath: "/images/team/aadyasha-swain-ideation.webp",
    publicId: "aarambh/team/aadyasha-swain-ideation",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/aadyasha-swain-ideation.webp",
    category: "team",
    sha256: "1b4ec1cbeaf8420c88bfc6f07abea75b698200f4255f7043d9bf8d560969874e",
  },
  "/images/team/ananya-raj-ideation.webp": {
    localPath: "/images/team/ananya-raj-ideation.webp",
    publicId: "aarambh/team/ananya-raj-ideation",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/ananya-raj-ideation.webp",
    category: "team",
    sha256: "a21dce658e8449a228bccbf48953efaf31ae1fc5aadda89d7a34253b94594d60",
  },
  "/images/team/ankita-dutta-ideation.webp": {
    localPath: "/images/team/ankita-dutta-ideation.webp",
    publicId: "aarambh/team/ankita-dutta-ideation",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/ankita-dutta-ideation.webp",
    category: "team",
    sha256: "8cab4bfbb45444a7766e84e38458db7704817e7ee02ce2010d80ea627ac53867",
  },
  "/images/team/anshita-dash-ideation.webp": {
    localPath: "/images/team/anshita-dash-ideation.webp",
    publicId: "aarambh/team/anshita-dash-ideation",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/anshita-dash-ideation.webp",
    category: "team",
    sha256: "49939be2270602a4a400a7fc3582cb26c18e6a72549a10e14657461b05318d23",
  },
  "/images/team/anshuman-meher-content.webp": {
    localPath: "/images/team/anshuman-meher-content.webp",
    publicId: "aarambh/team/anshuman-meher-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/anshuman-meher-content.webp",
    category: "team",
    sha256: "182472e6c7a10da0bce3a6eb6edafec624451f98d1a613525a9dfec7c96c71d1",
  },
  "/images/team/anshuman-tiwary-management.webp": {
    localPath: "/images/team/anshuman-tiwary-management.webp",
    publicId: "aarambh/team/anshuman-tiwary-management",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/anshuman-tiwary-management.webp",
    category: "team",
    sha256: "80e6f8fa74f8a8a2066a7a4c4e26674d3b396a96ecb352fd24d819813b7ae3f6",
  },
  "/images/team/debojeet-content.webp": {
    localPath: "/images/team/debojeet-content.webp",
    publicId: "aarambh/team/debojeet-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/debojeet-content.webp",
    category: "team",
    sha256: "ef73a032e25f52d750a30b00ae65bd1967a90634c9dea79a96a9ef9d0fbb046a",
  },
  "/images/team/harshit.webp": {
    localPath: "/images/team/harshit.webp",
    publicId: "aarambh/team/harshit",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/harshit.webp",
    category: "team",
    sha256: "98fc7bd6473027e97a77a11e536bfab77a6789d36b188a4b93382e61eebd9f55",
  },
  "/images/team/himanshi_mohapatra.jpeg": {
    localPath: "/images/team/himanshi_mohapatra.jpeg",
    publicId: "aarambh/team/himanshi_mohapatra",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/himanshi_mohapatra.jpeg",
    category: "team",
    sha256: "23474e78d983a1464825fc848274a195af1386e26e94024503d16c0fc852d4fc",
  },
  "/images/team/Imtiaz_Allam.jpeg": {
    localPath: "/images/team/Imtiaz_Allam.jpeg",
    publicId: "aarambh/team/Imtiaz_Allam",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/Imtiaz_Allam.jpeg",
    category: "team",
    sha256: "017408be933af39f48fcd91657e489d978cd4283eadd447e99ccd8eda0670aa0",
  },
  "/images/team/ishika.webp": {
    localPath: "/images/team/ishika.webp",
    publicId: "aarambh/team/ishika",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/ishika.webp",
    category: "team",
    sha256: "1c35d2106a77d547d387bcde07ed34889d1e6de2229b1bae40942597e4b9ab54",
  },
  "/images/team/jagruti-pandey-content.webp": {
    localPath: "/images/team/jagruti-pandey-content.webp",
    publicId: "aarambh/team/jagruti-pandey-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/jagruti-pandey-content.webp",
    category: "team",
    sha256: "643d9660119408422b80eafefe792fc98e88670da5dc7896d4d8229fe3702a94",
  },
  "/images/team/jitesh_bhaiya.jpeg": {
    localPath: "/images/team/jitesh_bhaiya.jpeg",
    publicId: "aarambh/team/jitesh_bhaiya",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/jitesh_bhaiya.jpeg",
    category: "team",
    sha256: "2bd503edc867829513f1a02df149cfb3f826860fc6a2829329829363d7b15dc2",
  },
  "/images/team/jitesh_bhaiya.webp": {
    localPath: "/images/team/jitesh_bhaiya.webp",
    publicId: "aarambh/team/jitesh_bhaiya",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/jitesh_bhaiya.webp",
    category: "team",
    sha256: "ca1b7bfb5b1cc6e150c3ec090fb8693df5c01e0fc0238b41ebfa2a1686434be5",
  },
  "/images/team/manish-prakash-coordinator.webp": {
    localPath: "/images/team/manish-prakash-coordinator.webp",
    publicId: "aarambh/team/manish-prakash-coordinator",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/manish-prakash-coordinator.webp",
    category: "team",
    sha256: "37fa2be61b37fd25e82cccaf00b51682de671e10e3a1c6adfaa9026ca0e80e20",
  },
  "/images/team/om-pandey.webp": {
    localPath: "/images/team/om-pandey.webp",
    publicId: "aarambh/team/om-pandey",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/om-pandey.webp",
    category: "team",
    sha256: "402f339449284b3d7c17612e33d2e722023eb6103bec2147aa3fd4f02ba821d7",
  },
  "/images/team/omm-prakash-tripathy-content.webp": {
    localPath: "/images/team/omm-prakash-tripathy-content.webp",
    publicId: "aarambh/team/omm-prakash-tripathy-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/omm-prakash-tripathy-content.webp",
    category: "team",
    sha256: "6f74d7d60ae4a8d409db79f89ab320e3408101d739fa17493c50447edc1c482a",
  },
  "/images/team/orosmit-mishra.webp": {
    localPath: "/images/team/orosmit-mishra.webp",
    publicId: "aarambh/team/orosmit-mishra",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/orosmit-mishra.webp",
    category: "team",
    sha256: "9389ec4d1907e7936e5bdb347398d43e1a3125c146e06adfd89c58166e6ed3c5",
  },
  "/images/team/pratyush-sahoo-content.webp": {
    localPath: "/images/team/pratyush-sahoo-content.webp",
    publicId: "aarambh/team/pratyush-sahoo-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/pratyush-sahoo-content.webp",
    category: "team",
    sha256: "967ab9dd1223f43422d227c73c5cd85cd739c6b31726d55f239a2f8975221653",
  },
  "/images/team/saswat-palo-content.webp": {
    localPath: "/images/team/saswat-palo-content.webp",
    publicId: "aarambh/team/saswat-palo-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/saswat-palo-content.webp",
    category: "team",
    sha256: "9010d3fa1e9c21fe3de9eaf6525caa8409ab2d8445e8210567cf896545bd0003",
  },
  "/images/team/siba-hoops.png": {
    localPath: "/images/team/siba-hoops.png",
    publicId: "aarambh/team/siba-hoops",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/siba-hoops.png",
    category: "team",
    sha256: "02cf33402daa42a6e51e8c4ccc23a6d39fc94ccf6afdbcfc76dae288104fba65",
  },
  "/images/team/siba-hoops.webp": {
    localPath: "/images/team/siba-hoops.webp",
    publicId: "aarambh/team/siba-hoops",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/siba-hoops.webp",
    category: "team",
    sha256: "155ff8d2868c9d4b6562ebc457a32614713ff87c38951aaf437cd02ff1a07e87",
  },
  "/images/team/siddharth-basu-content.webp": {
    localPath: "/images/team/siddharth-basu-content.webp",
    publicId: "aarambh/team/siddharth-basu-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/siddharth-basu-content.webp",
    category: "team",
    sha256: "70525eaab08c5b4c715a64b7bfff23c25c7885e50b92739f1985d1022207b825",
  },
  "/images/team/simrita-barick-content.webp": {
    localPath: "/images/team/simrita-barick-content.webp",
    publicId: "aarambh/team/simrita-barick-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/simrita-barick-content.webp",
    category: "team",
    sha256: "30bbbee68431dbc9d734b6cdff61a8202d7dc2da94231941499179c2ea10d295",
  },
  "/images/team/sindhusuta-rath-content.webp": {
    localPath: "/images/team/sindhusuta-rath-content.webp",
    publicId: "aarambh/team/sindhusuta-rath-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/sindhusuta-rath-content.webp",
    category: "team",
    sha256: "a6ba2402c7ffff39ce9a3381b41ed20099d1ac9ab2e854b14f4ade587b4276e8",
  },
  "/images/team/smita-jena-content.webp": {
    localPath: "/images/team/smita-jena-content.webp",
    publicId: "aarambh/team/smita-jena-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/smita-jena-content.webp",
    category: "team",
    sha256: "290b5a1106c19c414dce07863148a29981f4b282e9a4cd64f4841430ffb006a9",
  },
  "/images/team/suryaprasad-brahma-ideation.webp": {
    localPath: "/images/team/suryaprasad-brahma-ideation.webp",
    publicId: "aarambh/team/suryaprasad-brahma-ideation",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/suryaprasad-brahma-ideation.webp",
    category: "team",
    sha256: "eed0bda33ee6c3309f7f647195c7bbf336a82892cf61ee8b7cb1c4b7f8fb285c",
  },
  "/images/team/swarnim-content.webp": {
    localPath: "/images/team/swarnim-content.webp",
    publicId: "aarambh/team/swarnim-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/swarnim-content.webp",
    category: "team",
    sha256: "0411a63ec9e8f215aeac8f55203eb1572ee7cf1477183e3ef62351dead61e0c2",
  },
  "/images/team/tushti-sinha-content.webp": {
    localPath: "/images/team/tushti-sinha-content.webp",
    publicId: "aarambh/team/tushti-sinha-content",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/tushti-sinha-content.webp",
    category: "team",
    sha256: "b9562311cccbed487f618d0b7521d2a043411cd73f776807d885a0ce14f74523",
  },
  "/images/team/umesh-kumar-sahu-ideation.webp": {
    localPath: "/images/team/umesh-kumar-sahu-ideation.webp",
    publicId: "aarambh/team/umesh-kumar-sahu-ideation",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/umesh-kumar-sahu-ideation.webp",
    category: "team",
    sha256: "eb05e4710899498d64f5ba65a6dc5e1a83b0d0df077521e10d6e189b35676ff1",
  },
  "/images/team/abhinab_jena.jpg": {
    localPath: "/images/team/abhinab_jena.jpg",
    publicId: "aarambh/team/abhinab_jena",
    deliveryUrl: "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/abhinab_jena.jpg",
    category: "team",
    sha256: "local-abhinab-jena",
  },
};

/**
 * Resolves a local or relative image path to its Cloudinary delivery URL.
 * Follows the flow: component/data -> canonical identifier -> Cloudinary mapping -> Cloudinary delivery URL.
 */
export function resolveImageUrl(localOrRemotePath: string): string {
  if (!localOrRemotePath) return '';
  if (localOrRemotePath.startsWith('http://') || localOrRemotePath.startsWith('https://')) {
    return localOrRemotePath;
  }
  
  const normalized = localOrRemotePath.startsWith('/') ? localOrRemotePath : '/' + localOrRemotePath;
  const mapped = CLOUDINARY_IMAGE_MAP[normalized];
  
  if (mapped?.deliveryUrl) {
    return mapped.deliveryUrl;
  }

  // Safe fallback to canonical local repository if unmapped
  return normalized;
}

/**
 * Reverse lookup: given a Cloudinary delivery URL or public ID,
 * returns the canonical local path (/images/...).
 */
export function getLocalFallbackUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  
  // If already a local canonical path
  if (urlOrPath.startsWith('/images/')) return urlOrPath;

  // 1. Exact match by deliveryUrl
  for (const record of Object.values(CLOUDINARY_IMAGE_MAP)) {
    if (record.deliveryUrl === urlOrPath) {
      return record.localPath;
    }
  }

  // 2. If it's a Cloudinary URL under aarambh/, resolve exact candidate path
  if (urlOrPath.includes('cloudinary.com') && urlOrPath.includes('/aarambh/')) {
    const afterAarambh = urlOrPath.split('/aarambh/')[1]?.split('?')[0];
    if (afterAarambh) {
      const candidate = `/images/${afterAarambh}`;
      if (CLOUDINARY_IMAGE_MAP[candidate]) {
        return candidate;
      }
    }
  }

  // 3. Exact match by publicId
  for (const record of Object.values(CLOUDINARY_IMAGE_MAP)) {
    if (record.publicId === urlOrPath) {
      return record.localPath;
    }
  }

  return urlOrPath;
}

/**
 * Graceful image fallback handler for React <img> elements.
 * If a Cloudinary delivery URL fails (e.g. 404 before remote upload or offline),
 * this handler intercepts the event, sets the image src to the canonical local asset,
 * and logs a clear warning for debugging without breaking user experience.
 */
export function handleImageFallbackError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  explicitFallback?: string
): void {
  const img = event.currentTarget;
  if (!img) return;

  // Guard against infinite loop if the fallback itself errors
  if (img.dataset.fallbackTried === 'true') {
    return;
  }

  const currentSrc = img.currentSrc || img.src;
  const fallback = explicitFallback || getLocalFallbackUrl(currentSrc);

  if (fallback && fallback !== currentSrc) {
    img.dataset.fallbackTried = 'true';
    console.warn(
      `[Cloudinary Fallback] Image failed to resolve from Cloudinary CDN: "${currentSrc}" -> Falling back to canonical local asset: "${fallback}"`
    );
    img.src = fallback;
  }
}

