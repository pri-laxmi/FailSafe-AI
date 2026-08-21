import json
from pathlib import Path

try:
    from Backend.multi_turn.chain_runner import run_attack_chain
    from Backend.multi_turn import chain_runner
    from Backend.multi_turn.chain_classifier import classify_chain
except ModuleNotFoundError:
    from multi_turn.chain_runner import run_attack_chain
    from multi_turn import chain_runner
    from multi_turn.chain_classifier import classify_chain


# ============================================================
# PATHS
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[1]

AGENT_CONFIG_FILE = (
    BACKEND_DIR / "agent_config.json"
)

CHAIN_CLASSIFICATIONS_FILE = (
    BACKEND_DIR
    / "data"
    / "attack_chains"
    / "chain_classifications.json"
)

CHAINS_FILE = (
    BACKEND_DIR
    / "data"
    / "attack_chains"
    / "attack_chains.json"
)

PATCHES_DIR = (
    BACKEND_DIR
    / "data"
    / "attack_chains"
    / "patches"
)

PATCHED_TRACES_DIR = (
    BACKEND_DIR
    / "data"
    / "attack_chains"
    / "patched_traces"
)

PATCH_RESULTS_DIR = (
    BACKEND_DIR
    / "data"
    / "attack_chains"
    / "patch_results"
)


# ============================================================
# HELPERS
# ============================================================

def load_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data):
    path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with path.open(
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# FIND UNSAFE CHAIN
# ============================================================

def find_first_unsafe_chain():

    classifications = load_json(
        CHAIN_CLASSIFICATIONS_FILE
    )

    for result in classifications:

        if result.get("classification") == "unsafe":
            return result

    return None


# ============================================================
# LOAD PATCH
# ============================================================

def load_patch(chain_id: str):

    patch_file = (
        PATCHES_DIR
        / f"{chain_id}_patch.json"
    )

    if not patch_file.exists():
        raise FileNotFoundError(
            f"Patch not found: {patch_file}"
        )

    return load_json(patch_file)


# ============================================================
# LOAD CHAIN
# ============================================================

def load_chain(chain_id: str):

    chains = load_json(
        CHAINS_FILE
    )

    for chain in chains:

        current_id = (
            chain.get("chain_id")
            or chain.get("id")
        )

        if current_id == chain_id:
            return chain

    raise ValueError(
        f"Chain {chain_id} not found in attack_chains.json"
    )


# ============================================================
# RETEST ONE CHAIN
# ============================================================

def retest_chain(
    chain: dict,
    patch_data: dict,
):

    chain_id = (
        chain.get("chain_id")
        or chain.get("id")
    )

    patched_prompt = patch_data.get(
        "patched_prompt"
    )

    if not patched_prompt:
        raise ValueError(
            "Patch does not contain patched_prompt."
        )

    print("\n")
    print("=" * 70)
    print(f"RE-TESTING PATCHED {chain_id}")
    print("=" * 70)

    # --------------------------------------------------------
    # Save the ORIGINAL agent config exactly as bytes.
    # This guarantees we can restore it unchanged.
    # --------------------------------------------------------

    original_config_bytes = (
        AGENT_CONFIG_FILE.read_bytes()
    )

    # --------------------------------------------------------
    # Load original config and replace ONLY system prompt
    # temporarily.
    # --------------------------------------------------------

    agent_config = load_json(
        AGENT_CONFIG_FILE
    )

    original_prompt = (
        agent_config.get("system_prompt")
        or agent_config.get("system_instruction")
        or ""
    )

    # Preserve whichever key the project currently uses.
    if "system_prompt" in agent_config:
        agent_config["system_prompt"] = patched_prompt
    else:
        agent_config["system_instruction"] = patched_prompt

    # --------------------------------------------------------
    # Temporarily replace real config
    # --------------------------------------------------------

    save_json(
        AGENT_CONFIG_FILE,
        agent_config
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # chain_runner normally writes to its own TRACES_DIR.
    # Redirect it to patched_traces so the ORIGINAL trace
    # remains untouched.
    # --------------------------------------------------------

    original_traces_dir = (
        chain_runner.TRACES_DIR
    )

    chain_runner.TRACES_DIR = PATCHED_TRACES_DIR

    try:

        # ----------------------------------------------------
        # Run ONLY this failed chain.
        # ----------------------------------------------------

        patched_execution = run_attack_chain(
            chain=chain,
            agent_type="aut",
            agent_config_file=AGENT_CONFIG_FILE,
        )

    finally:

        # ----------------------------------------------------
        # Restore original trace directory.
        # ----------------------------------------------------

        chain_runner.TRACES_DIR = (
            original_traces_dir
        )

        # ----------------------------------------------------
        # RESTORE ORIGINAL AGENT CONFIG.
        # ----------------------------------------------------

        AGENT_CONFIG_FILE.write_bytes(
            original_config_bytes
        )

    # --------------------------------------------------------
    # Path of newly generated patched trace
    # --------------------------------------------------------

    patched_trace_file = (
        PATCHED_TRACES_DIR
        / f"{chain_id}.json"
    )

    if not patched_trace_file.exists():
        raise FileNotFoundError(
            f"Patched trace was not created: "
            f"{patched_trace_file}"
        )

    # --------------------------------------------------------
    # Classify patched chain
    # --------------------------------------------------------

    print(
        f"\nClassifying patched {chain_id}..."
    )

    after_classification = classify_chain(
        patched_trace_file
    )

    # --------------------------------------------------------
    # Find BEFORE classification
    # --------------------------------------------------------

    before_classification = load_json(
        CHAIN_CLASSIFICATIONS_FILE
    )

    before_result = next(
        (
            item
            for item in before_classification
            if item.get("chain_id") == chain_id
            or item.get("scenario_id") == chain_id
        ),
        None,
    )

    if before_result is None:
        raise ValueError(
            f"Before classification not found for {chain_id}"
        )

    # --------------------------------------------------------
    # Build before / after comparison
    # --------------------------------------------------------

    comparison = {
        "chain_id": chain_id,

        "before": {
            "classification": before_result.get(
                "classification"
            ),
            "failure_category": before_result.get(
                "failure_category"
            ),
            "severity": before_result.get(
                "severity"
            ),
            "failed_turn": before_result.get(
                "failed_turn"
            ),
            "reason": before_result.get(
                "reason"
            ),
        },

        "patch": {
            "failure_category": patch_data.get(
                "failure_category"
            ),
            "severity": patch_data.get(
                "severity"
            ),
            "failed_turn": patch_data.get(
                "failed_turn"
            ),
            "vulnerability_analysis": patch_data.get(
                "vulnerability_analysis"
            ),
            "patch_summary": patch_data.get(
                "patch_summary"
            ),
            "original_prompt": original_prompt,
            "patched_prompt": patched_prompt,
            "unified_diff": patch_data.get(
                "unified_diff"
            ),
        },

        "after": {
            "classification": after_classification.get(
                "classification"
            ),
            "failure_category": after_classification.get(
                "failure_category"
            ),
            "severity": after_classification.get(
                "severity"
            ),
            "failed_turn": after_classification.get(
                "failed_turn"
            ),
            "reason": after_classification.get(
                "reason"
            ),
        },

        "retest_trace": str(
            patched_trace_file
        ),
    }

    # --------------------------------------------------------
    # Determine whether patch fixed the chain
    # --------------------------------------------------------

    comparison["patch_effective"] = (
        before_result.get("classification") == "unsafe"
        and after_classification.get("classification")
        == "safe"
    )

    # --------------------------------------------------------
    # Save result
    # --------------------------------------------------------

    result_file = (
        PATCH_RESULTS_DIR
        / f"{chain_id}_retest.json"
    )

    save_json(
        result_file,
        comparison
    )

    # --------------------------------------------------------
    # Print result
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print("PATCH RE-TEST RESULT")
    print("=" * 70)

    print(
        f"Chain       : {chain_id}"
    )

    print(
        f"Before      : "
        f"{before_result.get('classification')}"
    )

    print(
        f"After       : "
        f"{after_classification.get('classification')}"
    )

    print(
        f"Patch fixed : "
        f"{comparison['patch_effective']}"
    )

    print(
        f"Result saved: {result_file}"
    )

    print("=" * 70)

    return comparison


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n")
    print("=" * 70)
    print("MULTI-TURN PATCH RE-TESTER")
    print("=" * 70)

    unsafe_chain = find_first_unsafe_chain()

    if unsafe_chain is None:

        print(
            "\nNo unsafe chain found."
        )

        return

    chain_id = (
        unsafe_chain.get("chain_id")
        or unsafe_chain.get("scenario_id")
    )

    print(
        f"\nUnsafe chain selected: {chain_id}"
    )

    chain = load_chain(
        chain_id
    )

    patch_data = load_patch(
        chain_id
    )

    retest_chain(
        chain=chain,
        patch_data=patch_data,
    )


if __name__ == "__main__":
    main()