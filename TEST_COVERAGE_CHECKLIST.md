# Test Coverage Implementation Checklist

**Overall Coverage Goal:** 80% (from current ~32%)  
**Estimated Effort:** 40-50 hours  
**Target Completion:** 4 weeks (phased approach)

---

## PHASE 1: CRITICAL GAPS (Weeks 1-2) - 18-22 hours

Must implement before other features are considered stable. These are core business logic and data access layers.

### [ ] WorkNoteRepository Tests (4-6 hours)
**File:** `/home/user/note-graph/tests/unit/repositories/work-note-repository.test.ts`  
**Coverage Target:** 25-30 test cases

- [ ] CRUD Operations
  - [ ] Create work note with valid data
  - [ ] Create work note generates unique ID
  - [ ] Read work note by ID
  - [ ] Read non-existent work note returns null
  - [ ] Update work note with partial data
  - [ ] Update work note with all fields
  - [ ] Delete work note
  - [ ] Read work note with details (associations)

- [ ] Complex Filtering
  - [ ] Find all without filters
  - [ ] Filter by person ID
  - [ ] Filter by department
  - [ ] Filter by category
  - [ ] Filter by date range (from/to)
  - [ ] Combined filters (multiple conditions)

- [ ] Associations
  - [ ] Add person association
  - [ ] Remove person association
  - [ ] Add related work note
  - [ ] Remove related work note
  - [ ] Get related work notes
  - [ ] Get work notes by person ID

- [ ] Version History
  - [ ] Create version
  - [ ] Get versions
  - [ ] Restore version
  - [ ] Max versions limit

- [ ] Edge Cases & Errors
  - [ ] Handles null/empty values
  - [ ] Constraint violations
  - [ ] Database errors
  - [ ] Transaction behavior

### [ ] TodoRepository Tests (3-4 hours)
**File:** `/home/user/note-graph/tests/unit/repositories/todo-repository.test.ts`  
**Coverage Target:** 20-25 test cases

- [ ] CRUD Operations
  - [ ] Create todo
  - [ ] Read todo by ID
  - [ ] Update todo
  - [ ] Update status (PENDING -> COMPLETED)
  - [ ] Delete todo
  - [ ] Bulk create todos

- [ ] Filtering & Queries
  - [ ] Find all todos
  - [ ] Find todos by work note ID
  - [ ] Filter by status
  - [ ] Filter by due date
  - [ ] Find overdue todos

- [ ] Status Management
  - [ ] Mark as complete
  - [ ] Mark as incomplete
  - [ ] Valid status transitions

- [ ] Associations
  - [ ] Todo belongs to work note
  - [ ] Delete work note cascades to todos

- [ ] Edge Cases
  - [ ] Null values
  - [ ] Invalid dates
  - [ ] Orphaned todos

### [ ] PersonRepository Tests (3-4 hours)
**File:** `/home/user/note-graph/tests/unit/repositories/person-repository.test.ts`  
**Coverage Target:** 20-25 test cases

- [ ] CRUD Operations
  - [ ] Create person
  - [ ] Read by ID
  - [ ] Read by person ID (6-digit)
  - [ ] Update person
  - [ ] Delete person
  - [ ] Find all persons

- [ ] Search & Filtering
  - [ ] Search by name
  - [ ] Search by department
  - [ ] Search with partial matches
  - [ ] Case-insensitive search

- [ ] Department History
  - [ ] Add department history entry
  - [ ] Get department history
  - [ ] Track department changes

- [ ] Work Notes Association
  - [ ] Get person's work notes
  - [ ] Get work notes with filters

- [ ] Cascading & Constraints
  - [ ] Delete person removes associations
  - [ ] Duplicate person ID handling
  - [ ] Department existence validation

### [ ] WorkNotesRouter Tests (4-5 hours)
**File:** `/home/user/note-graph/tests/api/work-notes.test.ts`  
**Coverage Target:** 20-25 test cases

- [ ] GET /work-notes
  - [ ] List all work notes
  - [ ] List with filters (category, person, dept, dates)
  - [ ] Pagination
  - [ ] Requires authentication
  - [ ] Returns 401 without auth

- [ ] POST /work-notes
  - [ ] Create work note with valid data
  - [ ] Returns 201 on success
  - [ ] Validates required fields
  - [ ] Returns 400 on invalid data
  - [ ] Requires authentication

- [ ] GET /work-notes/:workId
  - [ ] Get existing work note
  - [ ] Get with associations
  - [ ] Returns 404 for non-existent
  - [ ] Returns full details

- [ ] PUT /work-notes/:workId
  - [ ] Update with partial data
  - [ ] Update with all fields
  - [ ] Validate updated data
  - [ ] Returns 404 if not found

- [ ] DELETE /work-notes/:workId
  - [ ] Delete work note
  - [ ] Cascades to todos
  - [ ] Returns 404 if not found

- [ ] POST /work-notes/:workId/persons
  - [ ] Add person association
  - [ ] Validate person exists

- [ ] DELETE /work-notes/:workId/persons/:personId
  - [ ] Remove person association
  - [ ] Verify removal

- [ ] Authentication & Errors
  - [ ] All endpoints require auth
  - [ ] Error handling for DB failures
  - [ ] Proper HTTP status codes

### [ ] WorkNoteService Tests (3-4 hours)
**File:** `/home/user/note-graph/tests/unit/services/work-note-service.test.ts`  
**Coverage Target:** 18-22 test cases

- [ ] CRUD with Chunking/Embedding
  - [ ] Create triggers chunking
  - [ ] Create triggers embedding
  - [ ] Update triggers re-chunking
  - [ ] Update triggers re-embedding
  - [ ] Delete cleanup embeddings

- [ ] Filtering & Queries
  - [ ] Find all with filters
  - [ ] Find by ID with details

- [ ] Associations
  - [ ] Add person
  - [ ] Remove person
  - [ ] Get related work notes

- [ ] Integration
  - [ ] ChunkingService integration
  - [ ] EmbeddingService integration
  - [ ] Repository integration

- [ ] Error Handling
  - [ ] Handle missing work note
  - [ ] Handle validation errors
  - [ ] Handle service failures

---

## PHASE 2: HIGH PRIORITY (Week 3) - 12-16 hours

Important features that should be well-tested but not blocking.

### [ ] AIGraphService Tests (2-3 hours)
**File:** `/home/user/note-graph/tests/unit/services/ai-draft-service.test.ts`  
**Coverage Target:** 15-18 test cases

- [ ] Draft Generation
  - [ ] Generate draft from text
  - [ ] Draft includes title, content, category
  - [ ] Draft includes todo suggestions
  - [ ] Validates required fields

- [ ] Todo Suggestions
  - [ ] Generate suggestions for text
  - [ ] Generate suggestions for work note
  - [ ] Suggestions are array of todos

- [ ] Prompts
  - [ ] Draft prompt construction
  - [ ] Todo suggestions prompt construction
  - [ ] Options handled correctly

- [ ] External API (OpenAI)
  - [ ] Rate limit error (429)
  - [ ] Generic API error
  - [ ] Malformed JSON response
  - [ ] Missing content in response
  - [ ] Network errors

- [ ] Edge Cases
  - [ ] Empty input
  - [ ] Very long input
  - [ ] Special characters
  - [ ] Korean text

### [ ] RagService Tests (3-4 hours)
**File:** `/home/user/note-graph/tests/unit/services/rag-service.test.ts`  
**Coverage Target:** 18-22 test cases

- [ ] RAG Query
  - [ ] Query with GLOBAL scope
  - [ ] Query with PERSON scope
  - [ ] Query with DEPARTMENT scope
  - [ ] Query with WORK scope
  - [ ] Returns relevant results
  - [ ] Results ranked by relevance

- [ ] Answer Generation
  - [ ] Generate answer from context
  - [ ] Format answer properly
  - [ ] Handle empty context
  - [ ] Handle many results

- [ ] Context Building
  - [ ] Build context from search results
  - [ ] Include metadata
  - [ ] Format for prompt

- [ ] Prompt Construction
  - [ ] System prompt creation
  - [ ] User prompt creation
  - [ ] Context integration

- [ ] Error Handling
  - [ ] Handle OpenAI API errors
  - [ ] Handle search failures
  - [ ] Handle malformed responses

### [ ] PdfExtractionService Tests (1.5-2 hours)
**File:** `/home/user/note-graph/tests/unit/services/pdf-extraction-service.test.ts`  
**Coverage Target:** 12-15 test cases

- [ ] Valid PDF
  - [ ] Extract text from valid PDF
  - [ ] Returns non-empty string
  - [ ] Text is trimmed

- [ ] Error Handling
  - [ ] Encrypted PDF throws EncryptedPdfError
  - [ ] Corrupt PDF throws CorruptPdfError
  - [ ] Empty PDF throws EmptyPdfError
  - [ ] Generic error throws PdfProcessingError

- [ ] Validation
  - [ ] Validate PDF buffer
  - [ ] Check PDF header
  - [ ] Check minimum size
  - [ ] Reject too-small files
  - [ ] Reject invalid headers

- [ ] Edge Cases
  - [ ] PDF with metadata only
  - [ ] Multiple page PDFs
  - [ ] PDF with images only
  - [ ] PDF with special fonts

### [ ] DepartmentRepository Tests (2-3 hours)
**File:** `/home/user/note-graph/tests/unit/repositories/department-repository.test.ts`  
**Coverage Target:** 15-18 test cases

- [ ] CRUD Operations
  - [ ] Create department
  - [ ] Read by ID
  - [ ] Read by name
  - [ ] Update department
  - [ ] Delete department
  - [ ] Find all departments

- [ ] Search & Filtering
  - [ ] Search by name
  - [ ] Search by description
  - [ ] Case-insensitive search
  - [ ] Partial matches

- [ ] Statistics
  - [ ] Get person count
  - [ ] Get work note count
  - [ ] Aggregate queries

- [ ] Constraints
  - [ ] Department name uniqueness
  - [ ] Delete with persons cascade
  - [ ] Delete with work notes cascade

- [ ] Edge Cases
  - [ ] Empty results
  - [ ] Special characters in name
  - [ ] Very long descriptions
  - [ ] Korean department names

### [ ] PersonsRouter Additional Tests (2-3 hours)
**File:** `/home/user/note-graph/tests/api/persons.test.ts` (extend existing)  
**Coverage Target:** Add 14+ test cases

- [ ] GET /persons
  - [ ] List all persons (NEW)
  - [ ] Search by name (NEW)
  - [ ] Search by department (NEW)
  - [ ] Pagination (NEW)

- [ ] GET /persons/:personId
  - [ ] Get existing person (NEW)
  - [ ] Returns 404 if not found (NEW)

- [ ] PUT /persons/:personId
  - [ ] Update person (NEW)
  - [ ] Update department (NEW)
  - [ ] Validate data (NEW)

- [ ] DELETE /persons/:personId
  - [ ] Delete person (NEW)
  - [ ] Cascade cleanup (NEW)

- [ ] GET /persons/:personId/dept-history
  - [ ] Get department history (NEW)
  - [ ] Returns chronological list (NEW)

---

## PHASE 3: MEDIUM PRIORITY (Week 4) - 8-12 hours

Supporting features and utilities.

### [ ] PDFRouter Tests (2-3 hours)
**File:** `/home/user/note-graph/tests/api/pdf.test.ts`  
**Coverage Target:** 16-20 test cases

- [ ] POST /pdf/upload
  - [ ] Upload valid PDF
  - [ ] Extract text automatically
  - [ ] Invalid file type rejection
  - [ ] File size limits

- [ ] GET /pdf/jobs/:jobId
  - [ ] Get job status
  - [ ] Get with results
  - [ ] Returns 404 if not found

- [ ] GET /pdf/jobs
  - [ ] List all jobs
  - [ ] Filter by status
  - [ ] Pagination

- [ ] GET /pdf/jobs/:jobId/download
  - [ ] Download extraction result
  - [ ] Returns proper content type
  - [ ] Returns 404 if not found

- [ ] Error Handling
  - [ ] Encrypted PDF handling
  - [ ] Corrupt PDF handling
  - [ ] Empty PDF handling

### [ ] TodosRouter Tests (1.5-2 hours)
**File:** `/home/user/note-graph/tests/api/todos.test.ts`  
**Coverage Target:** 12-15 test cases

- [ ] GET /todos
  - [ ] List all todos
  - [ ] Filter by status
  - [ ] Filter by due date

- [ ] POST /work-notes/:workId/todos
  - [ ] Create todo for work note
  - [ ] Validate work note exists
  - [ ] Returns 400 if invalid data

- [ ] PUT /todos/:todoId
  - [ ] Update todo
  - [ ] Update any field
  - [ ] Returns 404 if not found

- [ ] PUT /todos/:todoId/status
  - [ ] Update status
  - [ ] Valid transitions only

- [ ] DELETE /todos/:todoId
  - [ ] Delete todo
  - [ ] Returns 404 if not found

### [ ] PdfJobRepository Tests (1.5-2 hours)
**File:** `/home/user/note-graph/tests/unit/repositories/pdf-job-repository.test.ts`  
**Coverage Target:** 12-15 test cases

- [ ] CRUD Operations
  - [ ] Create job
  - [ ] Read by ID
  - [ ] Update status
  - [ ] Delete job
  - [ ] Find all jobs

- [ ] Status Management
  - [ ] Find by status
  - [ ] Status transitions
  - [ ] Track state changes

- [ ] Results
  - [ ] Set extraction result
  - [ ] Get result
  - [ ] Null/empty handling

- [ ] Statistics
  - [ ] Count unprocessed jobs
  - [ ] Count by status

### [ ] RagRouter Tests (1.5-2 hours)
**File:** `/home/user/note-graph/tests/api/rag.test.ts`  
**Coverage Target:** 10-12 test cases

- [ ] POST /rag/query
  - [ ] Query with different scopes
  - [ ] Returns answer
  - [ ] Validates input
  - [ ] Requires authentication

- [ ] POST /rag/stream
  - [ ] Stream response
  - [ ] Stream format
  - [ ] Connection handling

- [ ] Error Handling
  - [ ] Missing query parameter
  - [ ] Invalid scope
  - [ ] API errors

### [ ] AuthMiddleware Unit Tests (1-2 hours)
**File:** `/home/user/note-graph/tests/unit/middleware/auth.test.ts` (NEW)  
**Coverage Target:** 12-15 test cases

- [ ] Header Extraction
  - [ ] Extract Cloudflare Access header
  - [ ] Extract test header (dev mode)
  - [ ] Case insensitive

- [ ] Validation
  - [ ] Reject if no header
  - [ ] Accept valid email
  - [ ] Normalize email (lowercase, trim)

- [ ] Context
  - [ ] Set user in context
  - [ ] User object structure
  - [ ] getAuthUser retrieval

- [ ] Error Handling
  - [ ] Missing in production
  - [ ] Invalid format
  - [ ] Multiple values

---

## ADDITIONAL TASKS

### [ ] Create Test Utilities & Fixtures

- [ ] Mock D1Database factory
  - [ ] Create mock with vitest
  - [ ] Mock prepare/bind/all/first methods
  - [ ] Setup common responses

- [ ] Test data factories
  - [ ] createMockWorkNote()
  - [ ] createMockPerson()
  - [ ] createMockDepartment()
  - [ ] createMockTodo()
  - [ ] createMockEnv()

- [ ] Test helpers
  - [ ] Database transaction helpers
  - [ ] Seed data functions
  - [ ] Cleanup functions

### [ ] Integration Test Suite

- [ ] E2E workflow tests
  - [ ] Create work note with persons
  - [ ] Search and retrieve
  - [ ] Update and version
  - [ ] Generate AI draft
  - [ ] Upload PDF and extract

### [ ] Coverage Reporting

- [ ] Configure coverage thresholds
  - [ ] Line coverage: 80%+
  - [ ] Branch coverage: 75%+
  - [ ] Function coverage: 80%+

- [ ] Generate coverage reports
  - [ ] HTML reports
  - [ ] CI/CD integration
  - [ ] Trend tracking

---

## Success Criteria

- [ ] All Phase 1 tests implemented and passing
- [ ] All Phase 2 tests implemented and passing
- [ ] All Phase 3 tests implemented and passing
- [ ] Overall coverage >= 80%
- [ ] No failing tests in CI/CD
- [ ] All edge cases covered
- [ ] Error handling validated
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Team trained on new tests

---

## Notes for Implementation

1. **Test Structure**: Follow existing test patterns (vitest + mocks)
2. **Mocking**: Use vi.fn() for functions, mock D1Database properly
3. **Test Data**: Create reusable factories for test objects
4. **Naming**: Use descriptive test names following "should [action] [condition]" pattern
5. **Assertions**: Be specific with assertions (not just .toBeDefined())
6. **Error Cases**: Test both success and failure paths
7. **Async/Await**: Properly handle async tests
8. **Cleanup**: Ensure tests clean up after themselves

---

**Last Updated:** 2025-11-18  
**Status:** Ready for implementation
