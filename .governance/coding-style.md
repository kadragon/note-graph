# Coding Style Guide

## General Principles

1. **Language**: All code, comments, and documentation in English
2. **User-facing text**: Korean (UI labels, messages, error strings)
3. **Clarity over brevity**: Readable code is maintainable code
4. **Type safety**: Use TypeScript strict mode

## TypeScript Conventions

### Naming
- **Files**: kebab-case (`work-note-service.ts`, `user-profile.tsx`) - *All files, including React components, utilities, and hooks.*
- **Classes**: PascalCase (`WorkNoteService`)
- **Interfaces/Types**: PascalCase with descriptive names (`WorkNote`, `TodoStatus`)
- **Functions**: camelCase (`createWorkNote`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_VERSION_COUNT`)
- **Private members**: prefix with underscore (`_internalState`)

### File Organization
```
src/
  ├── types/          # Type definitions
  ├── models/         # Data models (D1 schemas)
  ├── services/       # Business logic
  ├── handlers/       # API route handlers
  ├── utils/          # Utility functions
  ├── middleware/     # Request middleware
  └── index.ts        # Worker entry point
```

### Import Order
1. External dependencies
2. Internal types
3. Internal services/utils
4. Relative imports

```typescript
// External
import { Hono } from 'hono';

// Types
import type { WorkNote, Todo } from '@/types';

// Services
import { WorkNoteService } from '@/services/work-note-service';

// Relative
import { validateRequest } from './validators';
```

## API Design

### Endpoint Naming
- RESTful: `/work-notes`, `/persons/{personId}`
- Plural for collections, singular for resources
- Kebab-case for multi-word paths

### Request/Response
- **Request**: JSON body with camelCase keys
- **Response**: JSON with camelCase keys
- **Errors**: Consistent error schema
  ```typescript
  {
    code: string;
    message: string;
    details?: unknown;
  }
  ```

### Status Codes
- `200`: Success (GET, PUT, PATCH)
- `201`: Created (POST)
- `204`: No Content (DELETE)
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error

## Database Conventions

### Table Names
- Lowercase with underscores: `work_notes`, `person_dept_history`
- Plural for entity tables
- Descriptive junction table names: `work_note_person`

### Column Names
- snake_case: `person_id`, `created_at`
- Consistent suffixes:
  - `_id`: Primary/foreign keys
  - `_at`: Timestamps
  - `_date`: Date fields (no time)

### Indexes
- Always index foreign keys
- Index frequently filtered columns (status, category, dept_name)
- Composite indexes for common query patterns

## Testing Conventions

### Test Files
- Colocate with source: `work-note-service.test.ts`
- Use descriptive test names in Korean if needed for clarity

### Test Structure
```typescript
describe('WorkNoteService', () => {
  describe('createWorkNote', () => {
    it('should create work note with valid data', async () => {
      // Arrange
      const input = { ... };

      // Act
      const result = await service.createWorkNote(input);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

## Error Handling

### Service Layer
- Throw typed errors: `NotFoundError`, `ValidationError`
- Include context in error messages

### Handler Layer
- Catch service errors
- Map to HTTP status codes
- Return consistent error response

```typescript
try {
  const result = await service.operation();
  return c.json(result);
} catch (error) {
  if (error instanceof NotFoundError) {
    return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
  }
  return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
}
```

## Comments

### When to Comment
- Complex business logic
- Non-obvious algorithms
- Workarounds/hacks (with explanation)
- Public API functions (JSDoc)

### When NOT to Comment
- Obvious code (let code speak for itself)
- Redundant information

### JSDoc for Public APIs
```typescript
/**
 * Creates a new work note with associated metadata.
 *
 * @param input - Work note creation data
 * @returns Created work note with generated ID
 * @throws ValidationError if input is invalid
 */
async createWorkNote(input: CreateWorkNoteInput): Promise<WorkNote>
```

## Git Conventions

### Commit Messages
- Format: `<type>: <subject>`
- Types: feat, fix, refactor, test, docs, chore
- Subject: imperative mood, lowercase, no period
- Examples:
  - `feat: add PDF processing queue consumer`
  - `fix: correct todo recurrence generation logic`
  - `refactor: extract chunking logic to separate service`

### Branch Strategy
- Main branch: `main`
- Feature branches: `feature/<spec-id>-<short-desc>`
- Hotfix branches: `hotfix/<issue-desc>`
