"""Mock Tool Registry: holds and executes the mock tools generated for an
agent's config. Every tool present in agent_config.json's `tools` list gets a
generated callable here automatically -- no tool is ever hardcoded.
"""

import json
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

try:
    from Backend.mock_tools.errors import (
        MockToolConfigError,
        UnknownToolError,
        UnsupportedOutcomeError,
    )
except ModuleNotFoundError:
    from mock_tools.errors import (
        MockToolConfigError,
        UnknownToolError,
        UnsupportedOutcomeError,
    )

try:
    from Backend.mock_tools.mock_tool_generator import (
        DEFAULT_OUTCOME,
        SUPPORTED_OUTCOMES,
        ToolSpec,
        make_mock_callable,
        parse_tool_specs,
    )
except ModuleNotFoundError:
    from mock_tools.mock_tool_generator import (
        DEFAULT_OUTCOME,
        SUPPORTED_OUTCOMES,
        ToolSpec,
        make_mock_callable,
        parse_tool_specs,
    )


DEFAULT_AGENT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "agent_config.json"


class MockToolRegistry:
    """Callable registry of mock tools generated from an agent_config.json."""

    def __init__(self, tool_specs: Dict[str, ToolSpec]):
        self._specs: Dict[str, ToolSpec] = dict(tool_specs)
        self._outcomes: Dict[str, str] = {name: DEFAULT_OUTCOME for name in self._specs}
        self._log: List[Dict[str, Any]] = []
        self._sequence = 0
        self._call_counts: Dict[str, int] = {name: 0 for name in self._specs}
        self._callables: Dict[str, Callable[[Optional[Dict[str, Any]]], Dict[str, Any]]] = {
            name: make_mock_callable(
                spec,
                self._get_outcome,
                self._next_sequence,
                self._next_call_index,
                self._append_log,
            )
            for name, spec in self._specs.items()
        }

    # -- internal hooks passed into generated callables --
    def _get_outcome(self, tool_name: str) -> str:
        return self._outcomes.get(tool_name, DEFAULT_OUTCOME)

    def _next_sequence(self) -> int:
        self._sequence += 1
        return self._sequence

    def _next_call_index(self, tool_name: str) -> int:
        self._call_counts[tool_name] = self._call_counts.get(tool_name, 0) + 1
        return self._call_counts[tool_name]

    def _append_log(
        self,
        sequence: int,
        tool_name: str,
        arguments: Dict[str, Any],
        outcome: str,
        result_body: Dict[str, Any],
    ) -> None:
        self._log.append(
            {
                "sequence": sequence,
                "tool_name": tool_name,
                "arguments": arguments,
                "outcome": outcome,
                "result": result_body,
            }
        )

    # -- public registry API --
    def list_tools(self) -> List[str]:
        return list(self._specs.keys())

    def get_tool(self, tool_name: str) -> Callable[[Optional[Dict[str, Any]]], Dict[str, Any]]:
        if tool_name not in self._callables:
            raise UnknownToolError(f"Unknown tool: '{tool_name}'")
        return self._callables[tool_name]

    def set_outcome(self, tool_name: str, outcome: str) -> None:
        if tool_name not in self._specs:
            raise UnknownToolError(f"Unknown tool: '{tool_name}'")
        if outcome not in SUPPORTED_OUTCOMES:
            raise UnsupportedOutcomeError(
                f"Unsupported outcome '{outcome}'. Supported outcomes: "
                f"{sorted(SUPPORTED_OUTCOMES)}"
            )
        self._outcomes[tool_name] = outcome

    def call(self, tool_name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if tool_name not in self._callables:
            sequence = self._next_sequence()
            result_body = {"error": f"Unknown tool: '{tool_name}'"}
            self._append_log(sequence, tool_name, arguments or {}, "error", result_body)
            return {"tool_name": tool_name, "status": "error", "result": result_body}
        return self._callables[tool_name](arguments)

    def get_execution_log(self) -> List[Dict[str, Any]]:
        return [dict(entry) for entry in self._log]


def build_registry_from_config(config: Any) -> MockToolRegistry:
    """Build a MockToolRegistry from an already-loaded agent_config dict.

    Accepts either the raw agent_config.json dict or the normalized dict
    returned by Backend.agent_ingestion.load_agent_config.
    """
    if not isinstance(config, dict):
        raise MockToolConfigError("agent config must be a JSON object")
    if "tools" not in config:
        raise MockToolConfigError("agent config is missing a 'tools' field")
    specs = parse_tool_specs(config["tools"])
    return MockToolRegistry(specs)


def load_mock_registry(path: Optional[Path] = None) -> MockToolRegistry:
    """Load agent_config.json from disk and build its MockToolRegistry."""
    config_path = Path(path) if path is not None else DEFAULT_AGENT_CONFIG_PATH
    if not config_path.exists():
        raise MockToolConfigError(f"agent config file not found: {config_path}")
    try:
        with config_path.open("r", encoding="utf-8") as file:
            config = json.load(file)
    except json.JSONDecodeError as error:
        raise MockToolConfigError(f"invalid JSON in {config_path}: {error.msg}") from error
    return build_registry_from_config(config)
