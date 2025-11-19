# TASK-025: Add Edit Person Feature

**Status**: 🚧 In Progress
**Priority**: 3 (UI Enhancement)
**Estimated Effort**: 4h
**Spec ID**: SPEC-person-1

## Objective

Enable editing existing persons in the person list by clicking on a person row. This allows users to update person information (name, department, position) using a dialog similar to the create person dialog.

## Problem Statement

Current implementation only allows creating new persons:
- Person list is read-only (no edit functionality)
- Users cannot modify person information after creation
- No visual indication that rows are clickable
- User requested the ability to edit existing persons

## Solution

Implement person editing functionality:
- Make person table rows clickable
- Reuse the person dialog component for both create and edit modes
- Add `useUpdatePerson` hook for API integration
- Show visual feedback on hover to indicate clickability
- Pre-populate form fields with existing person data in edit mode

## Implementation Details

### 1. Create/Update EditPersonDialog Component

**Option A: Create New Component**
**Location**: `frontend/src/pages/Persons/components/EditPersonDialog.tsx`

**Option B: Refactor Existing Component (Recommended)**
**Location**: Rename `CreatePersonDialog.tsx` to `PersonDialog.tsx`

We'll use **Option B** to follow DRY principle and maintain consistency with TASK-024 pattern.

**Features**:
- Single dialog component for both create and edit modes
- Explicit mode prop: `'create' | 'edit'`
- Pre-populate fields in edit mode with initialData
- Form validation with user-friendly error messages
- Different dialog titles: "새 사람 추가" vs "사람 정보 수정"
- Different button labels: "저장" vs "수정"
- Supports all person fields: name, personId, currentDept, currentPosition
- Person ID field disabled in edit mode
- Uses Command + Popover for department selection (same as create)
- Real-time error clearing when user corrects input

**Props**:
```typescript
interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit'; // Explicit mode prop
  initialData?: Person | null; // Person data for edit mode
}
```

### 2. Add useUpdatePerson Hook

**File**: `frontend/src/hooks/usePersons.ts`

**Implementation**:
```typescript
export function useUpdatePerson() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ personId, data }: { personId: string; data: UpdatePersonRequest }) =>
      API.updatePerson(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      toast({
        title: '성공',
        description: '사람 정보가 수정되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || '사람 정보를 수정할 수 없습니다.',
      });
    },
  });
}
```

### 3. Update Persons.tsx

**File**: `frontend/src/pages/Persons/Persons.tsx`

**Changes**:
1. Add state for edit dialog and selected person:
```typescript
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
```

2. Add click handler for table rows:
```typescript
const handleRowClick = (person: Person) => {
  setSelectedPerson(person);
  setEditDialogOpen(true);
};
```

3. Update TableRow to be clickable:
```typescript
<TableRow
  key={person.personId}
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => handleRowClick(person)}
>
```

4. Replace CreatePersonDialog with PersonDialog (supports both modes):
```typescript
<PersonDialog
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
  mode="create"
/>

<PersonDialog
  open={editDialogOpen}
  onOpenChange={setEditDialogOpen}
  mode="edit"
  initialData={selectedPerson}
/>
```

### 4. Update API Types (if needed)

**File**: `frontend/src/types/api.ts`

Verify `UpdatePersonRequest` type exists:
```typescript
export interface UpdatePersonRequest {
  name?: string;
  currentDept?: string;
  currentPosition?: string;
  currentRoleDesc?: string;
}
```

## UI/UX Design

### Person List with Clickable Rows

```
┌──────────────────────────────────────────────────────────┐
│ 사람 목록                                    [+ 새 사람]  │
├──────────────────────────────────────────────────────────┤
│ 이름    사번      부서         직책        생성일        │
├──────────────────────────────────────────────────────────┤
│ 홍길동  310170   개발팀       팀장    2024-01-15        │ ← Hover bg
│ 김철수  310171   기획팀       대리    2024-01-16        │
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
```

### Edit Person Dialog

```
┌────────────────────────────────────────┐
│ 사람 정보 수정                    [×]  │
├────────────────────────────────────────┤
│                                        │
│ 이름                                   │
│ [홍길동                           ]    │
│                                        │
│ 사번 (수정 불가)                       │
│ [310170                           ]    │ ← Disabled
│                                        │
│ 부서 (선택)                            │
│ [개발팀                        ▼]      │ ← Searchable
│                                        │
│ 직책 (선택)                            │
│ [팀장                             ]    │
│                                        │
│                    [취소]  [수정]      │
└────────────────────────────────────────┘
```

### Behavior

1. **Click Row**: Opens edit dialog with pre-filled data
2. **Person ID Field**: Disabled in edit mode (cannot change primary key)
3. **Department Selection**: Same searchable popover as create mode
4. **Form Validation**: Same as create mode
5. **Save**: Calls updatePerson API
6. **Success**: Toast message, closes dialog, refreshes list
7. **Error**: Toast message, keeps dialog open

## Technical Decisions

### Why Refactor Instead of Creating New Component?

- **DRY Principle**: Avoid duplicating form logic
- **Consistency**: Same UX for create and edit
- **Maintainability**: Single source of truth for person form
- **Pattern**: Matches TASK-024 approach (AssigneeSelector)

### Why Disable Person ID in Edit Mode?

- **Data Integrity**: Person ID is the primary key
- **Backend Constraint**: Changing person ID would break relationships
- **User Safety**: Prevents accidental data corruption

### Why Click Row Instead of Edit Button?

- **Simplicity**: Cleaner UI, fewer visual elements
- **Common Pattern**: Standard UX pattern for editable lists
- **Efficiency**: Fewer clicks for users

## Testing Checklist

### Unit Tests
- [ ] useUpdatePerson hook calls API correctly
- [ ] useUpdatePerson invalidates query cache on success
- [ ] useUpdatePerson shows toast on success/error

### Integration Tests
- [ ] PersonDialog renders in create mode (no personId)
- [ ] PersonDialog renders in edit mode (with personId)
- [ ] PersonDialog pre-fills form fields in edit mode
- [ ] PersonDialog disables personId field in edit mode
- [ ] PersonDialog shows correct title/button text per mode
- [ ] Form validation works in both modes
- [ ] Department selection works in both modes

### E2E Tests
- [ ] Click person row opens edit dialog
- [ ] Edit dialog shows existing person data
- [ ] Can change name in edit dialog
- [ ] Can change department in edit dialog
- [ ] Can change position in edit dialog
- [ ] Cannot change person ID
- [ ] Save button updates person
- [ ] Success toast appears after save
- [ ] Person list refreshes with updated data
- [ ] Hover state shows on table rows

## Acceptance Criteria

✅ **Edit functionality**: Users can edit existing persons by clicking table rows
✅ **Visual feedback**: Hover state indicates clickability
✅ **Data preservation**: Person ID cannot be changed
✅ **UX consistency**: Same dialog component for create and edit
✅ **Form validation**: Same validation rules as create mode
✅ **API integration**: Uses existing PUT /persons/:personId endpoint
✅ **No backend changes**: API remains unchanged

## Files Changed

1. `frontend/src/pages/Persons/components/CreatePersonDialog.tsx` → `PersonDialog.tsx` - Refactored
2. `frontend/src/pages/Persons/Persons.tsx` - Updated with click handlers
3. `frontend/src/hooks/usePersons.ts` - Added useUpdatePerson hook
4. `frontend/src/types/api.ts` - Verify UpdatePersonRequest type exists

## Dependencies

**Frontend**:
- `@tanstack/react-query` (already installed) - Data fetching
- `cmdk` (already installed) - Command component
- `@radix-ui/react-popover` (already installed) - Popover
- `lucide-react` (already installed) - Icons

**Backend**: No changes required (PUT /persons/:personId already exists)

## References

- Person API: `PUT /persons/{personId}` (backend already implemented)
- Spec: SPEC-person-1 (person-management/spec.yaml)
- Similar pattern: TASK-024 (AssigneeSelector with edit mode)
- Dialog component: `frontend/src/components/ui/dialog.tsx`
- Command component: `frontend/src/components/ui/command.tsx`

## Backend API Reference

The backend already supports person updates:

**Endpoint**: `PUT /persons/:personId`

**Request Body**:
```json
{
  "name": "홍길동",
  "currentDept": "개발팀",
  "currentPosition": "팀장",
  "currentRoleDesc": "백엔드 개발 담당"
}
```

**Response**:
```json
{
  "personId": "310170",
  "name": "홍길동",
  "currentDept": "개발팀",
  "currentPosition": "팀장",
  "currentRoleDesc": "백엔드 개발 담당",
  "createdAt": "2024-01-15T00:00:00Z",
  "updatedAt": "2024-11-19T10:30:00Z"
}
```

**Validation**:
- All fields optional (partial update)
- name: 1-100 characters if provided
- currentDept: 0-100 characters if provided
- currentPosition: 0-100 characters if provided
- currentRoleDesc: 0-500 characters if provided

**Business Logic**:
- If currentDept changes, department history is automatically updated:
  - Previous dept history entry: `is_active=false`, `end_date` set
  - New dept history entry: `is_active=true`, `start_date` set

## Trace

```typescript
// Trace: TASK-025, SPEC-person-1
```

All code changes will include this trace identifier.
