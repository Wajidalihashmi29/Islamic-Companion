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
        ├── context/       → React Context (auth state)
        └── pages/         → Route-level views
```

**Dependency direction:** `API → Infrastructure → Application → Domain`. Domain has zero external dependencies, which keeps core business rules testable and framework-agnostic.

---

## Local Development Setup

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js LTS](https://nodejs.org)
- A free [Neon.tech](https://neon.tech) PostgreSQL database
- Visual Studio Community (backend) or any .NET-capable IDE
- VS Code (frontend)

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

API will be available at `https://localhost:7037`, with Swagger UI at `/swagger`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
VITE_API_BASE_URL=https://localhost:7037/api
```

```bash
npm run dev
```

App runs at `http://localhost:5173`.

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
Jwt__ExpiryMinutes
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
- [ ] Prayer times integration (Aladhan API)
- [ ] Qibla direction calculator
- [ ] Qur'an reader (Quran API integration)
- [ ] Hadith browser
- [ ] Zakat calculator
- [ ] Fasting tracker
- [ ] Favorites system
- [ ] Background job reminders (Hangfire)

---

## License

MIT
