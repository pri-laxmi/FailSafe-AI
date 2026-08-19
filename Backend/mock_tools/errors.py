"""Exceptions raised by the Mock Tool Generator and Mock Tool Registry."""


class MockToolError(Exception):
    """Base class for all mock-tool related errors."""


class MockToolConfigError(MockToolError):
    """Raised when agent_config.json (or a tool definition inside it) is invalid."""


class UnknownToolError(MockToolError):
    """Raised when referencing a tool name that is not in the registry."""


class UnsupportedOutcomeError(MockToolError):
    """Raised when configuring an outcome that the registry does not support."""
