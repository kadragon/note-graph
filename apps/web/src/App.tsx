import AppLayout from '@web/components/layout/app-layout';
import { Toaster } from '@web/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy load page components
const Dashboard = lazy(() => import('@web/pages/dashboard'));
const WorkNotes = lazy(() => import('@web/pages/work-notes'));
const Persons = lazy(() => import('@web/pages/persons'));
const Departments = lazy(() => import('@web/pages/departments'));
const TaskCategories = lazy(() => import('@web/pages/task-categories/task-categories'));
const Search = lazy(() => import('@web/pages/search'));
const RAG = lazy(() => import('@web/pages/rag'));
const PDFUpload = lazy(() => import('@web/pages/pdf-upload'));
const VectorStore = lazy(() => import('@web/pages/vector-store'));
const Projects = lazy(() => import('@web/pages/projects'));
const Statistics = lazy(() => import('@web/pages/statistics'));

function App() {
  return (
    <>
      <AppLayout>
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
            <Route path="/persons" element={<Persons />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/task-categories" element={<TaskCategories />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/search" element={<Search />} />
            <Route path="/rag" element={<RAG />} />
            <Route path="/pdf" element={<PDFUpload />} />
            <Route path="/vector-store" element={<VectorStore />} />
          </Routes>
        </Suspense>
      </AppLayout>
      <Toaster />
    </>
  );
}

export default App;
