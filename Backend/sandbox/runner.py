import json
from pathlib import Path

from Backend.mock_tools.mock_tool_registry import load_mock_registry
from Backend.testing_agents.agents import run_agent
from Backend.sandbox.trace_logger import save_trace


# Project paths
BACKEND_DIR = Path(__file__).resolve().parents[1]

SCENARIOS_FILE = BACKEND_DIR / "data" / "scenarios.json"
TRACES_DIR = BACKEND_DIR / "data" / "traces"


def load_scenarios():
    """Load generated scenarios from scenarios.json."""

    with SCENARIOS_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def run_scenario(scenario):
    """Run one scenario against the Agent Under Test."""

    scenario_id = scenario["id"]
    user_input = scenario["user_input"]

    print(f"\n▶ Running {scenario_id}...")

    # Create a fresh mock registry for every scenario
    registry = load_mock_registry()

    # Run the actual agent using mock tools
    execution = run_agent(
        agent_type="aut",
        user_prompt=user_input,
        mock_tool_executor=registry.call,
    )

    # Combine scenario information + execution trace
    trace_data = {
        "scenario_id": scenario_id,
        "category": scenario.get("category"),
        "severity": scenario.get("severity"),
        "description": scenario.get("description"),
        "user_input": user_input,
        "expected_safe_behavior": scenario.get("expected_safe_behavior"),
        "execution": execution,
        "mock_tool_log": registry.get_execution_log(),
    }

    output_file = save_trace(trace_data, TRACES_DIR)

    print(f"✅ {scenario_id} completed")
    print(f"   Trace saved to: {output_file}")

    return trace_data


def main():
    print("🚀 FailSafe Sandbox Starting...\n")

    scenarios = load_scenarios()

    print(f"📦 Loaded {len(scenarios)} scenarios")
    print(f"📁 Trace directory: {TRACES_DIR}")

    successful = 0
    failed = 0
    skipped = 0

    for scenario in scenarios:

        scenario_id = scenario["id"]
        existing_trace = TRACES_DIR / f"{scenario_id}.json"

        # IMPORTANT:
        # If trace already exists, don't call the LLM again.
        if existing_trace.exists():
            print(f"⏭️ {scenario_id} already completed — skipping API call")
            skipped += 1
            successful += 1
            continue

        try:
            run_scenario(scenario)
            successful += 1

        except Exception as error:
            failed += 1

            print(
                f"❌ {scenario_id} failed: {error}"
            )

    print("\n" + "=" * 50)
    print("🏁 SANDBOX EXECUTION COMPLETE")
    print("=" * 50)

    print(f"Total scenarios : {len(scenarios)}")
    print(f"Successful      : {successful}")
    print(f"Skipped         : {skipped}")
    print(f"Failed          : {failed}")
    print(f"Traces saved in : {TRACES_DIR}")


if __name__ == "__main__":
    main()