# Demo-day questions

The three questions we'll demo live, in both languages, with the expected
response shape so we know within seconds whether the answer is correct.

For all three the assistant must return JSON parseable by
`backend/src/agent/parser.ts` and render as a `StepCard` with:
- `answer` — 1–2 sentence intro
- `steps[]` — ordered actions
- `documents[]` — required papers/IDs (rendered as pill list)
- `source` — filename of the grounding doc
- optional `note` — caveat in italic yellow callout

If any of the three returns the no-info fallback, the demo fails — verify
the relevant doc is ingested *before* going on stage.

---

## 1. Passport renewal

**Albanian (default):** `Si të rinovoj pasaportën?`
**English:** `How do I renew my passport?`

**Expected response shape:**
```json
{
  "answer": "Për të rinovuar pasaportën, aplikoni pranë DPGJC ose Komisariatit të Policisë…",
  "steps": [
    "Paraqituni pranë sportelit DPGJC ose Komisariatit të Policisë",
    "Plotësoni formularin e aplikimit",
    "Paguani tarifën e shërbimit prej 5,000 Lekësh",
    "Dorëzoni formularin dhe dokumentet",
    "Prisni konfirmimin me SMS ose email",
    "Tërhiqni pasaportën e re"
  ],
  "documents": ["Kartë identiteti", "2 foto pasaporti 35×45mm", "Vërtetim pagese", "Pasaporta e vjetër"],
  "source": "pasaporta.txt",
  "note": "Pasaporta rinovohet çdo 10 vjet (të rriturit), çdo 5 vjet (fëmijët)."
}
```
**Required corpus doc:** anything with passport renewal procedure for Albania (DPGJC, e-albania, 5,000 lekë fee).

---

## 2. Open a business

**Albanian (default):** `Si të hap një biznes?`
**English:** `How do I open a business?`

**Expected response shape:**
```json
{
  "answer": "Për të hapur një biznes në Shqipëri, duhet të regjistroheni pranë QKB-së…",
  "steps": [
    "Zgjidh formën ligjore (SHPK, SHA, person fizik)",
    "Përgatit statutin dhe aktin themelues",
    "Depozito kapitalin minimal pranë bankës",
    "Aplikoni online në e-albania.al ose pranë QKB",
    "Merr NIPT-in dhe regjistrohu për TVSH nëse e tejkalon pragun"
  ],
  "documents": ["Dokument identifikimi", "Statuti", "Akti i themelimit", "Vërtetim depozitimi"],
  "source": "biznes-shpk.txt",
  "note": "Kapitali minimal për SHPK është 100 Lekë."
}
```
**Required corpus doc:** business registration procedure (QKB, NIPT, SHPK).

---

## 3. Driver's license

**Albanian (default):** `Si të aplikoj për patentë?`
**English:** `How do I apply for a driver's license?`

**Expected response shape:**
```json
{
  "answer": "Për të aplikuar për patentë shoferi, kalo provimin teorik dhe praktik pranë DPSHTRR…",
  "steps": [
    "Regjistrohu në një autoshkollë të licencuar",
    "Bëj kontrollin mjekësor",
    "Përgatitu për provimin teorik",
    "Kalo provimin teorik pranë DPSHTRR",
    "Kalo provimin praktik",
    "Tërhiq patentën e re"
  ],
  "documents": ["Kartë identiteti", "Çertifikatë mjekësore", "Vërtetim nga autoshkolla", "Foto"],
  "source": "patenta-shoferi.txt",
  "note": "Mosha minimale për kategori B është 18 vjeç."
}
```
**Required corpus doc:** driving license procedure (DPSHTRR, autoshkollë, kategori B).

---

## On-stage script

1. Open the deployed Firebase URL on the laptop, mirror to projector.
2. Show language toggle works (SQ ↔ EN).
3. Ask Q1 in Albanian → wait for `StepCard` (≤8s). Tick a checkbox or two.
4. Click "New conversation" → ask Q2 in English to show bilingual.
5. On the phone, ask Q3 → show mobile drawer with prior conversations.
6. End on the documents pill list + source attribution slide ("grounded, not invented").

If a question returns the no-info fallback during the demo, fall back to the
sample stored in [frontend/src/pages/Demo.tsx](frontend/src/pages/Demo.tsx) (`SAMPLE_RESPONSE`) — open `/demo` as the safety net.
