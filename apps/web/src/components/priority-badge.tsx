import { Badge } from '@web/components/ui/badge';

interface PriorityBadgeProps {
  priority: number | null | undefined;
}

/**
 * Renders a priority badge for todo items.
 * - 1: 긴급 (destructive)
 * - 2: 높음 (orange)
 * - 3: 보통 (no badge)
 * - 4: 낮음 (outline)
 */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
  switch (priority) {
    case 1:
      return (
        <Badge variant="destructive" className="text-xs">
          긴급
        </Badge>
      );
    case 2:
      return (
        <Badge className="text-xs bg-orange-500 hover:bg-orange-500/80 text-white">높음</Badge>
      );
    case 4:
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          낮음
        </Badge>
      );
    default:
      return null;
  }
}
