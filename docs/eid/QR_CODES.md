# NEXUS E-ID: QR Code Specification & Compatibility

This document explains the physical QR code standards, generation pipeline, payload constraints, and permanence architecture used on NEXUS physical ID cards.

---

## 1. QR Code Payload Principle

> [!IMPORTANT]
> The QR code printed on physical cards contains **ONLY** the permanent public canonical URL.
> Under no circumstances is the full member JSON, vCard, or biographical data encoded directly into the QR matrix.

### Encoded Content:
```
https://nexusopen.dev/memberID/orosmit-mishra/NX-026
```

---

## 2. Why Only the URL?

1. **Permanence Over Stale Data**:
   If an operative changes squads, receives a promotion, or earns new security clearance, physical cards printed with direct data would instantly become obsolete. Encoding only the URL ensures the card always pulls live data from the database.
2. **Matrix Density & Print Readability**:
   A short URL (~50 characters) generates a low-density QR matrix (Version 3 or 4) with large, crisp modules. This guarantees reliable optical scanning by any smartphone camera—even in low light or through scratched badge holders.
3. **Bandwidth & Processing Efficiency**:
   Scanning immediately invokes the mobile browser with standard URL handler semantics without requiring specialized client-side decoding apps.

---

## 3. QR Generation Pipeline ([QrCode.tsx](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/Eid-card/ui/src/components/QrCode.tsx))

The QR code is generated on-the-fly using the standard ISO/IEC 18004 Reed-Solomon engine:

```tsx
<QrCode
  value={`${window.location.origin}${member.qrUrl}`}
  size={142}
  darkColor="#120D09"
  lightColor="#F6D7B3"
  margin={2}
/>
```

### Optical Calibration Parameters:
- **Error Correction Level**: Level M (15% Reed-Solomon recovery redundancy).
- **Quiet Zone**: 2-module minimum margin.
- **Color Contrast**: Dark Charcoal foreground (`#120D09`) on Warm Sand background (`#F6D7B3`), harmonized with the physical card reverse-theme art.
- **Rendering**: Scalable Vector Graphics (`<svg>`) with `shape-rendering="crispEdges"`, avoiding pixelation during high-DPI badge export.

---

## 4. Lifecycle Progression During Profile Updates

```
Physical Badge Printed
(QR: https://nexusopen.dev/memberID/orosmit-mishra/NX-026)
                      │
                      ▼
Operative changes designation or bio in Database
                      │
                      ▼
Smartphone scans existing physical badge
                      │
                      ▼
Mobile browser requests /memberID/orosmit-mishra/NX-026
                      │
                      ▼
Backend pulls updated record from SQLite
                      │
                      ▼
Frontend renders updated role and clearance
(Physical badge remains 100% valid!)
```
