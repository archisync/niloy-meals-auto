# Meals Calculation

A responsive meals tracker built with Next.js App Router and Tailwind CSS with local first storage and Turso sync.

## Features

- Login with `USERNAME` and `PASSWORD`
- Session persistence using `AUTH_KEY`
- Monthly summary cards for Monthly cost Money added this month and Money left
- Red alert state and popup when money left is zero or negative
- Meals table with Date and Day Breakfast Lunch Dinner and Total Cost
- GMT+6 Bangladesh time based month and day rendering
- Circular meal buttons that switch from grey to green tick and red cross
- Missed meal automation for skipped previous meals and for Breakfast plus Dinner to Lunch cross
- Settings for default meal costs
- Advanced option with Save and Cancel to enable custom meal prices
- Right click on desktop and long press on mobile to set custom meal price
- Add money form with Date Amount Note and Save
- Carry forward balance across months
- Local storage updates first with background Turso sync

## Tech stack

- Next.js 16 App Router
- Tailwind CSS 4
- Turso with `@libsql/client`

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy env file

```bash
cp .env.example .env
```

3. Fill all required environment variables in `.env`

- `USERNAME`
- `PASSWORD`
- `AUTH_KEY`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

4. Run development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy on Vercel

1. Import this repository in Vercel
2. Add the same environment variables from `.env`
3. Deploy

## Build and lint

```bash
npm run lint
npm run build
```
