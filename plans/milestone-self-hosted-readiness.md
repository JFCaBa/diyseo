# Milestone Specification: Self-Hosted Release Readiness

## 1. Objective
Define the requirements for preparing the open-source SEO platform for its initial self-hosted release. This milestone focuses entirely on developer experience (DX), deployment stability, configuration management, and ensuring that any user can easily clone, build, and run the application in their own environment.

## 2. Scope & Constraints
*   **Included**: Environment variable documentation (`.env.example`), Prisma configuration review, local development setup guidance (OrbStack/Postgres), build/run commands, and a release checklist.
*   **Constraints**: No new product features. No redesigns of the UI, embeddable widget, or AI workflows. The focus is strictly on stabilization, documentation, and shipping readiness.

## 3. Environment Configuration

To ensure a seamless setup, the project must clearly define all required and optional environment variables.

### 3.1. Required Variables (`.env.example`)
Create a `.env.example` file in the project root with the following structure:

```env
# --- Database Configuration ---
# Required: Connection string to your PostgreSQL database.
DATABASE_URL="postgresql://user:password@localhost:5432/diyseo?schema=public"

# --- Application Configuration ---
# Required: The absolute URL where your platform is hosted.
# Used for SEO canonicals, sitemaps, RSS feeds, and widget API calls.
# Example: https://seo.mycompany.com (Do not include trailing slash)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# --- AI Provider Configuration (If Applicable) ---
# Add your specific AI provider key here based on your chosen implementation
# OPENAI_API_KEY="your-api-key-here"
```

## 4. Local Development & Setup Flow

Provide clear instructions in the `README.md` for getting the application running locally from scratch.

### 4.1. Database Setup (OrbStack / Docker)
Recommend OrbStack (or standard Docker Desktop) for a lightweight local PostgreSQL instance.

```bash
# Example quick-start for local Postgres using Docker/OrbStack
docker run --name diyseo-postgres -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=diyseo -p 5432:5432 -d postgres:15
```

### 4.2. Installation & Initialization
Document the standard Node.js/Next.js initialization flow:

```bash
# 1. Install dependencies
npm install

# 2. Apply database migrations
npx prisma migrate dev

# 3. Seed the database with the initial Workspace and Demo Site
npx prisma db seed

# 4. Start the development server
npm run dev
```

## 5. Production Build & Run Flow

Ensure the build process is stable and the run commands are documented for a production environment.

### 5.1. Build & Run Commands
```bash
# 1. Build the Next.js application
npm run build

# 2. Deploy database migrations (Do NOT use 'migrate dev' in production)
npx prisma migrate deploy

# 3. Start the production server
npm run start
```

### 5.2. Production Considerations
*   **Security**: Remind users to secure their `DATABASE_URL` and ensure their server environment (e.g., VPS, Vercel, Railway) has the correct environment variables set.
*   **Next.js Caching**: Note that Server Actions and App Router caching might require occasional manual revalidation depending on how aggressive the cache settings are configured in the `next.config.js`.
*   **Node Version**: Specify the required Node.js version (e.g., `>= 18.17.0`) in the `package.json` engines field.

## 6. Prisma Configuration Cleanup
*   Ensure the `schema.prisma` file is clean, with consistent naming conventions and well-defined relationships.
*   Ensure `onDelete: Cascade` is applied appropriately (e.g., deleting a `SiteProject` cleans up its `Article`s, `Keyword`s, and `BrandProfile`).
*   Ensure the `prisma/seed.ts` script is idempotent (can be run multiple times safely without throwing unique constraint errors).

## 7. Release Checklist for Open-Source Users
Before tagging v1.0.0, ensure the following checklist is completed:

*   [ ] `.env.example` is present and accurate.
*   [ ] `README.md` contains step-by-step setup instructions (Database, Install, Migrate, Seed, Run).
*   [ ] `README.md` explains how to integrate the embeddable widget (Slice 3).
*   [ ] `prisma/seed.ts` successfully bootstraps a usable state (Workspace + Site).
*   [ ] `npm run build` succeeds without linting or type errors.
*   [ ] All public-facing blog features (RSS, Atom, Sitemap, Robots.txt) respect the `NEXT_PUBLIC_APP_URL` variable.
*   [ ] No hardcoded `localhost` URLs exist outside of development environments.

## 8. Acceptance Criteria
*   [ ] A developer can clone the repository, run the documented Docker command for Postgres, run `npm install`, `npx prisma migrate dev`, `npx prisma db seed`, and start using the app without touching code.
*   [ ] The application builds cleanly for production.
*   [ ] Documentation clearly outlines the difference between development and production database commands (`migrate dev` vs `migrate deploy`).