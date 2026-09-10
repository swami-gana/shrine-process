# Shrine Process Coordination

A mobile-first PWA for coordinating the daily shrine process — tracking 3-day slot schedules, confirmations, kit collection, and self-booking.

## Quick start (mock data — M1)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` for the coordinator app.  
Open `http://localhost:5173/book` for the self-scheduling view.

The app loads **227 Brahmacharis** from the imported CSV, with slot assignments through January 2027.

## Production setup (M2)

### 1. Google Sheet backend

1. Create a new Google Sheet
2. **Extensions → Apps Script** — paste `apps-script/Code.gs` and `apps-script/Import.gs`
3. Run `setupSheets()` once
4. Create sheets named `ImportPeople` and `ImportSlots`, paste the two CSV files
5. Run `importPeopleFromSheet()` then `importSlotsFromSheet()`
6. In **Project Settings → Script Properties**, set:
   - `COORDINATOR_EMAIL` — email for self-booking notifications
7. **Deploy → New deployment → Web app** — Execute as: Me, Access: Anyone
8. Copy the deployment URL

### 2. Frontend

```bash
cp .env.example .env
# Edit .env and set VITE_API_URL to your Apps Script URL
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.).

## Routes

| Route | Purpose |
|---|---|
| `/` | Coordinator app |
| `/book` | Self-scheduling (no nav, shareable link) |

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Zustand (client state + write queue)
- Google Apps Script + Google Sheets (backend)
- vite-plugin-pwa (installable)
