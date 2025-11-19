import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkNotes, useDeleteWorkNote } from '@/hooks/useWorkNotes';
import { WorkNotesTable } from './components/WorkNotesTable';
import { CreateWorkNoteDialog } from './components/CreateWorkNoteDialog';
import { ViewWorkNoteDialog } from './components/ViewWorkNoteDialog';
import type { WorkNote } from '@/types/api';

export default function WorkNotes() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedWorkNote, setSelectedWorkNote] = useState<WorkNote | null>(
    null
  );

  const { data: workNotes = [], isLoading } = useWorkNotes();
  const deleteMutation = useDeleteWorkNote();

  const handleView = (workNote: WorkNote) => {
    setSelectedWorkNote(workNote);
    setViewDialogOpen(true);
  };

  const handleDelete = async (workNoteId: string) => {
    if (confirm('정말 이 업무노트를 삭제하시겠습니까?')) {
      await deleteMutation.mutateAsync(workNoteId);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">업무노트</h1>
          <p className="text-gray-600 mt-1">업무노트를 관리하세요</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 업무노트
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무노트 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <WorkNotesTable
              workNotes={workNotes}
              onView={handleView}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      <CreateWorkNoteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <ViewWorkNoteDialog
        workNote={selectedWorkNote}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </div>
  );
}
