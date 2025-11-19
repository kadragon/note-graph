import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRAGQuery } from '@/hooks/useRAG';
import { ChatMessage } from './components/ChatMessage';
import type { RAGScope, RAGResponse } from '@/types/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGResponse['sources'];
}

export default function RAG() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<RAGScope>('global');
  const scrollRef = useRef<HTMLDivElement>(null);

  const ragMutation = useRAGQuery();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || ragMutation.isPending) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await ragMutation.mutateAsync({
        query: userMessage,
        scope,
      });

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 챗봇</h1>
        <p className="text-gray-600 mt-1">AI와 대화하세요</p>
      </div>

      <div className="flex flex-col h-[calc(100%-5rem)]">
        <Tabs value={scope} onValueChange={(v) => setScope(v as RAGScope)}>
          <TabsList className="mb-4">
            <TabsTrigger value="global">전체</TabsTrigger>
            <TabsTrigger value="person">사람</TabsTrigger>
            <TabsTrigger value="department">부서</TabsTrigger>
            <TabsTrigger value="work">업무</TabsTrigger>
          </TabsList>

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
                      {messages.map((message, idx) => (
                        <ChatMessage
                          key={idx}
                          role={message.role}
                          content={message.content}
                          sources={message.sources}
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

                <form
                  onSubmit={handleSubmit}
                  className="border-t p-4 flex gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    disabled={ragMutation.isPending}
                  />
                  <Button
                    type="submit"
                    disabled={ragMutation.isPending || !input.trim()}
                  >
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
