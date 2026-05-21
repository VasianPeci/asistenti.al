# Asistenti.al — Project Context

## What it is
RAG-powered conversational AI for navigating Albanian government services.
Users ask in natural language (Albanian or English), get step-by-step
guidance grounded in real government documents.

## Stack
- Backend: Node.js 20, TypeScript, Express, Vertex AI Gemini 1.5 Flash,
  Vertex AI RAG Engine
- Frontend: React + Vite, TypeScript, Tailwind CSS, react-i18next
- Deployment: Cloud Run (backend), Firebase Hosting (frontend)

## Architecture
User → React UI → Express API (streaming SSE) → Vertex AI Gemini agent
with RAG context from Vertex AI RAG Engine → structured JSON response
rendered as interactive StepCards

## Code conventions
- Strict TypeScript, no `any`
- All user-facing strings go through i18n
- Albanian and English supported throughout
- Errors return graceful fallbacks, never crash the chat
- Source attribution required on every RAG-grounded answer
