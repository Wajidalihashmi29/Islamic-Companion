# Islamic Companion

An Islamic lifestyle application bringing Quran reading, Tafseer, audio recitation,
and prayer times together in a responsive web experience.

**[Explore the live application](https://islamic-companion-snowy.vercel.app)**

## Overview

Islamic Companion is designed for comfortable reading and convenient access to
daily Islamic resources on mobile and desktop. Personal reading preferences,
saved progress, and favourite Surahs help users continue where they left off.

## Features

- **Quran reading** - Browse in Indo-Pak or Uthmani script, with
  adjustable text sizes and Urdu or English translations.
- **Tafseer** - Read Sirat-ul-Jinan commentary alongside the Quran.
- **Audio recitation** - Listen to continuous recitation with automatic Ayah
  highlighting and page following.
- **Search and navigation** - Find Surahs, Paras, or individual Ayahs and return
  to saved reading progress.
- **Favourite Surahs** - Keep a personal collection without changing the general
  reading position.
- **Responsive reading controls** - Switch between fitted and scrolling views,
  use fullscreen, and zoom or pan on touch devices.
- **Prayer times and Hijri dates** - View location-based prayer times and dates
  with an adjustable moon-sighting offset.
- **Account access** - Register, verify email, sign in, and recover an account
  through password reset.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| Backend | ASP.NET Core Web API, Entity Framework Core, ASP.NET Core Identity |
| Database | PostgreSQL |

The backend separates domain models, application contracts, infrastructure, and
API endpoints. The React frontend provides the reading interface and account
experience.

## Project Status

The application is actively developed. Quran reading and prayer times are
available; Qibla, Hadith, Zakat, and fasting tools are planned.

## License

This project is proprietary. All rights reserved. You may view and fork the code
for personal review via GitHub, but no part of this software may be used, modified,
or redistributed without prior written permission.
