# LaunchGuard AI Evaluator

LaunchGuard is an open, collaborative workspace for testing and improving AI prompts through structured evaluation. Visitors can browse public workspaces, create AI projects, version prompts, define criteria, build golden datasets, run AI outputs, complete human reviews, analyze failures, draft improved prompts, and export evaluation data without creating an account.

## Public Prototype Model

The product is organized as:

1. Public workspace directory.
2. Individual public workspace.
3. AI evaluation projects inside each workspace.
4. Prompt versions, criteria, golden datasets, generated outputs, human review, results, reports, and CSV export inside each project.

This prototype has no authentication, ownership roles, invitations, private workspaces, request quotas, or usage caps. All workspaces and project data are publicly readable and publicly editable through the publishable Supabase key.

> Do not store sensitive, confidential, personal, regulated, or production-secret information in this prototype.

## Tech Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS
- Supabase Postgres with public RLS policies
- OpenAI API calls in server route handlers only
- Zod-validated structured outputs
- Vercel-ready deployment

## Model Strategy

- Product output generation uses `OPENAI_PRODUCT_MODEL`, defaulting to `gpt-4.1`.
- Higher-reasoning evaluation features use `OPENAI_REASONING_MODEL`, defaulting to `gpt-5`.
- The OpenAI key is read only by server-side code under `app/api/ai` and `lib/openai.ts`.
- The app does not impose a test-case cap or an artificial AI-generation limit.

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_PRODUCT_MODEL=gpt-4.1
OPENAI_REASONING_MODEL=gpt-5
```

Never rename `OPENAI_API_KEY` with a `NEXT_PUBLIC_` prefix. A Supabase service-role key is not needed and must not be added to browser code.

## Fresh Supabase Project

1. Create a new Supabase project.
2. Open the Supabase SQL Editor.
3. Run the complete contents of `supabase/schema.sql` once.
4. Confirm the `workspaces` and project-related tables appear in the Table Editor.
5. Add the project URL and publishable key to `.env.local`.
6. Optionally run `supabase/seed.sql` in the SQL Editor to add a demonstration workspace and project.

The schema explicitly grants Data API access to `anon` and `authenticated`, enables RLS on every exposed table, and applies public collaborative CRUD policies. It also creates foreign-key indexes and a unique database-generated workspace slug.

## Existing Supabase Project Migration

Back up the database before applying any production migration. Existing account-based installations must first run `supabase/migrations/20260711214913_public_workspaces.sql`, then apply every later committed migration in timestamp order, including `supabase/migrations/20260715223000_propagate_project_activity.sql`.

The migration:

1. Creates `public.workspaces`.
2. Adds `projects.workspace_id`.
3. Creates `LaunchGuard Community` when existing projects need a workspace.
4. Assigns all existing projects to that workspace.
5. Preserves prompt versions, criteria, test cases, runs, outputs, reviews, ratings, and reports through their existing project relationships.
6. Removes obsolete project-related `user_id` columns and owner policies after the backfill.
7. Adds public RLS policies and explicit Data API grants.

For a repository linked with the Supabase CLI, apply committed migrations with:

```bash
npx supabase db push
```

For a project managed through the dashboard, paste each unapplied migration into the SQL Editor and run it once in timestamp order. The project-activity timestamp migration must also be executed there so project child changes update the workspace directory. The legacy `profiles` table may remain for historical data, but the application does not query it or depend on Supabase Auth.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The first screen works without a Supabase session.

Validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```

## Product Routes

- `/` - public landing page
- `/workspaces` - public workspace directory
- `/workspaces/new` - create a workspace
- `/workspaces/[workspaceSlug]` - workspace detail and project list
- `/workspaces/[workspaceSlug]/projects/new` - create an AI project
- `/workspaces/[workspaceSlug]/projects/[projectId]` - project overview
- `/workspaces/[workspaceSlug]/projects/[projectId]/prompts`
- `/workspaces/[workspaceSlug]/projects/[projectId]/prompts/new`
- `/workspaces/[workspaceSlug]/projects/[projectId]/criteria`
- `/workspaces/[workspaceSlug]/projects/[projectId]/dataset`
- `/workspaces/[workspaceSlug]/projects/[projectId]/review`
- `/workspaces/[workspaceSlug]/projects/[projectId]/results`
- `/workspaces/[workspaceSlug]/projects/[projectId]/reports`

## Server API Routes

- `/api/ai/suggest-criteria`
- `/api/ai/generate-test-cases`
- `/api/ai/generate-output`
- `/api/ai/error-analysis`
- `/api/ai/create-prompt-version`
- `/api/export/project-csv`

Every AI route validates workspace, project, prompt-version, and test-case relationships before using the server-side OpenAI key.

## Deployment to Vercel

1. Push the feature branch to GitHub and review it through a pull request.
2. Apply the Supabase migration before deploying the new application routes.
3. Import the repository in Vercel.
4. Add the five environment variables listed above.
5. Deploy and complete the public-flow QA checklist.

## Prototype Limitations

- Every visitor can read, create, edit, and delete collaborative data.
- There is no change attribution, revision audit log, undo history, moderation, or abuse protection.
- OpenAI usage is paid by the server-side API key owner and is intentionally uncapped in this prototype.
- Concurrent editors can overwrite one another because real-time conflict handling is not included.
- LLM-as-a-judge remains outside this MVP; review scores are human-entered.
