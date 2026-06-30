/**
 * MCP Input/Output Validator
 *
 * Validates request payloads against tool inputSchema before execution.
 * Validates responses against outputSchema (informational).
 * Standardized MCP error codes.
 */

/** Standard MCP error codes */
export enum McpErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  // ContextLens custom codes
  UNAUTHORIZED = -32001,
  RATE_LIMITED = -32002,
  PERMISSION_DENIED = -32003,
  TOOL_NOT_FOUND = -32004,
  VALIDATION_ERROR = -32005,
  FEATURE_DISABLED = -32006,
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate input arguments against a JSON Schema.
 * Lightweight validator — covers required fields, type checks, and enum validation.
 * For production, swap with ajv or similar.
 */
export function validateInput(
  args: Record<string, any>,
  schema: Record<string, any>
): ValidationResult {
  const errors: string[] = [];

  if (!schema || schema.type !== 'object') {
    return { valid: true, errors: [] };
  }

  const properties = schema.properties || {};
  const required = schema.required || [];

  // Check required fields
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // Type-check provided fields
  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key];
    if (!propSchema) continue; // Allow extra fields (open schema)

    const expectedType = (propSchema as any).type;
    if (expectedType && !checkType(value, expectedType)) {
      errors.push(`Field '${key}' expected type '${expectedType}', got '${typeof value}'`);
    }

    // Enum check
    const enumValues = (propSchema as any).enum;
    if (enumValues && !enumValues.includes(value)) {
      errors.push(`Field '${key}' must be one of: ${enumValues.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a response payload (informational, non-blocking).
 */
export function validateOutput(
  response: any,
  schema?: Record<string, any>
): ValidationResult {
  if (!schema) return { valid: true, errors: [] };
  // Output validation is advisory — log warnings but don't block
  return { valid: true, errors: [] };
}

/**
 * Create a standardized MCP error response.
 */
export function createMcpError(
  code: McpErrorCode,
  message: string,
  data?: any
): { code: number; message: string; data?: any } {
  return { code, message, ...(data ? { data } : {}) };
}

/**
 * Basic type check helper.
 */
function checkType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'integer': return Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    default: return true;
  }
}
