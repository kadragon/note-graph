import { LazyMarkdown } from '@web/components/lazy-markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { Textarea } from '@web/components/ui/textarea';
import { cn } from '@web/lib/utils';
import { Suspense } from 'react';

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textareaClassName?: string;
}

export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  textareaClassName = 'min-h-[400px]',
}: MarkdownEditorProps) {
  return (
    <Tabs defaultValue="write">
      <TabsList>
        <TabsTrigger value="write">작성</TabsTrigger>
        <TabsTrigger value="preview">미리보기</TabsTrigger>
      </TabsList>
      <TabsContent value="write">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(textareaClassName)}
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className={cn('rounded-md border p-4', textareaClassName, 'overflow-y-auto')}>
          {value.trim() ? (
            <Suspense fallback={<p className="text-sm text-muted-foreground">로딩 중...</p>}>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <LazyMarkdown>{value}</LazyMarkdown>
              </div>
            </Suspense>
          ) : (
            <p className="text-sm text-muted-foreground">미리볼 내용이 없습니다.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
