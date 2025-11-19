# TASK-025: Assignee Badge Display Format

## Objective
Update assignee badge display format to show department/position/name (or dept/name if position is null).

## Spec Reference
- SPEC-worknote-2 (assignee-badge-format.yaml)

## Design Document (SDD)

### 1. Problem Statement
Currently, assignee badges only show the person's name, which doesn't provide enough context about who the person is, especially their organizational role and department.

Users need to see:
- Department (소속)
- Position (직책) - if available
- Name (이름)

### 2. Requirements

#### Functional Requirements
1. Badge format should follow this priority:
   - If dept AND position exist: `소속/직책/이름`
   - If only dept exists: `소속/이름`
   - If neither exist: `이름`

2. Format should be consistent across:
   - AssigneeSelector selected badges
   - ViewWorkNoteDialog assignee display

3. Maintain existing OWNER role indicator `(담당)` suffix

#### Non-Functional Requirements
1. No backend changes required
2. Reusable formatting logic
3. Maintain existing styling and layout

### 3. Solution Design

#### 3.1 Utility Function
Create a reusable utility function to format person display text:

```typescript
/**
 * Format person display text based on available fields
 * @param person - Person object with name, currentDept, currentPosition
 * @returns Formatted string: dept/position/name or dept/name or name
 */
function formatPersonBadge(person: {
  name: string;
  currentDept?: string | null;
  currentPosition?: string | null;
}): string {
  const parts: string[] = [];

  if (person.currentDept) {
    parts.push(person.currentDept);
  }

  if (person.currentPosition) {
    parts.push(person.currentPosition);
  }

  parts.push(person.name);

  return parts.join('/');
}
```

#### 3.2 Component Changes

##### AssigneeSelector.tsx (Line 74)
**Before:**
```typescript
<span>{person.name}</span>
```

**After:**
```typescript
<span>{formatPersonBadge(person)}</span>
```

##### ViewWorkNoteDialog.tsx (Line 300)
**Before:**
```typescript
{person.personName}
{person.role === 'OWNER' && (
  <span className="ml-1 text-xs">(담당)</span>
)}
```

**After:**
```typescript
{formatPersonBadge({
  name: person.personName,
  currentDept: person.currentDept,
  currentPosition: person.currentPosition
})}
{person.role === 'OWNER' && (
  <span className="ml-1 text-xs">(담당)</span>
)}
```

**Note:** ViewWorkNoteDialog needs person data with dept/position. Check if API response includes this data.

### 4. Data Flow Analysis

#### Current API Response Structure
From `frontend/src/types/api.ts`:

```typescript
export interface WorkNote {
  // ...
  persons?: Array<{
    personId: string;
    personName: string;
    role: 'OWNER' | 'RELATED';
  }>;
}
```

**Issue:** The WorkNote persons array does NOT include `currentDept` or `currentPosition`.

#### Solution Options

**Option A: Backend Enhancement (Not preferred for this task)**
- Modify backend API to include dept/position in work note response
- Requires backend changes, migrations, tests

**Option B: Frontend Join (Recommended)**
- Fetch persons list separately (already done via usePersons hook)
- Join data in frontend to enrich person info with dept/position
- No backend changes needed

### 5. Implementation Plan

#### Step 1: Create Utility Function
- Add `formatPersonBadge` utility in `frontend/src/lib/utils.ts` or create new `frontend/src/lib/formatters.ts`

#### Step 2: Update AssigneeSelector
- Import utility function
- Replace `{person.name}` with `{formatPersonBadge(person)}`
- Person object already has all required fields

#### Step 3: Update ViewWorkNoteDialog
- Enrich work note persons with full person data from persons list
- Use utility function to format display
- Maintain role suffix

#### Step 4: Testing
- Test with person having all fields
- Test with person missing position
- Test with person missing both dept and position
- Verify OWNER role suffix still displays correctly

### 6. Test Cases (Manual UI Testing)

```gherkin
Scenario: Display badge with dept, position, and name
  Given a person with currentDept="개발팀", currentPosition="팀장", name="홍길동"
  When the person is assigned to a work note
  And I view the work note
  Then the badge should display "개발팀/팀장/홍길동"

Scenario: Display badge with dept and name only
  Given a person with currentDept="기획팀", currentPosition=null, name="김철수"
  When the person is assigned to a work note
  And I view the work note
  Then the badge should display "기획팀/김철수"

Scenario: Display badge with name only
  Given a person with currentDept=null, currentPosition=null, name="이영희"
  When the person is assigned to a work note
  And I view the work note
  Then the badge should display "이영희"

Scenario: OWNER role indicator preserved
  Given a person with full dept/position/name information
  When the person is assigned as OWNER to a work note
  And I view the work note
  Then the badge should display dept/position/name followed by "(담당)"
```

### 7. Files to Modify

1. `frontend/src/lib/utils.ts` or create `frontend/src/lib/formatters.ts`
   - Add `formatPersonBadge()` function

2. `frontend/src/components/AssigneeSelector.tsx`
   - Import and use `formatPersonBadge()`
   - Update line 74

3. `frontend/src/pages/WorkNotes/components/ViewWorkNoteDialog.tsx`
   - Import and use `formatPersonBadge()`
   - Enrich person data with full person info
   - Update line 300

### 8. Rollout Plan

1. Implement changes in development
2. Manual UI testing with test data
3. Build frontend (`npm run build`)
4. Commit with trace comment: `// Trace: SPEC-worknote-2, TASK-025`
5. Update .tasks/done.yaml

### 9. Rollback Plan

If issues arise:
1. Revert commits
2. Frontend change only - no data migration needed
3. Low risk - visual display only

## Status
- [x] SDD Created
- [ ] Implementation
- [ ] Testing
- [ ] Documentation Update

## Notes
- Frontend-only change
- No backend API modifications needed
- Reusable utility function for future badge formatting
