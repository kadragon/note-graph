import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import WorkNotes from '@/pages/WorkNotes';

// Placeholder pages - will be implemented in next steps

function Persons() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">사람 관리</h1>
      <p className="text-muted-foreground">사람 관리 페이지입니다.</p>
    </div>
  );
}

function Departments() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">부서 관리</h1>
      <p className="text-muted-foreground">부서 관리 페이지입니다.</p>
    </div>
  );
}

function Search() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">검색</h1>
      <p className="text-muted-foreground">검색 페이지입니다.</p>
    </div>
  );
}

function RAG() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI 챗봇</h1>
      <p className="text-muted-foreground">AI 챗봇 페이지입니다.</p>
    </div>
  );
}

function PDFUpload() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">PDF 업로드</h1>
      <p className="text-muted-foreground">PDF 업로드 페이지입니다.</p>
    </div>
  );
}

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
