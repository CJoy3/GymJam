# GymJam — Copyright & Legal Issues Report

**Scope:** This document records every third-party resource (libraries, code, fonts,
icons, map data and images) used in the GymJam digital touchpoint, the licence each
is distributed under, and the legal constraints a future development team must
respect when continuing work on, or officially releasing, the product.

GymJam is an Expo / React Native mobile app (iOS, Android, web) with a FastAPI +
Supabase backend.

---

## 1. Third-party software libraries

### 1.1 Frontend — JavaScript / TypeScript (`frontend/package.json`)

| Resource | Author / Owner | Licence | Licence implications |
|---|---|---|---|
| react, react-dom | Meta | MIT | Permissive. Keep copyright + licence notice. |
| react-native | Meta | MIT | Permissive. Keep notice. |
| expo + all `expo-*` modules (router, font, image, location, haptics, crypto, constants, linear-gradient, splash-screen, status-bar, symbols, system-ui, web-browser, apple-authentication, glass-effect, linking) | Expo / 650 Industries | MIT | Permissive. Keep notice. |
| @react-navigation/* (native, bottom-tabs, elements) | React Navigation contributors | MIT | Permissive. Keep notice. |
| @supabase/supabase-js | Supabase Inc. | MIT | Permissive. Keep notice. |
| @react-native-async-storage/async-storage | React Native Community | MIT | Permissive. |
| react-native-maps | React Native Maps contributors | MIT | Permissive (the **map data/tiles** behind it are *not* MIT — see §4). |
| react-native-reanimated | Software Mansion | MIT | Permissive. |
| react-native-gesture-handler | Software Mansion | MIT | Permissive. |
| react-native-safe-area-context | Th3rd Wave | MIT | Permissive. |
| react-native-screens | Software Mansion | MIT | Permissive. |
| react-native-svg | Software Mansion | MIT | Permissive. |
| react-native-web | Nicolas Gallagher | MIT | Permissive. |
| react-native-url-polyfill | Charpeni | MIT | Permissive. |
| react-native-worklets | Software Mansion | MIT | Permissive. |
| @expo/vector-icons | Expo (wrapper) | MIT | Wrapper is MIT; **the icon glyphs are separately licensed — see §3**. |
| @expo-google-fonts/plus-jakarta-sans | Expo (packaging) | MIT (package) | The font file inside is **SIL OFL 1.1 — see §3**. |
| jest, jest-expo | Meta / Expo | MIT | Dev-only (testing). |
| eslint, eslint-config-expo | OpenJS Foundation / Expo | MIT | Dev-only (linting). |
| typescript | Microsoft | **Apache-2.0** | Dev-only. Apache 2.0 adds: preserve any `NOTICE` file and state changes if you modify it; includes a patent grant. |
| @types/jest, @types/react | DefinitelyTyped | MIT | Dev-only type stubs. |

### 1.2 Backend — Python (`backend/requirements.txt`)

| Resource | Author / Owner | Licence | Licence implications |
|---|---|---|---|
| fastapi | Sebastián Ramírez | MIT | Permissive. Keep notice. |
| uvicorn[standard] | Encode | **BSD-3-Clause** | Permissive; keep notice and do not use the author's name to endorse. |
| pydantic, pydantic-settings | Pydantic Services | MIT | Permissive. |
| supabase (python client) | Supabase | MIT | Permissive. |
| httpx | Encode | **BSD-3-Clause** | Permissive. |
| pytest | pytest-dev | MIT | Dev-only (testing). |

> Note: a local Python virtual-env (`backend/venv/`) contains additional packages such as
> **matplotlib** (Matplotlib/PSF-style licence) and **DejaVu/STIX fonts**. These are *developer
> tooling only*, are **git-ignored** and **not shipped** in the product, so they impose no
> release obligations — but they should not be committed.

**Overall licence position:** Every shipped dependency is under a **permissive** licence
(MIT, BSD-3-Clause, Apache-2.0). There are **no copyleft (GPL/AGPL/LGPL) dependencies**,
so there is no obligation to open-source GymJam's own code. The only practical duty is
**attribution**: reproduce each library's copyright notice and licence text (e.g. an
auto-generated `licenses.txt` / an in-app "Open Source Licences" screen).

---

## 2. Backend / hosting services (SaaS — not code, but legally relevant)

| Service | Used for | Constraint |
|---|---|---|
| **Supabase** | Auth, Postgres DB, realtime, storage | Acts as a **data processor**. Bound by Supabase's ToS + DPA. Default hosting region determines where personal data lives (US/EU) — relevant to data-transfer law (§6). |
| **Expo / EAS** (`eas.json`, projectId in `app.json`) | Builds, OTA updates | Bound by Expo's Terms of Service. |
| **Vercel** (`vercel.json`) | Hosting the exported web build | Bound by Vercel's Terms of Service. |
| **Overpass API / OpenStreetMap** (`backend/scripts/fetch_uk_gyms.py`) | One-off harvest of UK gym locations | Data licensed **ODbL** — strong attribution + share-alike duty (§4). Overpass public mirrors also have a fair-use policy. |

---

## 3. Fonts & icons

| Resource | Where used | Licence | Implications |
|---|---|---|---|
| **Plus Jakarta Sans** (Tokotype) | Main app typeface (`@expo-google-fonts`, loaded in `app/_layout.tsx`); also in pitch leaflet | **SIL OFL 1.1** | Free to bundle/embed in the app and commercial products. Cannot be **sold on its own**; the reserved font name must not be reused on a modified version. |
| **Inter** (Rasmus Andersson) | Pitch-leaflet HTML (Google Fonts CDN) | **SIL OFL 1.1** | As above. |
| **Bricolage Grotesque** | Pitch-leaflet HTML (Google Fonts CDN) | **SIL OFL 1.1** | As above. |
| **Material Icons / Material Symbols** (Google) | In-app UI icons via `MaterialIcons` from `@expo/vector-icons` | **Apache-2.0** | Free for commercial use; preserve the Apache notice. |

> The leaflet HTML pulls Inter / Bricolage / Plus Jakarta Sans from the **Google Fonts CDN**
> (`fonts.googleapis.com`). Google Fonts is free for commercial use; for a production web
> release consider self-hosting to avoid sending user IP addresses to Google (a GDPR
> consideration — a German court has ruled dynamic CDN embedding can breach GDPR).

---

## 4. Map data & geographic data — the most important external resource

- **react-native-maps** is configured with `PROVIDER_DEFAULT`
  (`src/ui/FullMap.tsx`, `src/ui/ProfileMap.tsx`). This renders **Apple Maps on iOS**
  and **Google Maps on Android**. Each carries its own platform terms:
  - **Apple MapKit** — governed by the Apple Developer Program Licence; no separate fee.
  - **Google Maps Platform** — governed by Google Maps Platform ToS; **usage is billable**
    above the free tier and an API key + billing account is required for a public release.
    Google Maps data/imagery may not be scraped or used outside a Google map.
- **Gym location dataset** (`backend/supabase/gyms_seed.sql`, generated by
  `fetch_uk_gyms.py`) is derived from **OpenStreetMap via the Overpass API**.
  - Licence: **Open Database Licence (ODbL) v1.0**.
  - Duties: (a) **attribution** — display "© OpenStreetMap contributors" wherever the
    data is shown; (b) **share-alike** — if we publicly distribute a *derived database*,
    it must be offered under ODbL; (c) keep the data open.
  - **Action for release:** add a visible OpenStreetMap credit on/near the map screen.

---

## 5. Images & original assets

| Asset | Origin | Status |
|---|---|---|
| App icons, splash, adaptive/monochrome icons (`frontend/assets/images/*`) | Created by the group | Group-owned — no third-party rights. |
| Mascot pixel-art SVGs — `fit`, `scrawny`, `mogger`, `buff`, `otter` (`docs/leaflets/img/mascots/`) | Hand-authored pixel-art (raw `<rect>` SVG) by the group | Group-owned original work. |
| Leaflet/marketing imagery (`docs/leaflets/img/*.png`) | Group-produced screenshots/mockups | Group-owned. |
| Brand name & "GJ" logotype | Group | Group-owned (subject to trademark clearance — §6). |

No third-party photographs, stock images or clip-art are embedded in the product. This
keeps the image-rights position clean — the main risk would be introduced if future work
adds stock photos, so any additions should be tracked with their licence/source.

---

## 6. Wider legal implications (discussion)

If GymJam were officially released, the following must be addressed beyond pure
software licensing:

**Data protection (UK GDPR / Data Protection Act 2018 / EU GDPR).** GymJam collects
**personal data**: email + password (authentication via Supabase), precise **device
location** (`expo-location`, gym/squad map), social graph (friends, groups), and
behavioural data (gym check-ins, streaks, pledges). The app already shows the text
*"you agree to GymJam's Terms of Service and Privacy Policy"* (`src/screens/Login.tsx`)
— **neither document currently exists and must be written.** Obligations include: a
lawful basis for processing, **explicit consent / clear justification for location**
access, data-subject rights (access, deletion, portability), data minimisation, breach
notification, and a Data Processing Agreement with Supabase. Because Supabase may host
data in the **US**, an international-transfer mechanism (Standard Contractual Clauses)
is needed. Storing/handling passwords mandates appropriate security measures.

**Financial / gambling regulation (highest-risk feature).** GymJam's core "pot" /
pledge mechanic (`backend/app/services/pot.py`, `pledge` flows) lets users stake value
on showing up. If real money is ever involved, this could engage **gambling law (UK
Gambling Act 2005)** and/or **payment-services / FCA regulation** (holding client
funds, e-money). This needs legal advice before launch; keeping pledges to
non-monetary points/ELO substantially reduces the risk.

**Health & fitness / liability.** As a fitness product encouraging gym attendance,
GymJam should carry a **medical/injury disclaimer** ("consult a doctor before starting
exercise") and limit liability in its Terms of Service.

**App-store policies.** A release must satisfy **Apple App Store Review Guidelines** and
**Google Play policies** — including a published privacy policy, accurate permission
usage strings (location, etc.), account-deletion support, and (if Apple sign-in or any
third-party social login is offered) Apple's "Sign in with Apple" parity rule. Note
`expo-apple-authentication` is a dependency, so Apple Sign In may be enabled.

**Trademark & brand.** The name **"GymJam"** should be cleared against the UK trademark
register before launch to avoid infringement. The dataset references gym-chain names
(PureGym, The Gym Group, Virgin Active, etc.); using these **as factual location names**
is generally permissible **nominative use**, but the app must **not** use their logos or
imply partnership/endorsement.

**Open-source attribution.** Although all licences are permissive, MIT/BSD/Apache all
require their notices to be reproduced. Ship an **"Open Source Licences" acknowledgements
screen** (or bundled `NOTICE`/`licenses.txt`) listing every dependency in §1, the fonts
in §3, and the **"© OpenStreetMap contributors"** credit from §4.

---

## 7. Action checklist for the future development team

- [ ] Generate and ship an open-source licence acknowledgements list (all of §1, §3).
- [ ] Add a visible **"© OpenStreetMap contributors"** attribution on the map screen (ODbL).
- [ ] Provision a **Google Maps Platform** API key + billing for the Android release.
- [ ] Write and publish a **Privacy Policy** and **Terms of Service** (referenced but missing).
- [ ] Put a **Data Processing Agreement** + transfer safeguards in place with Supabase.
- [ ] Add a **medical/injury disclaimer** and liability limitation.
- [ ] Obtain **legal advice on the pledge/pot feature** before introducing any real money.
- [ ] Run a **trademark clearance** search for "GymJam".
- [ ] Keep developer-only tooling (`backend/venv/`, matplotlib, etc.) out of the shipped build.
- [ ] Track the licence/source of any future stock images or audio added to the product.
