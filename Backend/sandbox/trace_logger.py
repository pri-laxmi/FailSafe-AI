import json
from pathlib import Path


def save_trace(trace_data: dict, output_dir: Path) -> Path:
    """
    Save one scenario execution trace as a JSON file.
    """

    output_dir.mkdir(parents=True, exist_ok=True)

    scenario_id = trace_data["scenario_id"]
    output_file = output_dir / f"{scenario_id}.json"

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(trace_data, file, indent=2, ensure_ascii=False)

    return output_file