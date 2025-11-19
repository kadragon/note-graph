import { TodoTabs } from './components/TodoTabs';

export default function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-600 mt-1">할 일을 관리하세요</p>
      </div>

      <TodoTabs />
    </div>
  );
}
