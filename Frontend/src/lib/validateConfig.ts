import type { AgentConfig, Tool } from './types'

export class ConfigValidationError extends Error {}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConfigValidationError(`'${field}' must be a non-empty string`)
  }
  return value.trim()
}

function requiredTextList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigValidationError(`'${field}' must be a non-empty array`)
  }
  return value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new ConfigValidationError(`'${field}' must contain only non-empty strings`)
    }
    return item.trim()
  })
}

function validateTool(tool: unknown, index: number): Tool {
  if (typeof tool !== 'object' || tool === null) {
    throw new ConfigValidationError(`tools[${index}] must be an object`)
  }
  const record = tool as Record<string, unknown>
  const name = requiredText(record.name, `tools[${index}].name`)
  const description = requiredText(record.description, `tools[${index}].description`)
  const parameters = record.parameters
  if (typeof parameters !== 'object' || parameters === null) {
    throw new ConfigValidationError(`tools[${index}].parameters must be an object`)
  }
  return { name, description, parameters: parameters as Tool['parameters'] }
}

export function validateAgentConfig(input: unknown): AgentConfig {
  if (typeof input !== 'object' || input === null) {
    throw new ConfigValidationError('The configuration must be a JSON object')
  }
  const record = input as Record<string, unknown>
  const tools = record.tools
  if (!Array.isArray(tools)) {
    throw new ConfigValidationError("'tools' must be a JSON array")
  }
  return {
    agent_name: requiredText(record.agent_name, 'agent_name'),
    domain: requiredText(record.domain, 'domain'),
    system_prompt: requiredText(record.system_prompt, 'system_prompt'),
    purpose: requiredText(record.purpose, 'purpose'),
    rules: requiredTextList(record.rules, 'rules'),
    tools: tools.map(validateTool),
  }
}
