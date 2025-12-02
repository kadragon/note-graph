// Trace: SPEC-ai-draft-refs-1, TASK-029, TASK-030
// Shared component for displaying AI-suggested work note references
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { AIDraftReference } from '@/types/api';

interface AIReferenceListProps {
  references: AIDraftReference[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Maximum items to show before "show all" toggle (default: 5) */
  initialDisplayCount?: number;
}

export function AIReferenceList({
  references,
  selectedIds,
  onSelectionChange,
  initialDisplayCount = 5,
}: AIReferenceListProps) {
  const [showAll, setShowAll] = useState(false);

  const handleToggle = (workId: string) => {
    onSelectionChange(
      selectedIds.includes(workId)
        ? selectedIds.filter((id) => id !== workId)
        : [...selectedIds, workId]
    );
  };

  const displayedReferences = showAll ? references : references.slice(0, initialDisplayCount);

  return (
    <div className="grid gap-2">
      <Label>AI가 참고한 업무노트</Label>
      <Card className="p-3 space-y-2 max-h-[260px] overflow-y-auto">
        {references.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2 text-center">
            <p className="font-medium">유사한 업무노트가 없습니다</p>
            <p className="text-xs mt-1">새로운 내용의 업무노트입니다</p>
          </div>
        ) : (
          displayedReferences.map((ref) => {
            const isSelected = selectedIds.includes(ref.workId);
            const scoreLabel =
              ref.similarityScore !== undefined
                ? `${Math.round(ref.similarityScore * 100)}%`
                : 'N/A';

            return (
              <div key={ref.workId} className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(ref.workId)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium">{ref.title}</div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span>연관도 {scoreLabel}</span>
                    {ref.category && (
                      <span className="text-muted-foreground">카테고리: {ref.category}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>
      {references.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>필요 없는 참고 자료는 선택 해제하세요. 해제된 항목은 저장되지 않습니다.</p>
          {references.length > initialDisplayCount && (
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? '간략히 보기' : `모두 보기 (${references.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
