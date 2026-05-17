# NexusAI

A premium AI chat app inspired by ChatGPT and Grok — installable as a PWA with streaming responses, conversation history, and markdown rendering.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/ai-chat run dev` — run the frontend (port 25374)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI integration (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Wouter routing
- API: Express 5, SSE streaming for AI responses
- AI: OpenAI via Replit AI Integrations (gpt-5.4, streaming)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- PWA: manifest.json + service worker for installability

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/conversations.ts`, `messages.ts` — DB schema
- `artifacts/api-server/src/routes/openai/` — AI chat routes
- `artifacts/ai-chat/src/pages/chat.tsx` — main chat UI
- `artifacts/ai-chat/public/manifest.json` — PWA manifest
- `artifacts/ai-chat/public/sw.js` — service worker

## Architecture decisions

- SSE streaming for AI responses — EventSource doesn't support POST, so raw fetch + ReadableStream is used on the client
- Conversations + messages stored in PostgreSQL for persistent history
- PWA manifest + service worker makes the app installable on desktop and mobile
- OpenAI gpt-5.4 via Replit AI Integrations — no user API key required
- Markdown + syntax highlighting for assistant messages using react-markdown + react-syntax-highlighter

## Product

Users can chat with a powerful AI assistant (gpt-5.4). Conversations are saved, browsable in the sidebar, and deletable. Responses stream token-by-token like ChatGPT. The app is installable on any device as a PWA.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- SSE endpoints cannot use generated React Query hooks — use raw fetch + ReadableStream
- `gpt-5.4` uses `max_completion_tokens`, not `max_tokens`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/ai-integrations-openai/SKILL.md` for AI integration details
