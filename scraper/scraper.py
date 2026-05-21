"""
Gjeni Data Scraper
Scrapes Albanian government websites using Playwright,
then structures the raw text with Gemini into clean procedure files.

Usage:
    export GEMINI_API_KEY=your_key_here
    python scraper.py --all               # scrape everything
    python scraper.py --id pasaporta      # scrape one procedure
    python scraper.py --dry-run           # print URLs without scraping
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

try:
    from google import genai
    from google.genai import types
    GENAI_SDK = "new"
except ImportError:
    import google.generativeai as genai  # type: ignore
    GENAI_SDK = "old"

# ─── CONFIG ───────────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyArl5hz-Vx8W5X2mN5eGnZE5gbAxHpNXJ8")
# Model can be overridden:  set GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
# Seconds to wait between Gemini calls (free tier ~10-15 req/min -> 5s is safe)
GEMINI_DELAY = float(os.environ.get("GEMINI_DELAY", "5"))

OUTPUT_DIR = Path("./data")        # final structured .txt files
RAW_DIR = Path("./data_raw")       # always-saved raw scraped text
OUTPUT_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)

EXTRACTION_PROMPT = """You are extracting Albanian government procedure data from raw webpage text.
Return ONLY a valid JSON object — no markdown, no backticks, no explanation.

JSON structure:
{{
  "title": "Human-readable procedure name in Albanian",
  "institution": "Responsible institution name",
  "description": "1-2 sentence summary of what this procedure is for",
  "steps": ["Step 1", "Step 2"],
  "documents_required": ["Document 1", "Document 2"],
  "fee": "Amount in ALL, or 'Pa pagesë' if free, or 'E panjohur' if not found",
  "processing_time": "e.g. '15 ditë pune', or 'E panjohur' if not found",
  "where_to_apply": "Physical office name or online URL",
  "notes": "Important exceptions or warnings, or empty string"
}}

Procedure context: {procedure_name}

Raw page text:
{raw_text}"""

# ─── PROCEDURE REGISTRY ───────────────────────────────────────────────────────

PROCEDURES = [
    {
        "id": "pasaporta",
        "filename": "pasaporta.txt",
        "label": "Rinovim Pasaporte",
        "sources": [
            "https://e-albania.al/ServiceDetails/13851",
            "https://identitek.al/aplikim-pasporte-me-procedure-normale",
        ],
    },
    {
        "id": "biznes_nipt",
        "filename": "biznes_nipt.txt",
        "label": "Regjistrim Biznesi / NIPT",
        "sources": [
            "https://e-albania.al/ServiceDetails/15356",
        ],
    },
    {
        "id": "patente",
        "filename": "patente.txt",
        "label": "Leje Drejtimi",
        "sources": [
            "https://e-albania.al/ServiceDetails/10116",
        ],
    },
    {
        "id": "regjistrim_automjeti",
        "filename": "regjistrim_automjeti.txt",
        "label": "Regjistrim Automjeti",
        "sources": [
            "https://e-albania.al/ServiceDetails/10094",
        ],
    },
    {
        "id": "leje_qendrimi",
        "filename": "leje_qendrimi.txt",
        "label": "Leje Qendrimi per te Huaj",
        "sources": [
            "https://e-albania.al/ServiceDetails/15309",
            "https://mb.gov.al/procedura-dhe-dokumentacioni-per-pajisjen-me-leje-qendrimi-dhe-leje-unike-residence-unique-permit-al-en/",
        ],
    },
    {
        "id": "certifikate_lindje",
        "filename": "certifikate_lindje.txt",
        "label": "Certifikate Lindjeje",
        "sources": [
            "https://e-albania.al/ServiceDetails/11176",
        ],
    },
    {
        "id": "martese",
        "filename": "martese.txt",
        "label": "Regjistrim Martese",
        "sources": [
            "https://e-albania.al/ServiceDetails/9768",
            "https://e-albania.al/ServiceDetails/11178",
        ],
    },
    {
        "id": "karte_identiteti",
        "filename": "karte_identiteti.txt",
        "label": "Karte Identiteti",
        "sources": [
            "https://e-albania.al/ServiceDetails/9765",
            "https://identitek.al/njoftim-elektronik",
        ],
    },
    {
        "id": "regjistrim_prone",
        "filename": "regjistrim_prone.txt",
        "label": "Regjistrim Prone",
        "sources": [
            "https://e-albania.al/ServiceDetails/9436",
        ],
    },
    {
        "id": "punesimi",
        "filename": "punesimi.txt",
        "label": "Perfitim Papunesie",
        "sources": [
            "https://www.puna.gov.al/profili/punekerkues/kerkesePagesePapunesie",
        ],
    },
    {
        "id": "pensioni",
        "filename": "pensioni.txt",
        "label": "Aplikim per Pension",
        "sources": [
            "https://e-albania.al/ServiceDetails/6156",
            "https://www.issh.gov.al/",
        ],
    },
    {
        "id": "tatime",
        "filename": "tatime.txt",
        "label": "Regjistrim Tatimor",
        "sources": [
            "https://e-albania.al/ServiceDetails/13938",
        ],
    },
    {
        "id": "matura",
        "filename": "matura.txt",
        "label": "Matura Shteterore",
        "sources": [
            "https://qsha.gov.al/matura-shteterore-2026/",
            "https://ematura.qsha.gov.al/",
        ],
    },
    {
        "id": "universitet",
        "filename": "universitet.txt",
        "label": "Pranim ne Universitet",
        "sources": [
            "https://ualbania.al/",
            "https://www.rash.al/en/",
        ],
    },
    {
        "id": "diplome",
        "filename": "diplome.txt",
        "label": "Njohja / Legalizimi i Diplomes",
        "sources": [
            "https://punetejashtme.gov.al/legalizimi-dhe-apostilimi-i-dokumenteve/",
            "https://qsha.gov.al/njesimi-i-diplomave-arsimi-i-larte/",
        ],
    },
    {
        "id": "vdekje",
        "filename": "vdekje.txt",
        "label": "Certifikate Vdekjeje",
        "sources": [
            "https://e-albania.al/ServiceDetails/11177",
        ],
    },
    {
        "id": "certifikate_familje",
        "filename": "certifikate_familje.txt",
        "label": "Certifikate Familjare",
        "sources": [
            "https://e-albania.al/ServiceDetails/377",
        ],
    },
    {
        "id": "deshmi_penaliteti",
        "filename": "deshmi_penaliteti.txt",
        "label": "Deshmi Penaliteti",
        "sources": [
            "https://e-albania.al/ServiceDetails/12583",
            "https://dpbsh.gov.al/si-te-marrim-deshmi-penaliteti/",
        ],
    },
    {
        "id": "autoshkolla",
        "filename": "autoshkolla.txt",
        "label": "Autoshkolla / Aplikim per Leje Drejtimi",
        "sources": [
            "https://e-albania.al/ServiceDetails/2312",
        ],
    },
    {
        "id": "dogana",
        "filename": "dogana.txt",
        "label": "Deklarim Doganor",
        "sources": [
            "https://dogana.gov.al/english/c/181/293/declaration-at-customs",
        ],
    },
]

# ─── SCRAPING ─────────────────────────────────────────────────────────────────

NOISE_PHRASES = [
    "cookie", "privacy policy", "terms of use", "copyright",
    "all rights reserved", "powered by", "javascript", "browser",
    "enable", "facebook", "twitter", "instagram", "youtube",
    "newsletter", "subscribe", "login", "sign in", "navigation",
]

def clean_text(raw: str) -> str:
    lines = raw.splitlines()
    cleaned = []
    for line in lines:
        line = line.strip()
        if not line or len(line) < 4:
            continue
        lower = line.lower()
        if any(phrase in lower for phrase in NOISE_PHRASES):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def scrape_url(page, url: str, timeout: int = 20000) -> str | None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        page.wait_for_load_state("networkidle", timeout=timeout)

        for selector in [
            "button:has-text('Pranoj')", "button:has-text('Accept')",
            "button:has-text('OK')", "#accept-cookies", ".cookie-accept",
        ]:
            try:
                btn = page.query_selector(selector)
                if btn and btn.is_visible():
                    btn.click()
                    time.sleep(0.5)
                    break
            except Exception:
                pass

        raw = page.inner_text("body")
        cleaned = clean_text(raw)

        if len(cleaned) < 300:
            print(f"    ⚠  Only {len(cleaned)} chars — skipping")
            return None

        return cleaned

    except PlaywrightTimeout:
        print(f"    ⏱  Timeout: {url}")
        return None
    except Exception as e:
        print(f"    ✗  {url}: {e}")
        return None


# ─── GEMINI STRUCTURING ───────────────────────────────────────────────────────

def _raw_gemini_call(prompt: str) -> str:
    if GENAI_SDK == "new":
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        return response.text
    else:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        return model.generate_content(prompt).text


def call_gemini(prompt: str, max_retries: int = 4) -> str:
    """Call Gemini with exponential backoff on rate-limit (429) errors."""
    delay = 10
    for attempt in range(1, max_retries + 1):
        try:
            return _raw_gemini_call(prompt)
        except Exception as e:
            msg = str(e)
            is_rate_limit = "429" in msg or "RESOURCE_EXHAUSTED" in msg
            # limit: 0 means no free-tier allocation at all — retrying won't help
            if "limit: 0" in msg or "limit:0" in msg:
                raise RuntimeError(
                    "NO_FREE_TIER: this project has zero free-tier quota. "
                    "Enable billing, use a new project, or run in --scrape-only mode."
                ) from e
            if is_rate_limit and attempt < max_retries:
                print(f"    ⏳  Rate limited, waiting {delay}s (attempt {attempt}/{max_retries})…")
                time.sleep(delay)
                delay *= 2  # exponential backoff: 10s, 20s, 40s
                continue
            raise


def structure_with_gemini(raw_text: str, label: str) -> dict:
    prompt = EXTRACTION_PROMPT.format(
        procedure_name=label,
        raw_text=raw_text[:8000],
    )
    try:
        text = call_gemini(prompt).strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"    ⚠  JSON parse error: {e}")
        return {"error": str(e), "raw_text": raw_text[:3000]}
    except Exception as e:
        print(f"    ✗  Gemini error: {e}")
        return {"error": str(e), "raw_text": raw_text[:3000]}


# ─── OUTPUT FORMATTING ────────────────────────────────────────────────────────

def format_txt(data: dict) -> str:
    if "error" in data:
        return f"[EXTRACTION FAILED]\n\n{data.get('raw_text', '')}"

    g = lambda k, d="E panjohur": data.get(k) or d

    lines = [
        f"PROCEDURA: {g('title')}",
        f"INSTITUCIONI: {g('institution')}",
        f"PERSHKRIMI: {g('description')}",
        "",
        "HAPAT:",
    ]
    for i, s in enumerate(data.get("steps", []), 1):
        lines.append(f"  {i}. {s}")

    lines += ["", "DOKUMENTET E NEVOJSHME:"]
    for doc in data.get("documents_required", []):
        lines.append(f"  - {doc}")

    lines += [
        "",
        f"TARIFA: {g('fee')}",
        f"KOHA E PROCESIMIT: {g('processing_time')}",
        f"KU TE APLIKONI: {g('where_to_apply')}",
    ]

    notes = g("notes", "")
    if notes:
        lines += ["", f"SHENIME: {notes}"]

    return "\n".join(lines)


# ─── VALIDATION: flag incomplete structured files ─────────────────────────────

def validate_phase(targets: list) -> dict:
    """Scan data/ and report files that are missing steps or documents.
    Catches 'partial extraction' cases where the scraper hit a hub/homepage."""
    report = {"good": [], "incomplete": [], "failed": [], "missing": []}

    print(f"\n{'═'*55}")
    print("VALIDATION REPORT")
    print(f"{'═'*55}")

    for proc in targets:
        path = OUTPUT_DIR / proc["filename"]
        if not path.exists():
            report["missing"].append(proc["id"])
            print(f"  ❓  {proc['filename']:<28} not generated yet")
            continue

        text = path.read_text(encoding="utf-8")

        if text.startswith("[EXTRACTION FAILED]") or text.startswith("[SCRAPING FAILED]"):
            report["failed"].append(proc["id"])
            print(f"  ❌  {proc['filename']:<28} FAILED (no usable page content)")
            continue

        # Count real content under each section header
        steps_block = text.split("HAPAT:")[-1].split("DOKUMENTET")[0] if "HAPAT:" in text else ""
        docs_block = text.split("DOKUMENTET E NEVOJSHME:")[-1].split("TARIFA:")[0] if "DOKUMENTET E NEVOJSHME:" in text else ""
        has_steps = any(line.strip() and line.strip()[0].isdigit() for line in steps_block.splitlines())
        has_docs = any(line.strip().startswith("-") for line in docs_block.splitlines())

        missing_parts = []
        if not has_steps:
            missing_parts.append("HAPAT")
        if not has_docs:
            missing_parts.append("DOKUMENTET")

        if missing_parts:
            report["incomplete"].append(proc["id"])
            print(f"  ⚠   {proc['filename']:<28} missing: {', '.join(missing_parts)}")
        else:
            report["good"].append(proc["id"])
            print(f"  ✅  {proc['filename']:<28} complete")

    print(f"\n  Complete: {len(report['good'])}  |  "
          f"Incomplete: {len(report['incomplete'])}  |  "
          f"Failed: {len(report['failed'])}  |  "
          f"Missing: {len(report['missing'])}")

    needs_fix = report["incomplete"] + report["failed"]
    if needs_fix:
        print(f"\n  → Repoint these at e-albania ServiceDetails URLs and re-run:")
        print(f"    {', '.join(needs_fix)}")

    return report


# ─── MAIN ─────────────────────────────────────────────────────────────────────

# ─── PHASE 1: SCRAPE (no API needed) ──────────────────────────────────────────

def scrape_phase(targets: list, dry_run: bool = False) -> dict:
    """Scrape pages with Playwright and save RAW text to data_raw/.
    This phase needs NO API key and never wastes work."""
    results = {"raw": [], "failed": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="sq-AL",
            extra_http_headers={"Accept-Language": "sq-AL,sq;q=0.9,en;q=0.8"},
        )
        page = context.new_page()

        for proc in targets:
            print(f"\n{'─'*55}")
            print(f"▶  {proc['label']}  →  {proc['filename']}")

            if dry_run:
                for url in proc["sources"]:
                    print(f"   {url}")
                continue

            raw_text, used_url = None, None
            for url in proc["sources"]:
                print(f"   Trying {url}")
                raw_text = scrape_url(page, url)
                if raw_text:
                    used_url = url
                    break
                time.sleep(1)

            raw_path = RAW_DIR / proc["filename"]

            if not raw_text:
                print("   ✗  All sources failed")
                results["failed"].append(proc["id"])
                raw_path.write_text(
                    f"[SCRAPING FAILED]\nProcedura: {proc['label']}\n"
                    "Plotesoni kete skedar manualisht.\n",
                    encoding="utf-8",
                )
                continue

            print(f"   ✓  {len(raw_text)} chars from {used_url}")
            raw_path.write_text(raw_text, encoding="utf-8")
            results["raw"].append(proc["id"])
            time.sleep(1.5)

        browser.close()
    return results


# ─── PHASE 2: STRUCTURE (uses Gemini, resumable) ──────────────────────────────

def structure_phase(targets: list) -> dict:
    """Read raw files from data_raw/, structure with Gemini, save to data/.
    Skips procedures already structured so it can be re-run safely after a 429."""
    results = {"ok": [], "skipped": [], "failed": []}

    if GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        print("\n⚠  No GEMINI_API_KEY set — copying raw text to data/ unstructured.")
        for proc in targets:
            raw_path = RAW_DIR / proc["filename"]
            if raw_path.exists():
                (OUTPUT_DIR / proc["filename"]).write_text(
                    raw_path.read_text(encoding="utf-8"), encoding="utf-8"
                )
                results["skipped"].append(proc["id"])
        return results

    for proc in targets:
        out_path = OUTPUT_DIR / proc["filename"]
        raw_path = RAW_DIR / proc["filename"]

        # Resume support: skip if already structured successfully
        if out_path.exists() and "[EXTRACTION FAILED]" not in out_path.read_text(encoding="utf-8"):
            print(f"⏭  {proc['filename']} already done — skipping")
            results["skipped"].append(proc["id"])
            continue

        if not raw_path.exists():
            print(f"✗  No raw file for {proc['id']} — run scrape phase first")
            results["failed"].append(proc["id"])
            continue

        raw_text = raw_path.read_text(encoding="utf-8")
        if raw_text.startswith("[SCRAPING FAILED]"):
            out_path.write_text(raw_text, encoding="utf-8")
            results["failed"].append(proc["id"])
            continue

        print(f"⚙  Structuring {proc['filename']} with {GEMINI_MODEL}…")
        try:
            structured = structure_with_gemini(raw_text, proc["label"])
            out_path.write_text(format_txt(structured), encoding="utf-8")
            if "error" in structured:
                results["failed"].append(proc["id"])
                print("   ⚠  Saved raw fallback (extraction error)")
            else:
                results["ok"].append(proc["id"])
                print("   ✓  Saved structured output")
        except RuntimeError as e:
            if "NO_FREE_TIER" in str(e):
                print(f"\n❌  {e}")
                print("    Stopping. Your raw data is safe in data_raw/.")
                print("    See the README for how to fix the quota issue.")
                break
            raise

        time.sleep(GEMINI_DELAY)  # pace requests to respect rate limits

    return results


def run(targets: list, dry_run: bool = False, mode: str = "all"):
    if mode == "validate":
        validate_phase(targets)
        return

    if mode in ("all", "scrape"):
        s = scrape_phase(targets, dry_run=dry_run)
        if not dry_run:
            print(f"\n{'═'*55}")
            print(f"📄  Scraped : {len(s['raw'])}")
            print(f"❌  Failed  : {len(s['failed'])}")
            if s["failed"]:
                print(f"    → {', '.join(s['failed'])}")

    if dry_run:
        return

    if mode in ("all", "structure"):
        st = structure_phase(targets)
        print(f"\n{'═'*55}")
        print(f"✅  Structured : {len(st['ok'])}")
        print(f"⏭  Skipped    : {len(st['skipped'])}")
        print(f"❌  Failed     : {len(st['failed'])}")
        if st["failed"]:
            print(f"    → {', '.join(st['failed'])}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gjeni data scraper")
    parser.add_argument("--all", action="store_true",
                        help="Scrape then structure (default)")
    parser.add_argument("--scrape-only", action="store_true",
                        help="Only scrape raw text (no API key needed)")
    parser.add_argument("--structure-only", action="store_true",
                        help="Only structure already-scraped raw files")
    parser.add_argument("--validate", action="store_true",
                        help="Check data/ for incomplete files (no scraping)")
    parser.add_argument("--id", type=str, help="Run one procedure by id")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print URLs only, no scraping")
    args = parser.parse_args()

    if args.id:
        targets = [p for p in PROCEDURES if p["id"] == args.id]
        if not targets:
            print(f"Unknown id: {args.id}")
            print("Valid ids:", [p["id"] for p in PROCEDURES])
            sys.exit(1)
    else:
        targets = PROCEDURES

    if args.scrape_only:
        mode = "scrape"
    elif args.structure_only:
        mode = "structure"
    elif args.validate:
        mode = "validate"
    else:
        mode = "all"

    run(targets, dry_run=args.dry_run, mode=mode)
