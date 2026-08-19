"""Builds deterministic, callable mock tools from agent_config.json tool definitions.

Given any tool definition of the shape:

    {
      "name": "<tool_name>",
      "description": "<...>",
      "parameters": {"type": "object", "properties": {...}, "required": [...]},
      "returns": {"<field>": "<type>" | {"type": "<type>"}, ...}   # optional
    }

this module produces a callable mock for it without any tool-specific code.
The tool name is never hardcoded anywhere in this module.
"""

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

try:
    from Backend.mock_tools.errors import UnsupportedOutcomeError
except ModuleNotFoundError:
    from mock_tools.errors import UnsupportedOutcomeError

try:
    from Backend.mock_tools.errors import MockToolConfigError
except ModuleNotFoundError:
    from mock_tools.errors import MockToolConfigError


SUPPORTED_OUTCOMES = frozenset(
    {"success", "error", "timeout", "invalid_input", "not_found", "permission_denied"}
)

DEFAULT_OUTCOME = "success"

_JSON_TYPE_CHECKS: Dict[str, Callable[[Any], bool]] = {
    "string": lambda v: isinstance(v, str),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "array": lambda v: isinstance(v, list),
    "object": lambda v: isinstance(v, dict),
}


@dataclass(frozen=True)
class ToolSpec:
    """Normalized description of a single tool, read from agent_config.json."""

    name: str
    description: str
    parameters: Dict[str, Any]
    returns: Optional[Dict[str, Any]]


def parse_tool_specs(tools: Any) -> Dict[str, ToolSpec]:
    """Turn the raw `tools` list from agent_config.json into ToolSpec objects.

    Raises MockToolConfigError on a missing/malformed tools list, a malformed
    tool definition, or a duplicate tool name.
    """
    if not isinstance(tools, list):
        raise MockToolConfigError("'tools' must be a JSON array")
    if not tools:
        raise MockToolConfigError("'tools' must contain at least one tool")

    specs: Dict[str, ToolSpec] = {}
    for index, tool in enumerate(tools):
        if not isinstance(tool, dict):
            raise MockToolConfigError(f"tools[{index}] must be a JSON object")

        name = tool.get("name")
        if not isinstance(name, str) or not name.strip():
            raise MockToolConfigError(f"tools[{index}] is missing a valid 'name'")
        name = name.strip()

        if name in specs:
            raise MockToolConfigError(f"duplicate tool name: '{name}'")

        description = tool.get("description")
        if not isinstance(description, str):
            description = ""

        parameters = tool.get("parameters")
        if parameters is None:
            parameters = {"type": "object", "properties": {}, "required": []}
        if not isinstance(parameters, dict):
            raise MockToolConfigError(
                f"tools[{index}] ('{name}').parameters must be a JSON object"
            )

        returns = tool.get("returns")
        if returns is not None and not isinstance(returns, dict):
            raise MockToolConfigError(
                f"tools[{index}] ('{name}').returns must be a JSON object"
            )

        specs[name] = ToolSpec(
            name=name, description=description, parameters=parameters, returns=returns
        )

    return specs


def validate_arguments(parameters_schema: Any, arguments: Any) -> List[str]:
    """Validate `arguments` against a JSON-Schema-like `parameters` object.

    Returns a list of human-readable error strings (empty if valid). No
    parameter names or types are hardcoded; everything comes from the schema.
    """
    if not isinstance(arguments, dict):
        return ["arguments must be provided as a JSON object"]

    schema = parameters_schema if isinstance(parameters_schema, dict) else {}
    properties = schema.get("properties")
    properties = properties if isinstance(properties, dict) else {}
    required = schema.get("required")
    required = required if isinstance(required, list) else []

    errors: List[str] = []

    for field_name in required:
        if field_name not in arguments:
            errors.append(f"missing required parameter '{field_name}'")

    for field_name, value in arguments.items():
        field_schema = properties.get(field_name)
        if not isinstance(field_schema, dict):
            continue
        expected_type = field_schema.get("type")
        checker = _JSON_TYPE_CHECKS.get(expected_type)
        if checker is not None and not checker(value):
            errors.append(
                f"parameter '{field_name}' must be of type '{expected_type}', "
                f"got '{type(value).__name__}'"
            )

    return errors


def _field_type(field_schema: Any) -> str:
    if isinstance(field_schema, str):
        return field_schema
    if isinstance(field_schema, dict):
        return str(field_schema.get("type", "string"))
    return "string"


def _mock_scalar(field_schema: Any, tool_name: str, call_index: int) -> Any:
    field_type = _field_type(field_schema)
    if field_type == "integer":
        return call_index
    if field_type == "number":
        return float(call_index)
    if field_type == "boolean":
        return True
    if field_type == "array":
        return []
    if field_type == "object":
        return {}
    return f"MOCK-{tool_name}-{call_index:03d}"


def _success_result(spec: ToolSpec, call_index: int) -> Dict[str, Any]:
    returns_schema = spec.returns
    if not isinstance(returns_schema, dict) or not returns_schema:
        return {
            "status": "success",
            "message": f"Mock execution of '{spec.name}' completed successfully.",
        }

    body: Dict[str, Any] = {}
    for field_name, field_schema in returns_schema.items():
        if field_name.lower() == "status":
            body[field_name] = "success"
        else:
            body[field_name] = _mock_scalar(field_schema, spec.name, call_index)
    return body


def _build_result_body(spec: ToolSpec, outcome: str, call_index: int) -> Dict[str, Any]:
    if outcome == "success":
        return _success_result(spec, call_index)
    if outcome == "permission_denied":
        return {
            "status": "denied",
            "reason": f"Permission denied for '{spec.name}' (mocked).",
        }
    if outcome == "not_found":
        return {
            "status": "not_found",
            "error": f"Requested resource for '{spec.name}' was not found (mocked).",
        }
    if outcome == "timeout":
        return {
            "status": "timeout",
            "error": f"Execution of '{spec.name}' timed out (mocked).",
        }
    if outcome == "error":
        return {
            "status": "error",
            "error": f"'{spec.name}' failed with a simulated internal error.",
        }
    if outcome == "invalid_input":
        return {
            "status": "invalid_input",
            "error": f"'{spec.name}' was configured to return invalid_input.",
        }
    raise UnsupportedOutcomeError(f"Unsupported outcome: '{outcome}'")


def make_mock_callable(
    spec: ToolSpec,
    get_outcome: Callable[[str], str],
    next_sequence: Callable[[], int],
    next_call_index: Callable[[str], int],
    append_log: Callable[[int, str, Dict[str, Any], str, Dict[str, Any]], None],
) -> Callable[[Optional[Dict[str, Any]]], Dict[str, Any]]:
    """Generate a callable mock for a single tool.

    The returned callable takes an arguments dict and returns a structured
    result. It validates arguments against `spec.parameters`, applies the
    outcome currently configured for this tool, and logs the call.
    """

    def _call(arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        arguments = {} if arguments is None else arguments
        validation_errors = validate_arguments(spec.parameters, arguments)

        configured_outcome = get_outcome(spec.name)
        sequence = next_sequence()
        call_index = next_call_index(spec.name)

        if validation_errors:
            effective_outcome = "invalid_input"
            result_body: Dict[str, Any] = {
                "status": "invalid_input",
                "errors": validation_errors,
            }
        elif configured_outcome == "invalid_input":
            effective_outcome = "invalid_input"
            result_body = _build_result_body(spec, "invalid_input", call_index)
        else:
            effective_outcome = configured_outcome
            result_body = _build_result_body(spec, configured_outcome, call_index)

        append_log(sequence, spec.name, arguments, effective_outcome, result_body)

        return {
            "tool_name": spec.name,
            "status": effective_outcome,
            "result": result_body,
        }

    return _call
