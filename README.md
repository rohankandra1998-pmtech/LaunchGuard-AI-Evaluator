# LaunchGuard AI Evaluator

LaunchGuard is an open, collaborative workspace for testing and improving AI prompts through structured evaluation. Visitors can browse public workspaces, create AI projects, version prompts, define criteria, build golden datasets, run AI outputs, complete human reviews, analyze failures, draft improved prompts, and export evaluation data without creating an account.

## Public Prototype Model

The product is organized as:

1. Public workspace directory.
2. Individual public workspace.
3. AI evaluation projects inside each workspace.
4. Prompt versions, criteria, golden datasets, generated outputs, human review, results, reports, and CSV export inside each project.

This prototype has no authentication, ownership roles, invitations, private workspaces, request quotas, or usage caps. All workspaces and project data are publicly readable and publicly editable through the publishable Supabase key.

That includes project lifecycle controls: anyone with public access can currently move a project to Trash or restore it. These actions are not permission-protected.

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
4. Confirm that Supabase Cron (`pg_cron`) is available in the project and that the schema created the daily purge job.
5. Confirm the `workspaces` and project-related tables appear in the Table Editor.
6. Add the project URL and publishable key to `.env.local`.
7. Optionally run `supabase/seed.sql` in the SQL Editor to add a demonstration workspace and project.

The schema explicitly grants Data API access to `anon` and `authenticated`, enables RLS on every exposed table, and applies public collaborative CRUD policies. It also creates foreign-key indexes and a unique database-generated workspace slug.

## Existing Supabase Project Migration

Back up the database before applying any production migration. Existing account-based installations must first run `supabase/migrations/20260711214913_public_workspaces.sql`, then apply every later committed migration in timestamp order: `supabase/migrations/20260715223000_propagate_project_activity.sql`, `supabase/migrations/20260716120000_project_trash_retention.sql`, `supabase/migrations/20260717221000_prompt_version_variable_schema.sql`, and `supabase/migrations/20260719233000_evaluation_criteria_sort_order.sql`.

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

For a project managed through the dashboard, paste each unapplied migration into the SQL Editor and run it once in timestamp order. The project-activity timestamp migration must be applied before the Trash-retention migration, the prompt-variable migration must follow Trash retention, and the Evaluation Criteria ordering migration must run last. That final migration adds project-scoped `sort_order`, backfills existing criteria in their previous `created_at` order with `id` as a deterministic tie-breaker, and installs the atomic reorder function. The retention migration enables `pg_cron`; Supabase Cron must be available for the daily cleanup schedule to be created. The legacy `profiles` table may remain for historical data, but the application does not query it or depend on Supabase Auth.

## Project Trash Lifecycle

Active projects appear in workspace grids and remain available throughout the evaluation workflow. Moving a project to Trash hides it from active workspace content and blocks its project pages, editing actions, AI routes, review tools, reports, and exports. Its prompt versions, criteria, test cases, runs, outputs, reviews, ratings, and reports remain attached and become available again if the project is restored.

Trashed projects are recoverable for 30 days from the workspace-scoped Trash page. Restoration only clears `trashed_at`; it does not copy or recreate child records. Once per day at 03:00, the database job `launchguard-purge-trashed-projects` calls `public.purge_expired_trashed_projects()` and permanently deletes projects that have been in Trash for at least 30 days. Existing cascading foreign keys remove their associated evaluation data.

Verify the scheduled job in the Supabase SQL Editor:

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'launchguard-purge-trashed-projects';
```

Inspect recent executions with:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid from cron.job where jobname = 'launchguard-purge-trashed-projects'
)
order by start_time desc
limit 20;
```

This is a public collaborative prototype with no authentication or ownership controls. Anyone with public access may move or restore projects during the recovery window. There is intentionally no user-facing action to bypass the 30-day window and delete a project immediately.

## Variable-Aware Prompt Builder

Every Prompt Version stores its own structured `variable_schema`, so historical versions remain reproducible when variables are added, removed, or changed. Supported types are `text`, `long_text`, `number`, `boolean`, and `select`. New placeholders use `{{variable_name}}`; legacy `{variable_name}` placeholders remain supported when compiling existing prompts.

Create AI Project and all later version flows use the same Prompt Builder. Project creation captures Project Context first, then builds active Prompt Version 1 from the submitted structured variable schema. The builder detects placeholders, blocks unresolved or malformed variables, warns about configured variables that are unused, and provides typed example-value controls. Configured placeholders are highlighted in the editor, resolved example values are highlighted in Final Prompt Preview, and users can copy the exact valid compiled prompt. Highlighting is visual only and never alters submitted prompt text. Example values feed the read-only Final Prompt Preview and apply configured defaults, but they are temporary builder state and are not stored with the Prompt Version.

Run Test sends the compiled system prompt and a sample user message to the selected configured model, including before a new project is saved. Pre-creation and existing-project sandbox runs are ephemeral: LaunchGuard does not create projects, prompt versions, test cases, evaluation runs, generated outputs, reviews, ratings, or reports from them. Formal Golden Dataset evaluations remain separate and use the selected Prompt Version’s same variable schema and compiler.

`projects.variables` remains as a legacy list of active variable keys. New projects derive it from Prompt Version 1’s structured variable keys; the migration backfills existing versions from legacy project values. Activating or editing the active version synchronizes the legacy list, while creating or editing an inactive draft does not change it.

## Design System

LaunchGuard uses one default light lavender-and-purple visual system. Purple is the primary brand and action color, while white and lavender surfaces establish hierarchy across pages, cards, forms, tables, and prompt workspaces. Green, amber, and red retain their semantic meanings for success, warning, and danger states. Dark mode is not implemented.

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
- `/workspaces/[workspaceSlug]/trash` - recoverable projects awaiting automatic deletion
- `/workspaces/[workspaceSlug]/projects/new` - create an AI project
- `/workspaces/[workspaceSlug]/projects/[projectId]` - project overview
- `/workspaces/[workspaceSlug]/projects/[projectId]/prompts`
- `/workspaces/[workspaceSlug]/projects/[projectId]/prompts/new`
- `/workspaces/[workspaceSlug]/projects/[projectId]/prompts/[versionId]/edit`
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
- `/api/ai/test-prompt` - ephemeral Prompt Builder sandbox; does not persist evaluation data
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
