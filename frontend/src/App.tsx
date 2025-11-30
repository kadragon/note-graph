import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/layout/AppLayout';

// Lazy load page components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const WorkNotes = lazy(() => import('@/pages/WorkNotes'));
const Persons = lazy(() => import('@/pages/Persons'));
const Departments = lazy(() => import('@/pages/Departments'));
const TaskCategories = lazy(() => import('@/pages/TaskCategories/TaskCategories'));
const Search = lazy(() => import('@/pages/Search'));
const RAG = lazy(() => import('@/pages/RAG'));
const PDFUpload = lazy(() => import('@/pages/PDFUpload'));
const VectorStore = lazy(() => import('@/pages/VectorStore'));
const Projects = lazy(() => import('@/pages/Projects'));
const Statistics = lazy(() => import('@/pages/Statistics'));

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
