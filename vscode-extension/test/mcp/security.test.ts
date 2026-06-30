/**
 * Unit tests for MCP Security modules
 */

import { RateLimiter } from '../../src/mcp/security/rateLimiter';
import { validateInput, McpErrorCode } from '../../src/mcp/security/validator';
import { TokenManager } from '../../src/mcp/auth/tokenManager';
import { ClientIdentityTracker } from '../../src/mcp/auth/clientIdentity';

describe('RateLimiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000, burstLimit: 5 });
    const result = limiter.checkLimit('test-client');
    if (!result.allowed) throw new Error('Expected allowed');
  });

  it('should classify expensive tools', () => {
    const limiter = new RateLimiter();
    if (!limiter.isExpensiveTool('explain_diff')) {
      throw new Error('Expected explain_diff to be expensive');
    }
    if (limiter.isExpensiveTool('get_status')) {
      throw new Error('Expected get_status to not be expensive');
    }
  });

  it('should reset client limits', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000, burstLimit: 0 });
    limiter.checkLimit('client-a');
    limiter.checkLimit('client-a');
    limiter.resetClient('client-a');
    const result = limiter.checkLimit('client-a');
    if (!result.allowed) throw new Error('Expected allowed after reset');
  });
});

describe('validateInput', () => {
  it('should pass with valid input', () => {
    const result = validateInput(
      { query: 'test' },
      {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      }
    );
    if (!result.valid) throw new Error(`Expected valid: ${result.errors.join(', ')}`);
  });

  it('should fail on missing required field', () => {
    const result = validateInput(
      {},
      {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      }
    );
    if (result.valid) throw new Error('Expected invalid');
    if (!result.errors[0].includes('query')) throw new Error('Expected query in error');
  });

  it('should fail on wrong type', () => {
    const result = validateInput(
      { query: 123 },
      {
        type: 'object',
        properties: { query: { type: 'string' } },
      }
    );
    if (result.valid) throw new Error('Expected invalid');
  });
});

describe('TokenManager', () => {
  it('should generate token on start', () => {
    const tm = new TokenManager(300000); // 5 min TTL
    const token = tm.start();
    if (!token || token.length < 32) throw new Error('Expected valid token');
    tm.stop();
  });

  it('should validate current token', () => {
    const tm = new TokenManager(300000);
    const token = tm.start();
    if (!tm.validate(token)) throw new Error('Expected valid');
    if (tm.validate('invalid-token')) throw new Error('Expected invalid');
    tm.stop();
  });

  it('should regenerate token', () => {
    const tm = new TokenManager(300000);
    const token1 = tm.start();
    const token2 = tm.regenerate();
    if (token1 === token2) throw new Error('Expected different tokens');
    if (!tm.validate(token2)) throw new Error('Expected new token valid');
    tm.stop();
  });
});

describe('ClientIdentityTracker', () => {
  it('should record and retrieve clients', () => {
    const tracker = new ClientIdentityTracker();
    tracker.recordConnection('claude-desktop', '1.0');
    const clients = tracker.getClients();
    if (clients.length !== 1) throw new Error('Expected 1 client');
    if (clients[0].clientId !== 'claude-desktop') throw new Error('Wrong client ID');
  });

  it('should increment call count', () => {
    const tracker = new ClientIdentityTracker();
    tracker.recordConnection('cursor', '2.0');
    tracker.recordConnection('cursor', '2.0');
    const client = tracker.getClient('cursor');
    if (!client || client.callCount !== 2) throw new Error('Expected 2 calls');
  });

  it('should parse headers', () => {
    const tracker = new ClientIdentityTracker();
    const result = tracker.parseFromHeaders({ 'x-mcp-client': 'cursor/2.1' });
    if (result.clientId !== 'cursor') throw new Error('Expected cursor');
    if (result.version !== '2.1') throw new Error('Expected 2.1');
  });
});
