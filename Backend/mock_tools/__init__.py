"""Mock Tool Generator + Mock Tool Registry.

Consumes agent_config.json and produces a callable MockToolRegistry
without any agent- or tool-specific code.
"""

try:
    from Backend.mock_tools.errors import (
        MockToolConfigError,
        MockToolError,
        UnknownToolError,
        UnsupportedOutcomeError,
    )
    from Backend.mock_tools.mock_tool_generator import SUPPORTED_OUTCOMES, ToolSpec
    from Backend.mock_tools.mock_tool_registry import (
        DEFAULT_AGENT_CONFIG_PATH,
        MockToolRegistry,
        build_registry_from_config,
        load_mock_registry,
    )
except ModuleNotFoundError:
    from mock_tools.errors import (
        MockToolConfigError,
        MockToolError,
        UnknownToolError,
        UnsupportedOutcomeError,
    )
    from mock_tools.mock_tool_generator import SUPPORTED_OUTCOMES, ToolSpec
    from mock_tools.mock_tool_registry import (
        DEFAULT_AGENT_CONFIG_PATH,
        MockToolRegistry,
        build_registry_from_config,
        load_mock_registry,
    )

__all__ = [
    "MockToolError",
    "MockToolConfigError",
    "UnknownToolError",
    "UnsupportedOutcomeError",
    "SUPPORTED_OUTCOMES",
    "ToolSpec",
    "MockToolRegistry",
    "DEFAULT_AGENT_CONFIG_PATH",
    "build_registry_from_config",
    "load_mock_registry",
]
