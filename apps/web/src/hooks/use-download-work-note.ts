import { API } from '@web/lib/api';
import type { WorkNoteWithStats } from '@web/types/api';
import { useCallback, useState } from 'react';

import { useToast } from './use-toast';

/**
 * Trigger a file download from a blob
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Hook for downloading a work note as PDF along with its attachments
 */
export function useDownloadWorkNote() {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const downloadWorkNote = useCallback(
    async (workNote: WorkNoteWithStats) => {
      setIsDownloading(true);

      try {
        // 1. Fetch todos for this work note
        const todos = await API.getTodos('all', undefined, [workNote.id]);

        // 2. Dynamic-import PDF module (keeps ~200KB out of main bundle)
        let generateWorkNotePDF: Awaited<
          typeof import('@web/lib/pdf/generate-work-note-pdf')
        >['generateWorkNotePDF'];
        let generatePDFFilename: Awaited<
          typeof import('@web/lib/pdf/generate-work-note-pdf')
        >['generatePDFFilename'];
        try {
          ({ generateWorkNotePDF, generatePDFFilename } = await import(
            '@web/lib/pdf/generate-work-note-pdf'
          ));
        } catch (importError) {
          console.error('PDF 모듈 로드 실패:', importError);
          toast({
            variant: 'destructive',
            title: '오류',
            description: 'PDF 모듈을 불러오지 못했습니다. 페이지를 새로고침 후 다시 시도해주세요.',
          });
          return;
        }

        // 3. Generate and download PDF
        const pdfBlob = await generateWorkNotePDF(workNote, todos);
        const pdfFilename = generatePDFFilename(workNote);
        triggerDownload(pdfBlob, pdfFilename);

        // 4. Download attachments in parallel
        const files = workNote.files ?? [];
        if (files.length > 0) {
          const downloadPromises = files.map(async (file) => {
            if (file.storageType === 'GDRIVE' && file.gdriveWebViewLink) {
              window.open(file.gdriveWebViewLink, '_blank');
              return;
            }
            const fileBlob = await API.downloadWorkNoteFile(workNote.id, file.fileId);
            triggerDownload(fileBlob, file.originalName);
          });
          await Promise.all(downloadPromises);
        }

        // 5. Show success toast
        const fileCount = files.length;
        if (fileCount > 0) {
          const driveFileCount = files.filter(
            (file) => file.storageType === 'GDRIVE' && file.gdriveWebViewLink
          ).length;
          const downloadFileCount = fileCount - driveFileCount;
          const description =
            driveFileCount === 0
              ? `PDF와 첨부파일 ${downloadFileCount}개가 다운로드되었습니다.`
              : downloadFileCount === 0
                ? `PDF가 다운로드되고 첨부파일 ${driveFileCount}개가 열렸습니다.`
                : `PDF가 다운로드되고 첨부파일 ${downloadFileCount}개가 다운로드되었으며 Google Drive 첨부파일 ${driveFileCount}개가 열렸습니다.`;
          toast({
            title: '다운로드 완료',
            description,
          });
        } else {
          toast({
            title: '다운로드 완료',
            description: 'PDF가 다운로드되었습니다.',
          });
        }
      } catch (error) {
        console.error('PDF 다운로드 실패:', error);
        toast({
          variant: 'destructive',
          title: '오류',
          description: 'PDF 다운로드에 실패했습니다. 다시 시도해주세요.',
        });
      } finally {
        setIsDownloading(false);
      }
    },
    [toast]
  );

  return {
    downloadWorkNote,
    isDownloading,
  };
}
