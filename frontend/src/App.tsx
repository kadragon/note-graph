import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import WorkNotes from '@/pages/WorkNotes';
import Persons from '@/pages/Persons';
import Departments from '@/pages/Departments';
import Search from '@/pages/Search';
import RAG from '@/pages/RAG';
import PDFUpload from '@/pages/PDFUpload';

function App() {
  return (
    <>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/work-notes" element={<WorkNotes />} />
          <Route path="/persons" element={<Persons />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/search" element={<Search />} />
          <Route path="/rag" element={<RAG />} />
          <Route path="/pdf" element={<PDFUpload />} />
        </Routes>
      </AppLayout>
      <Toaster />
    </>
  );
}

export default App;
