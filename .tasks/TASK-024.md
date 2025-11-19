# TASK-024: Add Searchable Assignee Selector for Work Notes

**Status**: 🚧 In Progress
**Priority**: 3 (UI Enhancement)
**Estimated Effort**: 3h
**Spec ID**: SPEC-worknote-1

## Objective

Replace the checkbox-based assignee selector with a searchable autocomplete component to improve UX when selecting assignees from a large list of persons.

## Problem Statement

Current implementation uses a checkbox grid layout with all persons displayed at once:
- Limited to 200px max-height scrollable area
- No search/filter capability
- Poor UX when there are many persons (difficult to find specific person)
- Users requested search functionality for easier selection

## Solution

Implement a searchable assignee selector using the existing `Command` component (cmdk):
- Search/filter persons by name or ID
- Keyboard navigation support
- Multi-select with visual badges for selected persons
- Improved accessibility

## Implementation Details

### 1. Create AssigneeSelector Component

**Location**: `frontend/src/components/AssigneeSelector.tsx`

**Features**:
- Uses Command + Popover components (already available)
- Search input for filtering persons
- Checkbox items in dropdown for multi-select
- Selected persons displayed as dismissible badges
- Supports initial selection and onChange callback
- Loading and empty states

**Props**:
```typescript
interface AssigneeSelectorProps {
  persons: Person[];
  selectedPersonIds: string[];
  onSelectionChange: (personIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}
```

### 2. Update CreateWorkNoteDialog

**File**: `frontend/src/pages/WorkNotes/components/CreateWorkNoteDialog.tsx`

**Changes**:
- Replace checkbox grid (lines 129-156) with `<AssigneeSelector />`
- Remove `handlePersonToggle` function (now handled by component)
- Update imports

### 3. Update ViewWorkNoteDialog

**File**: `frontend/src/pages/WorkNotes/components/ViewWorkNoteDialog.tsx`

**Changes**:
- Replace checkbox grid (lines 284-327) with `<AssigneeSelector />`
- Remove `handlePersonToggle` function
- Update imports
- Maintain view/edit mode behavior

## UI/UX Design

### AssigneeSelector Component Layout

```
┌─────────────────────────────────────────┐
│ 담당자 (선택사항)                         │
├─────────────────────────────────────────┤
│ [홍길동 ×] [김철수 ×]                    │  ← Selected badges
├─────────────────────────────────────────┤
│ [ 담당자 검색... ]                  [▼] │  ← Search trigger
└─────────────────────────────────────────┘

When opened:
┌─────────────────────────────────────────┐
│ 🔍 검색...                               │  ← Search input
├─────────────────────────────────────────┤
│ ☑ 홍길동 (PERSON-001)                    │
│ ☐ 김철수 (PERSON-002)                    │
│ ☐ 이영희 (PERSON-003)                    │
│ ...                                     │
└─────────────────────────────────────────┘
```

### Behavior

1. **Initial State**: Shows selected persons as badges
2. **Click Trigger**: Opens popover with searchable list
3. **Type to Search**: Filters persons by name or ID
4. **Click Item**: Toggles selection (checkbox)
5. **Selected Items**: Shown as badges with × button
6. **Remove Badge**: Click × to deselect
7. **Keyboard**:
   - Up/Down arrows: Navigate items
   - Enter: Toggle selection
   - Escape: Close popover

## Technical Decisions

### Why Command Component?

- Already installed (`cmdk` package)
- Built-in search/filter functionality
- Keyboard navigation support
- Accessibility features (ARIA)
- Consistent with shadcn/ui design system

### Why Not Build Custom?

- Avoid reinventing the wheel
- Better accessibility out of the box
- Faster implementation
- Consistent UX with potential future features

## Testing Checklist

- [ ] Component renders with initial selection
- [ ] Search filters persons correctly (by name and ID)
- [ ] Multi-select works (add/remove)
- [ ] Badge removal works
- [ ] Keyboard navigation works
- [ ] Loading state displays correctly
- [ ] Empty state displays when no persons
- [ ] Works in CreateWorkNoteDialog
- [ ] Works in ViewWorkNoteDialog (edit mode)
- [ ] Form submission includes selected person IDs

## Acceptance Criteria

✅ **Search functionality**: Users can search persons by name or ID
✅ **Multi-select**: Users can select multiple assignees
✅ **Visual feedback**: Selected persons shown as badges
✅ **Keyboard support**: Full keyboard navigation
✅ **Backwards compatible**: Existing work notes maintain assignee associations
✅ **No backend changes**: API remains unchanged

## Files Changed

1. `frontend/src/components/AssigneeSelector.tsx` - New component
2. `frontend/src/pages/WorkNotes/components/CreateWorkNoteDialog.tsx` - Updated
3. `frontend/src/pages/WorkNotes/components/ViewWorkNoteDialog.tsx` - Updated

## Dependencies

**Frontend**:
- `cmdk` (already installed) - Command component
- `@radix-ui/react-popover` (already installed) - Popover
- `lucide-react` (already installed) - Icons

**Backend**: No changes required

## References

- Command component: `frontend/src/components/ui/command.tsx`
- Popover component: `frontend/src/components/ui/popover.tsx`
- Badge component: `frontend/src/components/ui/badge.tsx`
- Person API: `GET /persons?q=searchQuery` (supports search)

## Trace

```typescript
// Trace: TASK-024, SPEC-worknote-1
```
