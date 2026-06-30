# Example: Semantic Search

Search your past coding sessions for relevant context.

## Usage

### Search Past Episodes

Ask your AI client:
```
Search my past work for anything related to "database migration" 
using search_context
```

Tool call:
```json
{
  "name": "search_context",
  "arguments": {
    "query": "database migration"
  }
}
```

### Expected Output

```
Search Results for "database migration":

1. Episode: "Migrate to PostgreSQL" (2 days ago)
   - Changed 8 files
   - Key changes: Added migration scripts, updated ORM config
   - AI interactions: 3 calls discussing schema design

2. Episode: "Add user table" (1 week ago)
   - Changed 4 files
   - Key changes: Created users table, added indexes
   - AI interactions: 1 call about column types
```

### Use Cases

- **Onboarding**: "What has been done on the payment system?"
- **Bug investigation**: "Show me recent changes to the auth module"
- **Knowledge retrieval**: "How did we handle rate limiting before?"
- **Code review prep**: "What episodes touched this file?"
