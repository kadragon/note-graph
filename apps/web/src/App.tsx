import { ErrorBoundary } from '@web/components/error-boundary';
import AppLayout from '@web/components/layout/app-layout';
import { Toaster } from '@web/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

// Lazy load page components
const Dashboard = lazy(() => import('@web/pages/dashboard'));
const WorkNotes = lazy(() => import('@web/pages/work-notes'));
const MeetingMinutes = lazy(() => import('@web/pages/meeting-minutes'));
const Persons = lazy(() => import('@web/pages/persons'));
const Departments = lazy(() => import('@web/pages/departments'));
const TaskCategories = lazy(() => import('@web/pages/task-categories/task-categories'));
const WorkNoteGroups = lazy(() => import('@web/pages/work-note-groups/work-note-groups'));
const Search = lazy(() => import('@web/pages/search'));
const RAG = lazy(() => import('@web/pages/rag'));
const PDFUpload = lazy(() => import('@web/pages/pdf-upload'));
const VectorStore = lazy(() => import('@web/pages/vector-store'));

const Statistics = lazy(() => import('@web/pages/statistics'));
const AILogs = lazy(() => import('@web/pages/ai-logs'));

function App() {
  const location = useLocation();

  return (
    <>
      <AppLayout>
        <ErrorBoundary key={location.pathname}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/work-notes" element={<WorkNotes />} />
              <Route path="/meeting-minutes" element={<MeetingMinutes />} />
              <Route path="/persons" element={<Persons />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/task-categories" element={<TaskCategories />} />
              <Route path="/work-note-groups" element={<WorkNoteGroups />} />

              <Route path="/statistics" element={<Statistics />} />
              <Route path="/search" element={<Search />} />
              <Route path="/rag" element={<RAG />} />
              <Route path="/pdf" element={<PDFUpload />} />
              <Route path="/vector-store" element={<VectorStore />} />
              <Route path="/ai-logs" element={<AILogs />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppLayout>
      <Toaster />
    </>
  );
}

export default App;
