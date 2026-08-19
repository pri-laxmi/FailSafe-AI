"""Tests for the Mock Tool Generator and Mock Tool Registry.

Run from the FailSafe-AI/ directory with:
    python -m unittest Backend.tests.test_mock_tools -v
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
for path in (str(PROJECT_ROOT), str(BACKEND_DIR)):
    if path not in sys.path:
        sys.path.insert(0, path)

from Backend.mock_tools import (  # noqa: E402
    MockToolConfigError,
    UnknownToolError,
    UnsupportedOutcomeError,
    build_registry_from_config,
    load_mock_registry,
)


BANKING_CONFIG = {
    "agent_name": "Banking Agent",
    "domain": "finance",
    "system_prompt": "You are a banking assistant.",
    "purpose": "Handle transfers.",
    "rules": ["Never transfer without verification."],
    "tools": [
        {
            "name": "transfer_money",
            "description": "Transfers money between accounts",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "amount": {"type": "number"},
                },
                "required": ["to", "amount"],
            },
            "returns": {"status": "string", "transfer_id": "string"},
        },
        {
            "name": "check_balance",
            "description": "Checks an account balance",
            "parameters": {
                "type": "object",
                "properties": {"account_id": {"type": "string"}},
                "required": ["account_id"],
            },
        },
    ],
}


# A tool that does not exist anywhere else in the codebase, to prove the
# generator is genuinely agent-agnostic and requires no hardcoded Python.
INSURANCE_CONFIG = {
    "agent_name": "Insurance Agent",
    "domain": "insurance",
    "system_prompt": "You are an insurance assistant.",
    "purpose": "Quote premiums.",
    "rules": ["Never quote without both inputs."],
    "tools": [
        {
            "name": "calculate_insurance_premium",
            "description": "Calculates an insurance premium quote",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_age": {"type": "integer"},
                    "vehicle_value": {"type": "number"},
                },
                "required": ["customer_age", "vehicle_value"],
            },
            "returns": {"premium": "number", "currency": "string"},
        }
    ],
}


class LoadAgentConfigTests(unittest.TestCase):
    def test_loading_agent_config_from_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "agent_config.json"
            config_path.write_text(json.dumps(BANKING_CONFIG), encoding="utf-8")
            registry = load_mock_registry(config_path)
            self.assertEqual(set(registry.list_tools()), {"transfer_money", "check_balance"})

    def test_missing_agent_config_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing_path = Path(tmp) / "does_not_exist.json"
            with self.assertRaises(MockToolConfigError):
                load_mock_registry(missing_path)

    def test_malformed_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "agent_config.json"
            config_path.write_text("{not valid json", encoding="utf-8")
            with self.assertRaises(MockToolConfigError):
                load_mock_registry(config_path)

    def test_missing_tools_field(self):
        config = {"agent_name": "No Tools Agent"}
        with self.assertRaises(MockToolConfigError):
            build_registry_from_config(config)

    def test_malformed_tool_definition(self):
        config = {"tools": [{"description": "missing a name"}]}
        with self.assertRaises(MockToolConfigError):
            build_registry_from_config(config)

    def test_duplicate_tool_names(self):
        config = {
            "tools": [
                {"name": "dupe", "description": "a", "parameters": {}},
                {"name": "dupe", "description": "b", "parameters": {}},
            ]
        }
        with self.assertRaises(MockToolConfigError):
            build_registry_from_config(config)


class ToolDetectionAndRegistryTests(unittest.TestCase):
    def setUp(self):
        self.registry = build_registry_from_config(BANKING_CONFIG)

    def test_detects_all_tools_dynamically(self):
        self.assertEqual(set(self.registry.list_tools()), {"transfer_money", "check_balance"})

    def test_creates_a_mock_for_every_tool(self):
        for tool_name in self.registry.list_tools():
            self.assertTrue(callable(self.registry.get_tool(tool_name)))

    def test_get_tool_unknown_raises(self):
        with self.assertRaises(UnknownToolError):
            self.registry.get_tool("does_not_exist")

    def test_calling_dynamically_generated_mock(self):
        result = self.registry.call("check_balance", {"account_id": "ACC-1"})
        self.assertEqual(result["tool_name"], "check_balance")
        self.assertEqual(result["status"], "success")


class ParameterValidationTests(unittest.TestCase):
    def setUp(self):
        self.registry = build_registry_from_config(BANKING_CONFIG)

    def test_valid_parameters_accepted(self):
        result = self.registry.call("transfer_money", {"to": "Rahul", "amount": 500})
        self.assertEqual(result["status"], "success")

    def test_invalid_parameter_type_rejected(self):
        result = self.registry.call("transfer_money", {"to": "Rahul", "amount": "five hundred"})
        self.assertEqual(result["status"], "invalid_input")
        self.assertIn("errors", result["result"])

    def test_missing_required_parameter_rejected(self):
        result = self.registry.call("transfer_money", {"to": "Rahul"})
        self.assertEqual(result["status"], "invalid_input")


class OutcomeTests(unittest.TestCase):
    def setUp(self):
        self.registry = build_registry_from_config(BANKING_CONFIG)

    def test_default_outcome_is_success(self):
        result = self.registry.call("transfer_money", {"to": "Rahul", "amount": 500})
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["result"]["status"], "success")
        self.assertTrue(result["result"]["transfer_id"].startswith("MOCK-transfer_money-"))

    def test_setting_specific_outcome(self):
        self.registry.set_outcome("transfer_money", "permission_denied")
        result = self.registry.call("transfer_money", {"to": "Rahul", "amount": 500})
        self.assertEqual(result["status"], "permission_denied")
        self.assertEqual(result["result"]["status"], "denied")

    def test_error_outcome(self):
        self.registry.set_outcome("transfer_money", "error")
        result = self.registry.call("transfer_money", {"to": "Rahul", "amount": 500})
        self.assertEqual(result["status"], "error")

    def test_timeout_outcome(self):
        self.registry.set_outcome("transfer_money", "timeout")
        result = self.registry.call("transfer_money", {"to": "Rahul", "amount": 500})
        self.assertEqual(result["status"], "timeout")

    def test_not_found_outcome(self):
        self.registry.set_outcome("check_balance", "not_found")
        result = self.registry.call("check_balance", {"account_id": "ACC-1"})
        self.assertEqual(result["status"], "not_found")

    def test_permission_denied_outcome(self):
        self.registry.set_outcome("transfer_money", "permission_denied")
        result = self.registry.call(
            "transfer_money",
            {"to": "Rahul", "amount": 500},
        )
        self.assertEqual(result["tool_name"], "transfer_money")
        self.assertEqual(result["status"], "permission_denied")
        self.assertEqual(result["result"]["status"], "denied")

    def test_unsupported_outcome_rejected(self):
        with self.assertRaises(UnsupportedOutcomeError):
            self.registry.set_outcome("transfer_money", "explodes")

    def test_set_outcome_on_unknown_tool_raises(self):
        with self.assertRaises(UnknownToolError):
            self.registry.set_outcome("does_not_exist", "success")


class UnknownToolCallTests(unittest.TestCase):
    def test_calling_unknown_tool(self):
        registry = build_registry_from_config(BANKING_CONFIG)
        result = registry.call("does_not_exist", {})
        self.assertEqual(result["tool_name"], "does_not_exist")
        self.assertEqual(result["status"], "error")
        self.assertIn("error", result["result"])


class ExecutionLogTests(unittest.TestCase):
    def test_execution_log_records_calls(self):
        registry = build_registry_from_config(BANKING_CONFIG)
        registry.call("transfer_money", {"to": "Rahul", "amount": 500})
        registry.set_outcome("check_balance", "not_found")
        registry.call("check_balance", {"account_id": "ACC-1"})

        log = registry.get_execution_log()
        self.assertEqual(len(log), 2)

        self.assertEqual(log[0]["sequence"], 1)
        self.assertEqual(log[0]["tool_name"], "transfer_money")
        self.assertEqual(log[0]["arguments"], {"to": "Rahul", "amount": 500})
        self.assertEqual(log[0]["outcome"], "success")
        self.assertIn("result", log[0])

        self.assertEqual(log[1]["sequence"], 2)
        self.assertEqual(log[1]["tool_name"], "check_balance")
        self.assertEqual(log[1]["outcome"], "not_found")


class DeterminismTests(unittest.TestCase):
    def test_same_outcome_same_call_order_is_predictable(self):
        registry_a = build_registry_from_config(BANKING_CONFIG)
        registry_b = build_registry_from_config(BANKING_CONFIG)

        registry_a.set_outcome("transfer_money", "success")
        registry_b.set_outcome("transfer_money", "success")

        args = {"to": "Rahul", "amount": 500}
        result_a = registry_a.call("transfer_money", args)
        result_b = registry_b.call("transfer_money", args)

        self.assertEqual(result_a, result_b)

    def test_no_randomness_across_repeated_calls_with_same_index(self):
        registry = build_registry_from_config(BANKING_CONFIG)
        first = registry.call("transfer_money", {"to": "A", "amount": 1})
        registry_2 = build_registry_from_config(BANKING_CONFIG)
        first_again = registry_2.call("transfer_money", {"to": "A", "amount": 1})
        self.assertEqual(first, first_again)


class NovelAgentAgnosticTests(unittest.TestCase):
    """Proves the generator needs no hardcoded Python for a brand-new tool."""

    def setUp(self):
        self.registry = build_registry_from_config(INSURANCE_CONFIG)

    def test_novel_tool_is_detected_and_callable(self):
        self.assertEqual(self.registry.list_tools(), ["calculate_insurance_premium"])
        self.assertTrue(callable(self.registry.get_tool("calculate_insurance_premium")))

    def test_novel_tool_success_follows_returns_schema(self):
        result = self.registry.call(
            "calculate_insurance_premium",
            {"customer_age": 30, "vehicle_value": 20000},
        )
        self.assertEqual(result["status"], "success")
        self.assertIn("premium", result["result"])
        self.assertIn("currency", result["result"])

    def test_novel_tool_invalid_input(self):
        result = self.registry.call(
            "calculate_insurance_premium",
            {"customer_age": "thirty", "vehicle_value": 20000},
        )
        self.assertEqual(result["status"], "invalid_input")

    def test_novel_tool_supports_all_outcomes(self):
        for outcome in (
            "success",
            "error",
            "timeout",
            "invalid_input",
            "not_found",
            "permission_denied",
        ):
            self.registry.set_outcome("calculate_insurance_premium", outcome)
            result = self.registry.call(
                "calculate_insurance_premium",
                {"customer_age": 30, "vehicle_value": 20000},
            )
            self.assertEqual(result["status"], outcome)


if __name__ == "__main__":
    unittest.main()
