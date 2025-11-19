import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <>
      <AppLayout>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-notes" element={<WorkNotes />} />
            <Route path="/persons" element={<Persons />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/task-categories" element={<TaskCategories />} />
            <Route path="/search" element={<Search />} />
            <Route path="/rag" element={<RAG />} />
            <Route path="/pdf" element={<PDFUpload />} />
          </Routes>
        </Suspense>
      </AppLayout>
      <Toaster />
    </>
  );
}

export default App;
