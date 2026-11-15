# Iron Pulse: SportProgression

A personal strength-training tracker: log workouts (exercises → sets × reps × weight, with notes), and see your progression per exercise over time.

- `backend/`: NestJS + TypeORM REST API (Swagger UI at `http://localhost:3001/api`)
- `frontend/`: Angular 21 app (Tailwind v4, mn-angular-lib), English + Dutch

## Quick start (no database or Google account needed)

```bash
cd backend
cp .env.example .env   # defaults: SQLite file database + demo login
npm install
npm run start:dev      # http://localhost:3001
```

```bash
cd frontend
npm install
npm start              # http://localhost:4201
```

Open http://localhost:4201 and choose **Continue as demo user**. The demo account is created with eight weeks of sample training so the progress charts have data. All data lives in `backend/dev-data.sqlite`: delete that file to start fresh.

## Configuration (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `DB_TYPE` | `sqljs` = single-file SQLite (local dev). Empty/`mysql` = MySQL via `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SSL`. |
| `DEV_LOGIN` | `true` enables the passwordless demo login. Only honoured with `NODE_ENV=development` and `DB_TYPE=sqljs`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google sign-in (optional for local dev). |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Session tokens (httpOnly cookies). |
| `FRONTEND_URL` | Allowed CORS origin and post-login redirect. |
| `DB_SYNCHRONIZE` | Let the app rewrite tables to match the code on startup. On in development, **off in production** unless set to `true` (it can drop columns and their data). After deploying a schema change: back up, then run once with `DB_SYNCHRONIZE=true`. |
| `DB_LOGGING` | `true` prints every SQL statement (includes user data). Off by default. |
| `TRUST_PROXY` | Number of reverse-proxy hops in front of the API (e.g. `1`), so rate limiting sees real client addresses. |
| `ANTHROPIC_API_KEY` | Claude API key for the Analyse buttons. Server-side only, never sent to the browser. Empty switches the feature off. In production set it as an environment variable or secret on the host that runs the API. |
| `AI_ALLOWED_EMAILS` | The AI role: comma-separated e-mail addresses of the accounts that may use the analysis and plan features (`*` for everyone). Other users do not see the AI buttons and the endpoints refuse them, so they cannot spend API credit. The role can also be set per user in the database (`users.aiAccess`). |

On an empty database the API seeds a starter catalog of common exercises.

## Features

- Workouts with exercises, sets (reps × kg), exercise notes and workout notes
- Fast logging: searchable exercise picker, "last time" reference with set-by-set prefill, warm-up sets that never count, undo after removing a set
- Personal records for the heaviest lift and for the most reps at a weight (also for bodyweight exercises)
- Templates: reusable workout plans with target sets × reps per exercise; start a workout from one, see the plan while logging, save a finished workout as a template
- Bodyweight exercises (pull-ups, push-ups, dips…): logged as reps, with optional extra weight
- Reorder exercises and link neighbours into supersets; logging alternates between the members automatically
- Finish (lock) / reopen workouts, re-run a finished workout through the normal new-workout flow
- Progress: weekly consistency, streak, muscle-group balance, per-exercise charts (estimated 1RM, top weight, volume, reps) and records
- AI analysis on request (Claude): this week's workouts, or one finished workout compared with its earlier sessions. Limited to 10 per hour per account; the logged sets and notes are sent to Anthropic. The week analysis flags muscle groups you skipped, except the ones you switch off under Profile
- AI plan on request (Claude): a suggested next workout or a whole training week with sets × reps and suggested weights, using only catalog exercises; start it as a workout or save it as a template. Plans follow the training days and the "how I like to train" note set on Profile
- Shared exercise catalog (rename/delete your own entries), history with search, English + Dutch, sidebar layout on desktop

## Tests

```bash
cd backend && npm test
cd frontend && npm test
```
