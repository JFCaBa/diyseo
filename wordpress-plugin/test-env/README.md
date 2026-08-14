# DIYSEO Sync — local integration test harness

Throwaway WordPress + MariaDB (OrbStack/Docker) for testing the `diyseo-sync`
plugin against a locally running DIYSEO app. The plugin under
`../diyseo-sync/` is bind-mounted, so PHP edits show up on the next request.

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│ WordPress container      │  HTTP  │ DIYSEO app on host (:3000)    │
│ localhost:8090           │ ─────▶ │ npm run dev                  │
│ plugin: diyseo-sync (ro) │  Bearer│ /api/v1/sites/:id/articles   │
└─────────────────────────┘  key   └───────────────┬──────────────┘
   host.docker.internal:3000                        │ Prisma
                                        ┌────────────▼─────────────┐
                                        │ Postgres :5442 (db diyseo)│
                                        └──────────────────────────┘
```

## One-time setup of the DIYSEO database

The app's `.env` points `DATABASE_URL` at a `diyseo` database on the Postgres
running at `127.0.0.1:5442`. If that role/db does not exist yet (fresh machine),
create it once with the password already in `.env`, then migrate + seed:

```bash
# from repo root — extract the password used in .env
PW=$(grep -E '^DATABASE_URL' .env | sed -E 's#.*//diyseo:([^@]+)@.*#\1#')
docker exec funcionalista-postgres-1 psql -U funcionalista -d funcionalista \
  -c "CREATE ROLE diyseo LOGIN PASSWORD '$PW';"
docker exec funcionalista-postgres-1 psql -U funcionalista -d funcionalista \
  -c "CREATE DATABASE diyseo OWNER diyseo;"

npm run prisma:migrate:deploy   # apply schema
npm run prisma:seed             # 1 workspace + 1 site + 3 PUBLISHED demo articles
```

> The container name `funcionalista-postgres-1` is the shared Postgres instance
> on this machine; adjust if yours differs. Creating an isolated `diyseo` role +
> db does not touch other projects' data.

## Run the test

```bash
# terminal 1 — DIYSEO app (the plugin's data source)
npm run dev                     # :3000

# mint a Publishing API key for the seeded site (prints Site ID + key)
npm run mint:api-key

# bring up WordPress
docker compose -f wordpress-plugin/test-env/docker-compose.yml up -d
open http://localhost:8090      # finish the 2-minute WP install wizard
```

Then in WP Admin:

1. **Plugins** → activate **DIYSEO Sync**.
2. **Settings → DIYSEO Sync** → paste:
   - **Base URL**: `http://host.docker.internal:3000`
   - **Site ID**: from `npm run mint:api-key`
   - **API key**: from `npm run mint:api-key`
3. Click **Test connection** → expect *Connected successfully.*
4. Set an interval + author, **Save Settings**, then **Sync now**.
5. **Posts** → the 3 demo articles now exist as native WordPress posts.

## Notes

- **Networking**: from inside the container the host is `host.docker.internal`.
  If the app runs on a different port, change the Base URL accordingly.
- **Plugin edits**: the mount is read-only and live; just edit the PHP under
  `../diyseo-sync/` and re-run **Sync now** (no container restart needed).
- **Debug log**: `WP_DEBUG_LOG` is on — read sync errors with
  `docker compose -f wordpress-plugin/test-env/docker-compose.yml exec wordpress \
  cat wp-content/debug.log`.
- **Fresh start**: `docker compose -f wordpress-plugin/test-env/docker-compose.yml down -v`
  wipes the WordPress + DB volumes (does not touch the DIYSEO Postgres).
```
