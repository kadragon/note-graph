import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { cn } from '@web/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ReportSectionProps {
  title: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning';
  children: React.ReactNode;
}

export function ReportSection({
  title,
  icon: Icon,
  variant = 'default',
  children,
}: ReportSectionProps) {
  return (
    <Card className={cn(variant === 'warning' && 'border-amber-300 dark:border-amber-700')}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon
            className={cn(
              'h-4 w-4',
              variant === 'warning' ? 'text-amber-500' : 'text-muted-foreground'
            )}
          />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
