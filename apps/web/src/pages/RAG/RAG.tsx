import { Button } from '@web/components/ui/button';
import { Card, CardContent } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import { ScrollArea } from '@web/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { useDepartments } from '@web/hooks/useDepartments';
import { usePersons } from '@web/hooks/usePersons';
import { useRAGQuery } from '@web/hooks/useRAG';
import { useWorkNotes } from '@web/hooks/useWorkNotes';
import type { RAGResponse, RAGScope } from '@web/types/api';
import { Send } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage } from './components/ChatMessage';
import {
  DepartmentFilterSelector,
  PersonFilterSelector,
  WorkNoteFilterSelector,
} from './components/FilterSelectors';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contexts?: RAGResponse['contexts'];
}

const SCOPE_DESCRIPTIONS: Record<Exclude<RAGScope, 'global'>, string> = {
  person: '특정 사람을 선택하면 해당 사람과 관련된 대화만 검색합니다.',
  department: '특정 부서를 선택하면 해당 부서와 관련된 대화만 검색합니다.',
  work: '특정 업무를 선택하면 해당 업무와 관련된 대화만 검색합니다.',
  project: '특정 프로젝트를 선택하면 해당 프로젝트와 관련된 대화만 검색합니다.',
};

export default function RAG() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<RAGScope>('global');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ragMutation = useRAGQuery();
  const { data: persons = [], isLoading: isLoadingPersons } = usePersons();
  const { data: departments = [], isLoading: isLoadingDepartments } = useDepartments();
  const { data: workNotes = [], isLoading: isLoadingWorkNotes } = useWorkNotes();

  // scope 변경 시 선택 초기화
  const handleScopeChange = (newScope: RAGScope) => {
    setScope(newScope);
    setSelectedPersonId(null);
    setSelectedDeptName(null);
    setSelectedWorkId(null);
  };

  // 필터가 필요한 scope에서 필터가 선택되었는지 확인
  const isFilterSelected = useMemo(() => {
    if (scope === 'global') return true;
    if (scope === 'person') return selectedPersonId !== null;
    if (scope === 'department') return selectedDeptName !== null;
    if (scope === 'work') return selectedWorkId !== null;
    return true;
  }, [scope, selectedPersonId, selectedDeptName, selectedWorkId]);

  // 제출 가능 여부 확인
  const canSubmit = input.trim() && !ragMutation.isPending && isFilterSelected;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages((prev) => [...prev, { id: nanoid(), role: 'user', content: userMessage }]);

    try {
      const response = await ragMutation.mutateAsync({
        query: userMessage,
        scope,
        ...(scope === 'person' && selectedPersonId ? { personId: selectedPersonId } : {}),
        ...(scope === 'department' && selectedDeptName ? { deptName: selectedDeptName } : {}),
        ...(scope === 'work' && selectedWorkId ? { workId: selectedWorkId } : {}),
      });

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: 'assistant',
          content: response.answer,
          contexts: response.contexts,
        },
      ]);
    } catch {
      // Error handled by mutation hook
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)]">
      <div className="mb-6">
        <h1 className="page-title">AI 챗봇</h1>
        <p className="page-description">AI와 대화하세요</p>
      </div>

      <div className="flex flex-col h-[calc(100%-5rem)]">
        <Tabs value={scope} onValueChange={(v) => handleScopeChange(v as RAGScope)}>
          <TabsList className="mb-4">
            <TabsTrigger value="global">전체</TabsTrigger>
            <TabsTrigger value="person">사람</TabsTrigger>
            <TabsTrigger value="department">부서</TabsTrigger>
            <TabsTrigger value="work">업무</TabsTrigger>
          </TabsList>

          {/* 필터 선택 UI */}
          {scope !== 'global' && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">{SCOPE_DESCRIPTIONS[scope]}</p>

              {scope === 'person' && (
                <PersonFilterSelector
                  persons={persons}
                  selectedPersonId={selectedPersonId}
                  onSelectionChange={setSelectedPersonId}
                  isLoading={isLoadingPersons}
                  disabled={ragMutation.isPending}
                />
              )}

              {scope === 'department' && (
                <DepartmentFilterSelector
                  departments={departments}
                  selectedDeptName={selectedDeptName}
                  onSelectionChange={setSelectedDeptName}
                  isLoading={isLoadingDepartments}
                  disabled={ragMutation.isPending}
                />
              )}

              {scope === 'work' && (
                <WorkNoteFilterSelector
                  workNotes={workNotes}
                  selectedWorkId={selectedWorkId}
                  onSelectionChange={setSelectedWorkId}
                  isLoading={isLoadingWorkNotes}
                  disabled={ragMutation.isPending}
                />
              )}
            </div>
          )}

          <TabsContent value={scope} className="flex-1 mt-0">
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 p-0 flex flex-col">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>메시지를 입력하여 대화를 시작하세요</p>
                    </div>
                  ) : (
                    <div>
                      {messages.map((message, _idx) => (
                        <ChatMessage
                          key={message.id}
                          role={message.role}
                          content={message.content}
                          contexts={message.contexts}
                        />
                      ))}
                      {ragMutation.isPending && (
                        <div className="flex justify-start mb-4">
                          <div className="bg-muted rounded-lg px-4 py-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                              <div
                                className="w-2 h-2 bg-current rounded-full animate-bounce"
                                style={{ animationDelay: '0.1s' }}
                              />
                              <div
                                className="w-2 h-2 bg-current rounded-full animate-bounce"
                                style={{ animationDelay: '0.2s' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <form onSubmit={(e) => void handleSubmit(e)} className="border-t p-4 flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    disabled={ragMutation.isPending}
                  />
                  <Button type="submit" disabled={!canSubmit}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
