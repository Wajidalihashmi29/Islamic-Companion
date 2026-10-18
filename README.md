# Islamic Companion

A full-stack Islamic lifestyle application providing prayer times, Qibla direction, Qur'an reading, Hadith browsing, Zakat calculation, and fasting tracking — built with a decoupled React frontend and an ASP.NET Core Web API backend following Clean Architecture principles.

**Live demo:** https://islamic-companion-snowy.vercel.app

---

## Features

- 🔐 Secure authentication (JWT-based, ASP.NET Core Identity)
- 🕌 Prayer times based on user location *(in progress)*
- 🧭 Qibla direction finder *(in progress)*
- 📖 Qur'an reader with translations *(in progress)*
- 📜 Hadith collection browser *(in progress)*
- 🧮 Zakat calculator *(in progress)*
- 📅 Ramadan fasting tracker *(in progress)*
- ⭐ Favorites/bookmarks for verses, duas, and hadith *(in progress)*

> This project is under active development. Completed features are wired to real endpoints; unbuilt ones surface an "Under Construction" notice in the UI rather than a broken link.

Hijri dates on the dashboard, prayer times, and Settings use the same bundled
Umm al-Qura calendar conversion, independent of mobile browser calendar support.
Dates use the device's local calendar day, respect the configured moon-sighting
adjustment, and display the era as "Hijri".
The compact home hero keeps both dates visible and provides direct Qur'an and
prayer-time links, stacked for smaller screens.

---

## Tech Stack

**Backend**
- ASP.NET Core Web API (.NET 8)
- Entity Framework Core (Npgsql provider)
- PostgreSQL (hosted on Neon.tech)
- ASP.NET Core Identity + JWT Bearer authentication
- Swagger / Swashbuckle for API documentation
- Built-in ASP.NET Core Rate Limiting

**Frontend**
- React 18 + TypeScript
- Vite
- React Router
- Axios
- Custom design system (no UI framework — hand-built components)

**Infrastructure**
- Docker (multi-stage build for the API)
- Render.com (API hosting)
- Vercel (frontend hosting)
- GitHub Actions-ready structure for CI/CD

---

## Architecture

The backend follows **Clean Architecture** with strict inward-facing dependencies:

```
backend/
├── IslamicCompanion.Domain          → Entities, no dependencies
├── IslamicCompanion.Application     → Business logic, DTOs, interfaces
├── IslamicCompanion.Infrastructure  → EF Core, DbContext, external services
├── IslamicCompanion.API             → Controllers, auth, Swagger, composition root
└── IslamicCompanion.Tests           → xUnit test project

frontend/
└── islamic-companion-ui/
    └── src/
        ├── api/          → Axios client + typed API calls
        ├── components/   → Reusable UI components
        ├── context/      → React Context (auth state)
        └── pages/        → Route-level views
```

**Dependency direction:** `API → Infrastructure → Application → Domain`. Domain has zero external dependencies, which keeps core business rules testable and framework-agnostic.

---

## Local Development Setup

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js LTS](https://nodejs.org)
- A [Neon.tech](https://neon.tech) PostgreSQL database

### Backend

```bash
cd backend/IslamicCompanion.API

# Set up local secrets (never committed to source control)
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<your Neon connection string>"
dotnet user-secrets set "Jwt:Key" "<a long random string>"

# Apply database migrations
dotnet ef database update --project ../IslamicCompanion.Infrastructure --startup-project .

# Run
dotnet run
```

API will be available at `https://localhost:XXXX`, with Swagger UI at `/swagger`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
VITE_API_BASE_URL=https://localhost:XXXX/api
```

```bash
npm run dev
```

App runs at `http://localhost:XXXX`.

---

## Deployment

| Component | Host | Notes |
|---|---|---|
| Database | Neon.tech (free tier) | Always-on PostgreSQL |
| API | Render.com | Deployed via Docker, env vars for secrets |
| Frontend | Vercel | Auto-deploys from `main`, env var for API base URL |

Environment variables required in production:

**Render (API)**
```
ConnectionStrings__DefaultConnection
Jwt__Key
Jwt__Issuer
Jwt__Audience
Jwt__AccessTokenExpiryMinutes
Jwt__RefreshTokenExpiryDays
AllowedOrigins__0
ASPNETCORE_ENVIRONMENT=Production
```

**Vercel (Frontend)**
```
VITE_API_BASE_URL
```

---

## Security Notes

- Secrets are never committed to source control — local development uses .NET User Secrets, production uses platform environment variables
- Passwords are hashed via ASP.NET Core Identity (PBKDF2)
- JWT tokens are signed with HMAC-SHA256 using a secret key not present in source control
- CORS is restricted to explicitly allow-listed origins, configured per environment
- Authentication endpoints are rate-limited (5 requests/minute) to reduce brute-force risk
- Identity password policy enforces minimum length, digit, and uppercase requirements with account lockout after repeated failures

---

## Roadmap

- [x] Clean Architecture backend scaffold
- [x] JWT authentication (register/login)
- [x] React frontend with protected routes
- [x] Dashboard shell with feature navigation
- [x] Production deployment (Render + Vercel)
- [x] Prayer times integration (Aladhan API)
- [ ] Qibla direction calculator
- [x] Qur'an reader (Quran API integration)
- [ ] Hadith browser
- [ ] Zakat calculator
- [ ] Fasting tracker
- [ ] Favorites system
- [ ] Background job reminders (Hangfire)

---

## Qur'an reader

Open `/quran` from the dashboard or navigation. The reader uses the existing
Settings for script, translation, Tafseer, reciter, and text sizes. Options
include Arabic (24–52px) and translation (12–28px) steppers/sliders. Reciter
selection is collapsed by default; audio, page jump (1–604), Surah/Juz directory,
Tafseer, and fullscreen are available from the floating toolbar.
The directory has separate Surah and Juz / Para views with pinned search controls.
Search by name or exact number, including Arabic and Urdu digits; Arabic name
search ignores vowel marks. Para cards use a compact grid without the Surah list
above them.
Enter a Surah:Ayah reference such as `33:22` in either directory search view and
press Go or Enter to open, reveal, and highlight that Ayah. Arabic/Urdu digits are
also accepted; invalid references and lookup failures are shown in the directory.
The last successfully loaded page is saved automatically in this browser,
separately for each account and for guests. Opening `/quran` resumes that page;
an explicit `?page=...` link takes precedence. Progress is browser-local, not
cross-device, and storage failures are reported without blocking reading.
Quran typography uses locally bundled **Digital Khatt IndoPak** for Indo-Pak
text, **Surah Name V2** for decorative Surah banners, and the four **QPC V2**
Bismillah word glyphs for static Bismillah headings. The existing Indo-Pak font
remains a fallback for unsupported characters such as Urdu numerals.
Indo-Pak sukun and maddah use equivalent supported display marks; words with
unsupported source letters use the local fallback as a whole to preserve Arabic
joining and mark placement. The original bundled Quran text is not rewritten.
Sajdah marking covers the entire Ayah across wrapped lines, with one end symbol,
including when a source row contains only that symbol. Verse-ending pause marks
are shaped on separate blank bases so distinct signs do not overlap.
Uthmani body text and Urdu/English translation fonts are unchanged. The top page margin
uses **Surah Name Color V4** for Surah titles and **Juz Name** for Para names,
without the font's written-out Arabic number labels. Its existing numeric
indicators remain separate. Color-font layers depend on browser support.
Font sources and
license notices are in `frontend/public/fonts/quran-fonts-NOTICE.txt`.

Open **Display** in the reader's bottom control bar to choose **Fit page**. It shows
one continuous Quran page, including its translations, Surah/Para headers and
footer, without section cards or hidden rows. The paper keeps A4-like portrait
proportions on every screen, with thin horizontal rules and separate Arabic and
translation line spacing. Every Para begins with a deep-green first Arabic line, light lettering and a
subtle gold outline; its translation remains on the normal paper background.
Scrolling and fitted views share the same labelled
**Browse**, **Listen**, **Display** and **More** menus, with page navigation above
them and zoom controls in fitted view. Browse searches Surahs, Paras and Ayah
references; Listen contains the reciter and playback controls. Once an Ayah is
selected for recitation, a play/pause button stays directly in the bottom bar,
including while paused, so playback can resume without reopening a menu. Display groups
reading mode, script, translation, text sizes and Tafseer; More contains page jump,
fullscreen and app settings. All menus use the same scrollable panel, shown as a
bottom sheet on phones, and remain available in fullscreen.
The complete paper scales down as a whole. Fonts remain selectable text,
using the chosen script and relative Arabic/translation sizes. A complete page
with translations is necessarily smaller on a phone: pinch to zoom, or use the
zoom buttons (up to 4×) and pan to read comfortably. **Fit page** resets button zoom.
Swipe right for the next Quran page and left for the previous, or use the page
buttons or Left/Right keys. Swipes do not turn pages while zoomed, so panning does
not interrupt reading. The selected view and last page are saved per profile;
old screen-by-screen preferences migrate to whole-page mode. Normal scrolling
remains available and retains the selected font sizes.

Ruku margin marks use an unboxed `ع`: the top number is the Ruku in the Surah,
the middle number is its Ayah count, and the bottom number is the Ruku in the
current Indo-Pak Para, not the whole Quran. Para counts restart even when a Para
opens partway through a Ruku. Urdu translations are optically enlarged by 25%
(35px at the default size, versus 28px for English), consistently in the reader,
Bismillah and Settings previews. Size controls show the rendered language-specific
size; saved preferences are not overwritten. Urdu labels use the Urdu font rather
than forcing Urdu-only letters through the Quranic Arabic font. Mobile scrolling
stacks the page-header labels so larger font settings do not make them overlap.
Page and section numerals retain the selected script but use measured glyph bounds
to match Latin digit height. Compact header/row spacing preserves room for
diacritics. Translations retain full-width justification, with balanced wrapping
to avoid leaving a short fragment alone on the next line.

Arabic flows continuously across Ayahs and source registers, with the selected
translation directly below each responsive row. Opening pages and final section
rows are centered. Verse-final stop signs sit slightly above the medallions,
ink-centered and transparent; boxed `ع` and `م` forms use plain letters. Ruku
indicators remain in the gutter, with no duplicate inline `ع`.
Surah banners, page margins, and Ruku/Manzil labels use the selected Arabic
font and scale with Arabic text size. Their numerals, including translation
verse references, follow the selected Indo-Pak or Uthmani script.
Indo-Pak sukun characters are adapted to the selected font's glyph encoding;
recitation marks are preserved, and Uthmani text is unchanged.

This is **selectable, responsive text**, not a facsimile of Dawat-e-Islami's printed
16-line edition. `/api/quran/page/{page}?translation=kanzul-iman-ur&lines=16`
returns logical source registers, not verified publisher line coordinates.
The reader retains 604 pages but uses Indo-Pak Para openings in both script views,
with a `۞` beside the first words at every Para start, without duplicating
provider-supplied opening symbols. Other Hizb symbols remain unchanged.
This includes Para 23 at Ya-Sin 36:22. Boundary Ayahs move between neighboring provider
pages so each Para starts on a new page. Labels, directory links, and Ayah
navigation share these boundaries; the remaining pagination follows the providers.
The frontend reflows for
the available width; selected whole-Ayah translations are distributed
proportionally by Arabic word count, **not semantically word-aligned**. Provider
Ruku numbering can differ from the printed edition.

**Reading does not require a live Quran provider.** All 6,236 Ayahs, both Arabic
scripts, all 604 pages, the directory, Ayah lookup, Ruku/Manzil/Sajdah metadata,
and three translations are bundled as embedded backend resources. Backend
restarts, empty caches and provider outages do not interrupt reading.
The editions are **Kanzul Iman Urdu, Kanzul Iman English, and Irfan-ul-Quran Urdu**.
Kanzul Iman Hindi and Khazain-ul-Irfan are visibly unavailable until authorized,
verified Ayah-indexed datasets are supplied. Other editions are no longer offered;
previously saved selections are not silently replaced. Audio remains streamed
from Quran.com and requires internet; its errors do not block reading.

Translations, Uthmani text and metadata are sourced from the
[Tanzil Project](https://tanzil.net/trans/); Indo-Pak text and chapter names are
from Quran.com, with QuranWBW script credits. Original source notices are retained.
**Bundled translations are for non-commercial use only.** Commercial use requires
translator/publisher permission. These data terms are separate from the
application source-code license below. Source details and terms are recorded in
`backend\IslamicCompanion.Infrastructure\Data\Quran\SOURCES.txt`; `manifest.json`
records source URLs, retrieval dates and SHA-256 checksums. Startup verifies
checksums, canonical Ayah ordering, edition completeness and page coverage;
missing/corrupt data fails startup explicitly rather than calling a provider.

To intentionally refresh data, run `scripts\Import-QuranData.ps1`, review
source terms and data differences, and run the dataset checks before deploying.
Normal startup, builds and deployment do not fetch data. Data is embedded in
the backend assembly, including published builds; no writable disk or database
is needed for Quran reading. This is provider-outage protection, not browser
offline support: the frontend still needs access to our backend.

Related endpoints: `/api/quran/directory`, `/api/quran/verse/{surah}/{ayah}/page`,
`/api/quran/audio/{surah}/{ayah}?reciter=alafasy`, and
`/api/quran/tafseer/{surah}/{ayah}?tafseer=khazain-ul-irfan` (currently returns an
explicit unavailability response, never a different Tafseer).

Focused checks: `node --experimental-strip-types --test tests\quranLayout.test.ts tests\quranNavigation.test.ts tests\quranScreens.test.ts`
from `frontend`, and `dotnet test backend\IslamicCompanion.Tests` from the root.

## License

This project is proprietary. All rights reserved. You may view and fork the code for personal review via GitHub, but no part of this software may be used, modified, or redistributed without prior written permission.
