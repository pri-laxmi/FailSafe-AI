import json
from pathlib import Path

try:
    from Backend.mock_tools.mock_tool_registry import load_mock_registry
    from Backend.sandbox.trace_logger import save_trace
    from Backend.testing_agents.agents import run_agent
except ModuleNotFoundError:
    from mock_tools.mock_tool_registry import load_mock_registry
    from sandbox.trace_logger import save_trace
    from testing_agents.agents import run_agent


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[1]

DEFAULT_CHAINS_FILE = (
    BACKEND_DIR / "data" / "attack_chains" / "attack_chains.json"
)

DEFAULT_AGENT_CONFIG = BACKEND_DIR / "agent_config.json"

TRACES_DIR = (
    BACKEND_DIR / "data" / "attack_chains" / "traces"
)


# ---------------------------------------------------------
# LOAD ATTACK CHAINS
# ---------------------------------------------------------

def load_attack_chains(
    chains_file: str | Path = DEFAULT_CHAINS_FILE,
) -> list[dict]:

    chains_file = Path(chains_file)

    with chains_file.open("r", encoding="utf-8") as f:
        chains = json.load(f)

    if not isinstance(chains, list):
        raise ValueError("Attack chains file must contain a JSON list.")

    return chains


# ---------------------------------------------------------
# RUN ONE ATTACK CHAIN
# ---------------------------------------------------------

def run_attack_chain(
    chain: dict,
    agent_type: str,
    agent_config_file: str | Path = DEFAULT_AGENT_CONFIG,
) -> dict:

    chain_id = chain.get("chain_id") or chain.get("id")

    if not chain_id:
        raise ValueError("Attack chain is missing chain_id.")

    turns = chain.get("turns", [])

    if not turns:
        raise ValueError(f"{chain_id} contains no turns.")

    print(f"\n{'=' * 60}")
    print(f"RUNNING {chain_id}")
    print(f"{'=' * 60}")

    # -----------------------------------------------------
    # IMPORTANT:
    # One registry for the complete chain.
    # This lets us preserve tool execution history.
    # -----------------------------------------------------

    registry = load_mock_registry(Path(agent_config_file))

    conversation = []

    turn_results = []

    # -----------------------------------------------------
    # Run every turn sequentially
    # -----------------------------------------------------

    for index, turn in enumerate(turns, start=1):

        # Support different possible field names
        user_prompt = (
            turn.get("user_input")
            or turn.get("prompt")
            or turn.get("message")
        )

        if not user_prompt:
            raise ValueError(
                f"{chain_id} Turn {index} has no user prompt."
            )

        print(f"\n[{index}/{len(turns)}] Turn {index}")
        print(f"User: {user_prompt}")

        # -------------------------------------------------
        # Preserve conversation context
        # -------------------------------------------------

        conversation.append(
            {
                "role": "user",
                "content": user_prompt,
            }
        )

        # -------------------------------------------------
        # Run agent
        #
        # We pass the accumulated conversation when the
        # runner supports it. For compatibility with the
        # existing run_agent(), we first try conversation
        # context and fall back to the existing interface.
        # -------------------------------------------------

        try:

            execution = run_agent(
                agent_type=agent_type,
                user_prompt=user_prompt,
                mock_tool_executor=registry.call,
                conversation_history=conversation[:-1],
            )

        except TypeError:

            # Existing run_agent() may not yet support
            # conversation_history.
            #
            # This fallback keeps the pipeline runnable,
            # but true multi-turn memory should ultimately
            # be implemented inside run_agent().
            execution = run_agent(
                agent_type=agent_type,
                user_prompt=user_prompt,
                mock_tool_executor=registry.call,
            )

        # -------------------------------------------------
        # Extract final response
        # -------------------------------------------------

        final_response = execution.get(
            "final_response",
            ""
        )

        print(f"Agent: {final_response}")

        # Add assistant response to conversation
        conversation.append(
            {
                "role": "assistant",
                "content": final_response,
            }
        )

        # -------------------------------------------------
        # Store this turn
        # -------------------------------------------------

        turn_results.append(
            {
                "turn_number": index,
                "user_input": user_prompt,
                "agent_response": final_response,
                "execution": execution,
            }
        )

    # -----------------------------------------------------
    # COMPLETE CHAIN RESULT
    # -----------------------------------------------------

    result = {
        "scenario_id": chain_id,   # save_trace compatibility
        "chain_id": chain_id,

        "attack_type": (
            chain.get("attack_type")
            or chain.get("category")
            or chain.get("strategy")
        ),

        "target_tool": chain.get("target_tool"),
        "turn_count": len(turns),

        "turns": turn_results,

        "conversation": conversation,

        "expected_safe_behavior": chain.get(
            "expected_safe_behavior"
        ),

        "mock_tool_log": registry.get_execution_log(),
    }

    # -----------------------------------------------------
    # SAVE TRACE
    # -----------------------------------------------------

    save_trace(
        result,
        TRACES_DIR,
    )

    print(f"\nTrace saved: {chain_id}")

    return result


# ---------------------------------------------------------
# RUN ALL CHAINS
# ---------------------------------------------------------

def run_all_attack_chains(
    agent_type: str,
    chains_file: str | Path = DEFAULT_CHAINS_FILE,
    agent_config_file: str | Path = DEFAULT_AGENT_CONFIG,
):

    chains = load_attack_chains(chains_file)

    print("\n" + "=" * 70)
    print("MULTI-TURN ATTACK CHAIN RUNNER")
    print("=" * 70)

    print(
        f"\nRunning {len(chains)} attack chains..."
    )

    results = []

    for index, chain in enumerate(chains, start=1):

        chain_id = (
            chain.get("chain_id")
            or chain.get("id")
            or f"CHAIN_{index:03d}"
        )

        print(
            f"\n[{index}/{len(chains)}] "
            f"Starting {chain_id}"
        )

        try:

            result = run_attack_chain(
                chain=chain,
                agent_type=agent_type,
                agent_config_file=agent_config_file,
            )

            results.append(result)

        except Exception as error:

            print(
                f"ERROR while running {chain_id}: {error}"
            )

            results.append(
                {
                    "chain_id": chain_id,
                    "status": "ERROR",
                    "error": str(error),
                }
            )

    print("\n" + "=" * 70)
    print("MULTI-TURN ATTACK CHAIN RUN COMPLETE")
    print("=" * 70)

    return results


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

if __name__ == "__main__":

    run_all_attack_chains(
        agent_type="aut"
    )