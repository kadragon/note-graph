import AppLayout from '@web/components/layout/AppLayout';
import { Toaster } from '@web/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy load page components
const Dashboard = lazy(() => import('@web/pages/Dashboard'));
const WorkNotes = lazy(() => import('@web/pages/WorkNotes'));
const Persons = lazy(() => import('@web/pages/Persons'));
const Departments = lazy(() => import('@web/pages/Departments'));
const TaskCategories = lazy(() => import('@web/pages/TaskCategories/TaskCategories'));
const Search = lazy(() => import('@web/pages/Search'));
const RAG = lazy(() => import('@web/pages/RAG'));
const PDFUpload = lazy(() => import('@web/pages/PDFUpload'));
const VectorStore = lazy(() => import('@web/pages/VectorStore'));
const Projects = lazy(() => import('@web/pages/Projects'));
const Statistics = lazy(() => import('@web/pages/Statistics'));

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
