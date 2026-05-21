# Deploying Asistenti.al

This guide takes you from a fresh checkout to a live, working app.
Total time: ~15 minutes the first time, ~5 minutes for redeploys.

> Heads-up on env-var names: the original deploy spec mentioned
> `VERTEX_RAG_CORPUS_ID`, `GEMINI_MODEL`, and `VITE_API_URL`. The code
> actually reads `VERTEX_RAG_CORPUS`, `VERTEX_MODEL`, and
> `VITE_API_BASE_URL` — those are the names used below.

---

## 1. One-time setup (Day 1 only)

### 1a. Install the CLIs
```bash
# Google Cloud SDK — https://cloud.google.com/sdk/docs/install
gcloud --version

# Firebase CLI
npm install -g firebase-tools
firebase --version
```

### 1b. Authenticate
```bash
gcloud auth login
gcloud auth application-default login   # needed for local `npm run ingest`
gcloud config set project YOUR_PROJECT_ID

firebase login
cd frontend
firebase use --add            # pick your Firebase project, give it alias "default"
cd ..
```

### 1c. Enable the GCP APIs the deploy needs (one command)
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com
```

### 1d. Ingest your documents and grab the corpus ID
```bash
cd backend
cp .env.production.example .env          # fill in GOOGLE_CLOUD_PROJECT for local runs
# put .txt files in backend/data/docs/
npm install
npm run ingest
```
The script prints something like:
```
Corpus:    projects/123456789/locations/us-central1/ragCorpora/4567890123
Uploaded:  20
```
**Copy that full `projects/.../ragCorpora/...` string** — that's the value for
`VERTEX_RAG_CORPUS` in step 1e.

You can also list corpora later:
```bash
gcloud ai rag-corpora list --region=us-central1
```

### 1e. Set the Cloud Run env vars (after the first deploy)
The first `npm run deploy` (step 2) creates the service. After it succeeds,
set the env vars **once** in the console:

1. Open https://console.cloud.google.com/run
2. Click **asistenti-backend**
3. Click **Edit & Deploy New Revision** at the top
4. Scroll to **Variables & Secrets → Environment variables**
5. Click **+ Add Variable** for each row in `backend/.env.production.example`:
   - `GOOGLE_CLOUD_PROJECT` — your project ID
   - `GOOGLE_CLOUD_LOCATION` — `us-central1`
   - `VERTEX_RAG_CORPUS` — the full corpus name from step 1d
   - `VERTEX_MODEL` — `gemini-1.5-flash`
   - `NODE_ENV` — `production`
6. Click **Deploy** at the bottom.

Or do it from the CLI in one shot:
```bash
gcloud run services update asistenti-backend \
  --region us-central1 \
  --set-env-vars \
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1,VERTEX_RAG_CORPUS=projects/.../ragCorpora/...,VERTEX_MODEL=gemini-1.5-flash,NODE_ENV=production
```

### 1f. Give Cloud Run access to Vertex AI
```bash
PROJECT=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

---

## 2. Deploy the backend

```bash
cd backend
npm run deploy
```
- Cloud Run autodetects Node.js — no Dockerfile required.
- Wait ~3 minutes for the build.
- The final line prints:
  ```
  Service URL: https://asistenti-backend-xxxxxxxxxx-uc.a.run.app
  ```
  **Copy that URL.**

Sanity-check:
```bash
curl https://asistenti-backend-xxxxxxxxxx-uc.a.run.app/health
# → {"status":"ok","service":"asistenti-backend",...}
```

---

## 3. Point the frontend at the backend

Open `frontend/.env.production` and replace the placeholder:
```
VITE_API_BASE_URL=https://asistenti-backend-xxxxxxxxxx-uc.a.run.app
```

---

## 4. Deploy the frontend

```bash
cd frontend
npm install        # first time only
npm run deploy
```
- Vite builds with the production env var baked in, then Firebase uploads `dist/`.
- Wait ~1 minute.
- The final line prints:
  ```
  Hosting URL: https://YOUR-PROJECT.web.app
  ```

---

## 5. Verify

1. Open the Hosting URL in a browser.
2. Send a test message — you should see streaming tokens, then a
   `StepCard` with steps + source.
3. Toggle the language switcher — UI strings update instantly.

If the chat hangs or shows the no-info fallback for every question:
- Check **Cloud Run → asistenti-backend → Logs** for errors.
- Confirm `VERTEX_RAG_CORPUS` matches the corpus you ingested into.
- Confirm the corpus has files: `gcloud ai rag-files list --corpus=... --region=us-central1`.

---

## 6. Demo-day checklist

- [ ] `curl $BACKEND_URL/health` returns `{"status":"ok",...}`
- [ ] At least 20 docs ingested (`npm run ingest` reported `Uploaded: 20+`)
- [ ] Frontend URL loads on your phone (test on cellular, not just WiFi)
- [ ] Language toggle works in production (SQ ↔ EN)
- [ ] All 3 demo questions stream a `StepCard` end-to-end:
  - "Si të rinovoj pasaportën?"
  - "Si të hap një biznes?"
  - "Si të aplikoj për patentë?"
- [ ] Cloud Run **Min instances = 1** (set in `npm run deploy` — no cold starts during the demo)
- [ ] Past conversations rehydrate on refresh (localStorage + restore)
- [ ] New conversation button resets to the hero state
