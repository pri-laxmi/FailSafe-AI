"""Thin HTTP API over the existing FailSafe-AI pipeline.

This module does not reimplement agent ingestion, scenario generation, the
sandbox runner, mock tools, or the classifier. It imports and calls their
existing functions and exposes the results (and the on-disk data they
produce) over HTTP so the React frontend never reads Backend/ files or
Python modules directly.
"""

import hashlib
import importlib
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# The sandbox runner, classifier, and scenario generator print emoji status
# messages (🚀, ✅, ⏭️, etc.). On Windows, uvicorn's stdout defaults to the
# console's codepage (cp1252), which can't encode those characters — the
# print() call itself then raises UnicodeEncodeError, which surfaces as a
# scenario "error" even when the underlying work succeeded. Forcing UTF-8
# here, once, at the process entrypoint fixes every print site at once
# without touching the pipeline modules themselves.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from Backend import agent_ingestion

# Loaded once here, at the actual process entrypoint, so GROQ_API_KEY is in
# os.environ before any request is served. agent_ingestion.py reads it
# directly via os.getenv without calling load_dotenv() itself, so a request
# to the plain-English endpoint could otherwise miss a key that's genuinely
# on disk, if it happens to be the first Groq-related call in the process.
load_dotenv()

app = FastAPI(title="FailSafe-AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mirrors the path constants in sandbox/runner.py and classifier/classifier.py.
# Defined independently (not imported) because both of those modules pull in
# testing_agents/agents.py, which constructs a Groq Client at import time and
# raises immediately if GROQ_API_KEY is unset. Every read-only endpoint below
# only touches the filesystem, so it must not be forced to depend on a
# configured Groq key. Modules that actually need to call Groq
# (sandbox_runner, classifier_module, the scenario generator) are imported
# lazily, only inside the handlers that perform those calls.
BACKEND_DIR = Path(__file__).resolve().parents[1]
SCENARIOS_FILE = BACKEND_DIR / "data" / "scenarios.json"
SCENARIOS_META_FILE = BACKEND_DIR / "data" / "scenarios_meta.json"
GENERATION_PROGRESS_FILE = BACKEND_DIR / "data" / "scenario_generation_progress.json"
TRACES_DIR = BACKEND_DIR / "data" / "traces"
CLASSIFICATIONS_DIR = BACKEND_DIR / "data" / "classifications"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _import_sandbox_and_classifier():
    """Lazily import the Groq-backed modules. Raises a clear error if
    GROQ_API_KEY (or the modules themselves) aren't available."""
    try:
        sandbox_runner = importlib.import_module("Backend.sandbox.runner")
        classifier_module = importlib.import_module("Backend.classifier.classifier")
    except Exception as error:
        raise HTTPException(
            status_code=424,
            detail=f"Sandbox/classifier unavailable (is GROQ_API_KEY configured?): {error}",
        ) from error
    return sandbox_runner, classifier_module


def _read_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Malformed JSON in {path.name}: {error.msg}",
        ) from error


def _load_scenarios() -> list[dict]:
    if not SCENARIOS_FILE.exists():
        return []
    return _read_json(SCENARIOS_FILE) or []


def _config_hash(config: dict) -> str:
    """Deterministic identity for an agent config, used to detect whether
    scenarios.json was generated for the currently active agent."""
    canonical = json.dumps(config, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _scenarios_status() -> dict:
    scenarios = _load_scenarios()
    meta = _read_json(SCENARIOS_META_FILE)

    current_agent_name = None
    current_hash = None
    try:
        current_config = agent_ingestion.load_agent_config()
        current_agent_name = current_config.get("agent_name")
        current_hash = _config_hash(current_config)
    except agent_ingestion.AgentConfigError:
        pass

    # No meta file means these scenarios predate staleness tracking (e.g. the
    # committed demo set) — treat as not-stale rather than nagging on a fresh
    # checkout with no way to know what they were really generated for.
    stale = bool(meta and current_hash and meta.get("config_hash") != current_hash)

    return {
        "scenario_count": len(scenarios),
        "stale": stale,
        "current_agent_name": current_agent_name,
        "generated_for_agent_name": meta.get("agent_name") if meta else None,
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Agent configuration
# ---------------------------------------------------------------------------

class AgentConfigPayload(BaseModel):
    config: dict[str, Any]


class AgentDescriptionPayload(BaseModel):
    description: str


@app.get("/agent-config")
def get_agent_config():
    try:
        return agent_ingestion.load_agent_config()
    except agent_ingestion.AgentConfigError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/agent-config")
def post_agent_config(payload: AgentConfigPayload):
    """Save an already-structured agent config (e.g. imported JSON). No LLM call."""
    try:
        return agent_ingestion.save_agent_config(payload.config)
    except agent_ingestion.AgentConfigError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/agent-config/from-description")
def post_agent_config_from_description(payload: AgentDescriptionPayload):
    """Turn a plain-English description into a structured agent config via
    Groq, then save it as the current Agent Under Test."""
    if not payload.description.strip():
        raise HTTPException(status_code=400, detail="'description' must not be empty.")
    try:
        normalized = agent_ingestion.config_from_plain_english(payload.description)
        return agent_ingestion.save_agent_config(normalized)
    except agent_ingestion.AgentConfigError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

@app.get("/scenarios")
def get_scenarios():
    return _load_scenarios()


@app.get("/scenarios/status")
def get_scenarios_status():
    """Whether the current scenario set was generated for the currently
    active agent, so the frontend can flag stale data instead of silently
    presenting a previous agent's scenarios as if they were current."""
    return _scenarios_status()


def _load_generation_progress(config_hash: str) -> dict[str, list]:
    """Per-category scenario batches already generated for this exact agent
    config. Keyed by config hash so it's automatically discarded (never
    reused) the moment the agent changes — a category batch generated for
    one agent must never be recycled into another agent's scenario set."""
    data = _read_json(GENERATION_PROGRESS_FILE)
    if data and data.get("config_hash") == config_hash:
        return dict(data.get("categories", {}))
    return {}


def _save_generation_progress(config_hash: str, categories: dict[str, list]) -> None:
    GENERATION_PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with GENERATION_PROGRESS_FILE.open("w", encoding="utf-8") as file:
        json.dump({"config_hash": config_hash, "categories": categories}, file, indent=2, ensure_ascii=False)


def _clear_generation_progress() -> None:
    if GENERATION_PROGRESS_FILE.exists():
        GENERATION_PROGRESS_FILE.unlink()


_GENERATIONS: dict[str, dict[str, Any]] = {}


def _run_generation(job_id: str, agent_config: dict) -> None:
    """Generate the 4 category batches, persisting each one to disk as soon
    as it succeeds. A category that fails (even after call_groq's own
    429-retry + model-fallback) is recorded but does NOT discard the other,
    already-successful categories — the next generation attempt for this
    same agent config skips everything already done and only retries what's
    missing, instead of redoing all 4 batches from scratch."""
    job = _GENERATIONS[job_id]
    try:
        gen = importlib.import_module("Backend.scenario_generator.generator")
        prompt_path = Path(gen.__file__).with_name("scenario_prompt.txt")
        base_prompt = prompt_path.read_text(encoding="utf-8")

        config_hash = _config_hash(agent_config)
        categories_done = _load_generation_progress(config_hash)

        job["status"] = "running"
        job["categories_total"] = len(gen.CATEGORIES)
        job["categories_done"] = list(categories_done.keys())

        for category in gen.CATEGORIES:
            if category in categories_done:
                continue

            job["stage"] = f"Generating {category.replace('_', ' ')}"
            try:
                batch_prompt = gen.build_batch_prompt(base_prompt, agent_config, category)
                raw_response = gen.call_groq(batch_prompt)
                batch = gen.parse_scenarios(raw_response)
                gen.validate_batch(batch, category)

                categories_done[category] = batch
                _save_generation_progress(config_hash, categories_done)
                job["categories_done"] = list(categories_done.keys())
            except Exception as error:
                job["category_errors"][category] = str(error)
                # Keep going — an unrelated category may still succeed even
                # if this one is exhausted, and we don't want to abandon a
                # generation attempt over one bad batch.

        missing = [c for c in gen.CATEGORIES if c not in categories_done]
        if missing:
            job["status"] = "failed"
            job["error"] = (
                f"{len(missing)} of {len(gen.CATEGORIES)} categories failed: {', '.join(missing)}. "
                "The successful categories were saved — regenerate again to retry only what's missing."
            )
            return

        job["stage"] = "Validating scenarios"
        all_scenarios: list[dict] = []
        for category in gen.CATEGORIES:
            all_scenarios.extend(categories_done[category])

        all_scenarios = gen.deduplicate_scenarios(all_scenarios)
        all_scenarios = gen.assign_ids(all_scenarios)

        SCENARIOS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with SCENARIOS_FILE.open("w", encoding="utf-8") as file:
            json.dump(all_scenarios, file, indent=2, ensure_ascii=False)

        with SCENARIOS_META_FILE.open("w", encoding="utf-8") as file:
            json.dump(
                {
                    "config_hash": config_hash,
                    "agent_name": agent_config.get("agent_name"),
                    "generated_at": _now_iso(),
                },
                file,
                indent=2,
            )

        # Stale trace/classification files are keyed only by scenario_id
        # (S001..S040), so without clearing them the sandbox/classifier skip
        # logic would treat the *new* scenarios as already executed.
        cleared = 0
        for directory in (TRACES_DIR, CLASSIFICATIONS_DIR):
            if directory.exists():
                for stale_file in directory.glob("S*.json"):
                    stale_file.unlink()
                    cleared += 1

        _clear_generation_progress()

        job["scenario_count"] = len(all_scenarios)
        job["cleared_stale_results"] = cleared
        job["stage"] = "Complete"
        job["status"] = "completed"
    except Exception as error:
        job["status"] = "failed"
        job["error"] = str(error)
    finally:
        job["finished_at"] = _now_iso()


@app.post("/scenarios/generate")
def generate_scenarios(background_tasks: BackgroundTasks):
    already_running = next(
        (job for job in _GENERATIONS.values() if job["status"] in ("queued", "running")),
        None,
    )
    if already_running:
        raise HTTPException(
            status_code=409,
            detail=f"A scenario generation job is already in progress ('{already_running['id']}').",
        )

    try:
        agent_config = agent_ingestion.load_agent_config()
    except agent_ingestion.AgentConfigError as error:
        raise HTTPException(
            status_code=400, detail=f"Cannot generate scenarios: {error}"
        ) from error

    try:
        importlib.import_module("Backend.scenario_generator.generator")
    except Exception as error:  # module-level GROQ_API_KEY check raises here
        raise HTTPException(
            status_code=424, detail=f"Scenario generator unavailable: {error}"
        ) from error

    job_id = f"GEN_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    job = {
        "id": job_id,
        "status": "queued",
        "stage": None,
        "categories_total": 0,
        "categories_done": [],
        "category_errors": {},
        "scenario_count": None,
        "cleared_stale_results": None,
        "started_at": _now_iso(),
        "finished_at": None,
        "error": None,
    }
    _GENERATIONS[job_id] = job
    background_tasks.add_task(_run_generation, job_id, agent_config)
    return job


@app.get("/scenarios/generate/{job_id}")
def get_generation_job(job_id: str):
    job = _GENERATIONS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"No generation job found with id '{job_id}'.")
    return job


# ---------------------------------------------------------------------------
# Traces / classifications / joined results
# ---------------------------------------------------------------------------

@app.get("/traces")
def get_traces():
    if not TRACES_DIR.exists():
        return []
    traces = []
    for trace_file in sorted(TRACES_DIR.glob("S*.json")):
        data = _read_json(trace_file)
        if data is not None:
            traces.append(data)
    return traces


@app.get("/classifications")
def get_classifications():
    if not CLASSIFICATIONS_DIR.exists():
        return []
    classifications = []
    for classification_file in sorted(CLASSIFICATIONS_DIR.glob("S*.json")):
        data = _read_json(classification_file) or {}
        classifications.append({"scenario_id": classification_file.stem, **data})
    return classifications


@app.get("/results")
def get_results():
    """Scenario library joined with its trace and classification, by id."""
    scenarios = _load_scenarios()
    results = []
    for scenario in scenarios:
        scenario_id = scenario["id"]
        trace = _read_json(TRACES_DIR / f"{scenario_id}.json")
        classification = _read_json(CLASSIFICATIONS_DIR / f"{scenario_id}.json")
        results.append({**scenario, "trace": trace, "classification": classification})
    return results


# ---------------------------------------------------------------------------
# Runs (sandbox execution + classification, tracked in-memory)
# ---------------------------------------------------------------------------

_RUNS: dict[str, dict[str, Any]] = {}


def _execute_run(run_id: str) -> None:
    run = _RUNS[run_id]
    try:
        sandbox_runner, classifier_module = _import_sandbox_and_classifier()

        run["status"] = "executing"
        scenarios = sandbox_runner.load_scenarios()
        run["total"] = len(scenarios)

        for scenario in scenarios:
            scenario_id = scenario["id"]
            trace_path = TRACES_DIR / f"{scenario_id}.json"
            if not trace_path.exists():
                try:
                    sandbox_runner.run_scenario(scenario)
                except Exception as error:  # keep going; one bad scenario shouldn't kill the run
                    run["errors"].append(f"{scenario_id}: {error}")
            run["executed"] = sum(
                1 for s in scenarios if (TRACES_DIR / f"{s['id']}.json").exists()
            )

        run["status"] = "classifying"
        trace_files = sorted(TRACES_DIR.glob("S*.json"))
        for trace_file in trace_files:
            try:
                classifier_module.classify_trace(trace_file)
            except Exception as error:
                run["errors"].append(f"{trace_file.stem}: {error}")
            run["classified"] = sum(
                1 for f in trace_files if (CLASSIFICATIONS_DIR / f.name).exists()
            )

        run["status"] = "completed"
    except HTTPException as error:
        run["status"] = "failed"
        run["error"] = error.detail
    except Exception as error:
        run["status"] = "failed"
        run["error"] = str(error)
    finally:
        run["finished_at"] = _now_iso()


@app.post("/runs")
def start_run(background_tasks: BackgroundTasks):
    if not SCENARIOS_FILE.exists():
        raise HTTPException(
            status_code=400,
            detail="No scenarios found. Generate scenarios before starting a run.",
        )
    status = _scenarios_status()
    if status["stale"]:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Scenarios were generated for '{status['generated_for_agent_name']}', "
                f"but the current agent is '{status['current_agent_name']}'. "
                "Regenerate scenarios before starting a run."
            ),
        )
    # Fail fast (before creating a run record) if Groq isn't configured.
    _import_sandbox_and_classifier()

    run_id = f"RUN_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    run = {
        "id": run_id,
        "status": "queued",
        "started_at": _now_iso(),
        "finished_at": None,
        "total": 0,
        "executed": 0,
        "classified": 0,
        "errors": [],
        "error": None,
    }
    _RUNS[run_id] = run
    background_tasks.add_task(_execute_run, run_id)
    return run


@app.get("/runs")
def list_runs():
    return sorted(_RUNS.values(), key=lambda r: r["started_at"], reverse=True)


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    run = _RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"No run found with id '{run_id}'.")
    return run


@app.get("/runs/{run_id}/traces")
def get_run_traces(run_id: str):
    """Traces are not partitioned per run on disk, so this reflects the
    current cumulative trace state, scoped to confirm the run exists."""
    if run_id not in _RUNS:
        raise HTTPException(status_code=404, detail=f"No run found with id '{run_id}'.")
    return get_traces()
