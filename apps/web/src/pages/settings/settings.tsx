import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { ConfigSettingsTab } from './components/config-settings-tab';
import { PromptSettingsTab } from './components/prompt-settings-tab';

export default function Settings() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-description">AI 프롬프트와 환경 설정을 관리합니다.</p>
        </div>
      </div>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">AI 프롬프트</TabsTrigger>
          <TabsTrigger value="config">환경 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-4">
          <PromptSettingsTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
