# LaunchGuard AI Evaluator

LaunchGuard is a human evaluation workspace for AI product builders. It helps teams create AI projects, version prompts, define Playground-style variables, build golden datasets, run AI outputs, manually review failures, summarize human notes, and draft improved prompt versions before launch.

## MVP Scope

This first version focuses on the human eval workflow:

1. Sign up and log in with Supabase email/password auth.
2. Create an AI project with variables and an initial system prompt.
3. Automatically create Prompt Version 1.
4. Define or generate evaluation criteria.
5. Build a golden dataset manually or with GPT-5 starter cases.
6. Run GPT-4.1 or GPT-5 outputs server-side.
7. Score every generated output with Good, Average, or Bad ratings per criterion.
8. View results dashboards and failure distributions.
9. Generate GPT-5 error analysis and prompt vNext drafts.
10. Export project dataset and human review data as CSV.

LLM-as-a-judge is intentionally left for v2, but the database and route structure keep generated outputs, human reviews, and future judge runs separate.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth and Postgres
- `@supabase/ssr` cookie-based auth
- OpenAI API, called only from server route handlers
- Vercel-ready deployment

## Model Strategy

- Product output generation defaults to `OPENAI_PRODUCT_MODEL`, defaulting to `gpt-4.1`.
- Higher-reasoning assistant features use `OPENAI_REASONING_MODEL`, defaulting to `gpt-5`.
- No other model names are used in application logic.
- Structured AI helper features use Zod schemas rather than free-form parsing.

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_PRODUCT_MODEL=gpt-4.1
OPENAI_REASONING_MODEL=gpt-5
```

Never expose `OPENAI_API_KEY` in browser code. All OpenAI calls live under `app/api/ai/*` and `lib/openai.ts`.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Add the Supabase URL and publishable key to `.env.local`.
5. Ensure email/password auth is enabled.
6. Optionally run `supabase/seed.sql` after replacing the demo UUID with your authenticated user id.

The schema includes UUID primary keys, timestamps, foreign keys, indexes, RLS policies, and a partial unique index so each project has only one active prompt version.

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Useful checks:

```bash
npm run typecheck
npm run build
```

## Deployment To Vercel

1. Push the repo to GitHub.
2. Import it in Vercel.
3. Add the same environment variables from `.env.example`.
4. Deploy.

The app uses Supabase SSR cookie auth, so no service-role key is required for the browser or normal server routes.

## Product Routes

- `/` landing page
- `/login`
- `/signup`
- `/dashboard`
- `/projects/new`
- `/projects/[projectId]`
- `/projects/[projectId]/prompts`
- `/projects/[projectId]/criteria`
- `/projects/[projectId]/dataset`
- `/projects/[projectId]/review`
- `/projects/[projectId]/results`
- `/projects/[projectId]/reports`

## API Routes

- `/api/ai/suggest-criteria`
- `/api/ai/generate-test-cases`
- `/api/ai/generate-output`
- `/api/ai/error-analysis`
- `/api/ai/create-prompt-version`
- `/api/export/project-csv`

## Future Roadmap

- LLM-as-a-judge as v2, stored separately from human review ratings.
- Judge calibration against human ratings.
- Prompt comparison reports across versions.
- Team workspaces and reviewer assignments.
- More export formats after CSV.
- Richer eval run history and regression charts.
