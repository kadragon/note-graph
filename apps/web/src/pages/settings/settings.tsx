import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { lazy, Suspense } from 'react';
import { ConfigSettingsTab } from './components/config-settings-tab';
import { PromptSettingsTab } from './components/prompt-settings-tab';
import { TemplateSettingsTab } from './components/template-settings-tab';

const AILogs = lazy(() => import('@web/pages/ai-logs'));
const VectorStore = lazy(() => import('@web/pages/vector-store'));

export default function Settings() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-description">AI 프롬프트, 템플릿, 환경 설정을 관리합니다.</p>
        </div>
      </div>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">AI 프롬프트</TabsTrigger>
          <TabsTrigger value="templates">템플릿</TabsTrigger>
          <TabsTrigger value="config">환경 설정</TabsTrigger>
          <TabsTrigger value="ai-logs">AI 로그</TabsTrigger>
          <TabsTrigger value="vector-store">벡터 스토어</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-4">
          <PromptSettingsTab />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplateSettingsTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigSettingsTab />
        </TabsContent>

        <TabsContent value="ai-logs" className="mt-4">
          <Suspense
            fallback={<div className="text-muted-foreground py-12 text-center">로딩 중...</div>}
          >
            <AILogs embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="vector-store" className="mt-4">
          <Suspense
            fallback={<div className="text-muted-foreground py-12 text-center">로딩 중...</div>}
          >
            <VectorStore embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
