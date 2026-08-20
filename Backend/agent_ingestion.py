"""Validate and persist an Agent Under Test configuration."""

import argparse
import importlib
import json
import os
from pathlib import Path
from typing import Any

try:
    from Backend.llm.groq_client import groq_chat_completion
except ModuleNotFoundError:
    from llm.groq_client import groq_chat_completion


DEFAULT_CONFIG_PATH = Path(__file__).with_name("agent_config.json")


class AgentConfigError(ValueError):
    """Raised when an Agent Under Test configuration is invalid."""


def _required_text(config: dict[str, Any], field: str) -> str:
    value = config.get(field)
    if not isinstance(value, str) or not value.strip():
        raise AgentConfigError(f"'{field}' must be a non-empty string")
    return value.strip()


def _required_text_list(config: dict[str, Any], field: str) -> list[str]:
    value = config.get(field)
    if not isinstance(value, list) or not value:
        raise AgentConfigError(f"'{field}' must be a non-empty JSON array")
    if any(not isinstance(item, str) or not item.strip() for item in value):
        raise AgentConfigError(f"'{field}' must contain only non-empty strings")
    return [item.strip() for item in value]


def validate_agent_config(config: Any) -> dict[str, Any]:
    """Return a normalized config or raise AgentConfigError."""
    if not isinstance(config, dict):
        raise AgentConfigError("The configuration must be a JSON object")

    normalized = {
        "agent_name": _required_text(config, "agent_name"),
        "domain": _required_text(config, "domain"),
        "system_prompt": _required_text(config, "system_prompt"),
        "purpose": _required_text(config, "purpose"),
        "rules": _required_text_list(config, "rules"),
    }

    tools = config.get("tools")
    if not isinstance(tools, list):
        raise AgentConfigError("'tools' must be a JSON array")

    normalized_tools = []
    for index, tool in enumerate(tools):
        if not isinstance(tool, dict):
            raise AgentConfigError(f"tools[{index}] must be a JSON object")
        normalized_tool = {
            "name": _required_text(tool, "name"),
            "description": _required_text(tool, "description"),
        }
        parameters = tool.get("parameters")
        if not isinstance(parameters, dict):
            raise AgentConfigError(
                f"tools[{index}].parameters must be a JSON object"
            )
        normalized_tool["parameters"] = parameters
        normalized_tools.append(normalized_tool)

    normalized["tools"] = normalized_tools
    return normalized


def load_agent_config(path: Path = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    """Load and validate an Agent Under Test configuration from disk."""
    try:
        with path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except FileNotFoundError as error:
        raise AgentConfigError(f"Config file not found: {path}") from error
    except json.JSONDecodeError as error:
        raise AgentConfigError(f"Invalid JSON in {path}: {error.msg}") from error
    return validate_agent_config(payload)


def save_agent_config(
    config: dict[str, Any], path: Path = DEFAULT_CONFIG_PATH
) -> dict[str, Any]:
    """Validate and save an Agent Under Test configuration."""
    normalized = validate_agent_config(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(normalized, file, indent=2, ensure_ascii=False)
        file.write("\n")
    return normalized


def _extract_json_object(response_text: str) -> dict[str, Any]:
    """Parse a JSON object from a model response, including fenced JSON."""
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end <= start:
            raise AgentConfigError("The model did not return a JSON object")
        try:
            payload = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as error:
            raise AgentConfigError(f"The model returned invalid JSON: {error.msg}") from error
    if not isinstance(payload, dict):
        raise AgentConfigError("The model response must be a JSON object")
    return payload


def config_from_plain_english(description: str) -> dict[str, Any]:
    """Convert a plain-English agent description into a validated config."""
    if not description.strip():
        raise AgentConfigError("The plain-English agent description is empty")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise AgentConfigError(
            "GROQ_API_KEY is required for plain-English ingestion"
        )

    try:
        groq_module = importlib.import_module("groq")
        client = groq_module.Groq(api_key=api_key)
        response = groq_chat_completion(
            client,
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Convert the user's agent description into one JSON object. "
                        "Return only JSON, with no markdown. Do not invent tools or "
                        "safety rules that are not implied.\n\n"
                        "Required JSON fields: agent_name, domain, system_prompt, "
                        "purpose, rules (array of strings), and tools (array). Each "
                        "tool must contain name, description, and parameters as a JSON "
                        f"object.\n\nAgent description:\n{description}"
                    ),
                }
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        response_text = response.choices[0].message.content or ""
    except Exception as error:
        raise AgentConfigError(f"Plain-English conversion failed: {error}") from error

    return validate_agent_config(_extract_json_object(response_text))


def _parse_tools(value: str) -> list[dict[str, Any]]:
    try:
        tools = json.loads(value)
    except json.JSONDecodeError as error:
        raise AgentConfigError(f"Invalid tools JSON: {error.msg}") from error
    if not isinstance(tools, list):
        raise AgentConfigError("Tools JSON must be an array")
    return tools


def main() -> int:
    parser = argparse.ArgumentParser(description="Register an Agent Under Test")
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument("--json-file", type=Path, help="Input config JSON file")
    input_group.add_argument(
        "--plain-file", type=Path, help="Plain-English agent description file"
    )
    input_group.add_argument("--plain-text", help="Plain-English agent description")
    parser.add_argument("--name", help="Agent name")
    parser.add_argument("--domain", help="Agent task domain")
    parser.add_argument("--system-prompt", help="Agent system prompt")
    parser.add_argument("--purpose", help="Agent purpose")
    parser.add_argument("--rules-json", help="JSON array of agent safety rules")
    parser.add_argument(
        "--tools-json",
        help="JSON array of tools with name, description, and parameters",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_CONFIG_PATH)
    args = parser.parse_args()

    try:
        if args.json_file:
            with args.json_file.open("r", encoding="utf-8") as file:
                config = json.load(file)
        elif args.plain_file or args.plain_text:
            description = args.plain_text
            if args.plain_file:
                description = args.plain_file.read_text(encoding="utf-8")
            config = config_from_plain_english(description)
        else:
            missing = [
                flag
                for flag, value in (
                    ("--name", args.name),
                    ("--domain", args.domain),
                    ("--system-prompt", args.system_prompt),
                    ("--purpose", args.purpose),
                    ("--rules-json", args.rules_json),
                    ("--tools-json", args.tools_json),
                )
                if value is None
            ]
            if missing:
                parser.error(f"missing required arguments: {', '.join(missing)}")
            config = {
                "agent_name": args.name,
                "domain": args.domain,
                "system_prompt": args.system_prompt,
                "purpose": args.purpose,
                "rules": _parse_tools(args.rules_json),
                "tools": _parse_tools(args.tools_json),
            }
        save_agent_config(config, args.output)
    except (AgentConfigError, FileNotFoundError, json.JSONDecodeError) as error:
        parser.error(str(error))

    print(f"Registered Agent Under Test in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())