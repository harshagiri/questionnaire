# Questionnaire

SpinExpert Health Screening is a role-based screening questionnaire web app for patients, doctors, and admins.

## What is scaffolded

- Patient intake flow with confidentiality statement, progress, autosave, review, and thank-you state
- Access screen with role selection and demo OTP copy popup for patients
- Receptionist workspace for appointment booking, doctor matching, and questionnaire builder
- Doctor dashboard with sectioned consult validation and discrete answer views
- Admin metrics view for completion time, fill time, and backend-driven RBAC
- REST API routes for health, questionnaire definitions, appointments, patient intake, and metrics
- Middleware-based role guards using cookie-backed demo sessions
- Prisma schema for PostgreSQL
- Docker Compose for the app container and PostgreSQL container

## Run locally

1. Copy `.env.example` to `.env` and update the database URL if needed.
2. Install dependencies.
3. Run `npm run db:generate`.
4. Run migrations with `npm run db:migrate`.
5. Start the app with `npm run dev`.

`DOCTORS_STORAGE_MODE` controls `/api/doctors` persistence:

- `auto` (default): use database if available, otherwise file store at `data/doctors.json`
- `database`: require PostgreSQL/Prisma (returns 503 if unavailable)
- `file`: always use local file store

If you already created doctors in file mode and want to move them to Postgres:

1. Set `DOCTORS_STORAGE_MODE=database` and ensure `DATABASE_URL` is reachable.
2. Run `npm run db:migrate:doctors`.

## Docker

Build and start the two containers with:

```bash
docker compose up --build
```

The app listens on port `3000` and PostgreSQL on `5432`.

## RBAC and local access

- The `/access` page issues a demo session cookie for the selected role.
- Patient sessions use a popup OTP code instead of SMS or WhatsApp for now.
- Protected routes are gated by middleware, so doctor, receptionist, and admin pages require the matching role cookie.
- If you want to run the app locally while keeping PostgreSQL in Docker, point `DATABASE_URL` at the container and use `npm run dev`.

## Notes

- The current scaffold uses mocked dashboard data so the UX can be reviewed before the persistence layer is connected.
- The backend schema is structured to support configurable RBAC, questionnaire versioning, patient-doctor association, and usage metrics.This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
