# 🌳 Roots — Interactive Family Tree Explorer

Create, manage, import, and explore family trees in both a traditional 2D editor
and an immersive 3D view. Built for fast data entry and exploration rather than
genealogy form-filling.

## Features (Phase 1)

- **Person management** — full profiles (names, dates, places, occupation, biography, notes).
- **One-click relationship builder** — add a Parent, Sibling, Partner, or Child from any
  profile; the new person and the correct family links are created in a single step.
- **2D tree editor** — layered generations, partner/parent connectors, pan/zoom,
  collapse/expand branches, click-to-focus.
- **3D Roots view** — the flagship: a navigable 3D space (orbit/zoom/pan, double-click to
  focus) with generations as layers, branch separation in depth, instanced nodes,
  distance-based label LOD.
- **Global search** (⌘K) — by name, place, occupation, or notes; focuses the result in the
  current view.
- **GEDCOM / WebTrees import** — upload a `.ged` file, preview counts, then import. Original
  record ids are preserved as `gedcomId`.
- **Timeline** — births, deaths, and marriages on a chronological track, filterable by century.
- **Statistics** — totals, generations, living/deceased, largest branch, oldest ancestor,
  most descendants.
- **Auth** — email/password (NextAuth credentials, hashed with bcrypt).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS v4 · shadcn/ui (Base UI) ·
Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL · NextAuth v5 · Three.js / React Three Fiber / drei.

## Data model

Genealogy-standard and GEDCOM-aligned, so imports map cleanly:

- `Person` (GEDCOM `INDI`)
- `Family` (GEDCOM `FAM`) — two partners + marriage info
- `ChildInFamily` — links a child to a family

Relationships are **derived** from `Family`/`ChildInFamily` (parents/siblings/partners/children),
not stored as a separate edge type. See `src/lib/relationships.ts` and `src/lib/graph.ts`.

## Getting started

### 1. Database

A `docker-compose.yml` is included for Postgres 16:

```bash
docker compose up -d
```

> If you can't pull the Docker image, any local Postgres works — the default
> `DATABASE_URL` expects a database `roots` owned by role `roots` (password `roots`)
> on `localhost:5432`. To create it with a local install:
> ```bash
> createuser roots --createdb        # then set password 'roots'
> createdb roots -O roots
> ```

### 2. Environment

```bash
cp .env.example .env     # then set AUTH_SECRET (openssl rand -base64 32)
```

### 3. Migrate, seed, run

```bash
npm install
npx prisma migrate dev          # apply schema
npx prisma db seed              # demo user + sample "Doe Family" tree
npm run dev
```

Open http://localhost:3000 and sign in with the seeded account:

- **Email:** `demo@roots.test`
- **Password:** `demo12345`

A sample GEDCOM file to test import lives at `prisma/sample.ged`.

## Not yet implemented (later phases)

AI/NLP smart entry · real-time multi-editor collaboration (roles schema is stubbed) ·
media upload pipeline (media is URL-based for now) · 10k+ node clustering/virtualization tuning ·
Vercel deployment config.
