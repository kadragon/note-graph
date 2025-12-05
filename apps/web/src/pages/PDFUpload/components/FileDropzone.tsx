import { Card } from '@web/components/ui/card';
import { Upload } from 'lucide-react';
import { useCallback } from 'react';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFileSelect, disabled }: FileDropzoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        onFileSelect(file);
      }
    },
    [onFileSelect, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <Card
      className={`border-2 border-dashed p-12 text-center ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => !disabled && document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-4">
        <Upload className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="text-lg font-medium">PDF 파일을 업로드하세요</p>
          <p className="text-sm text-muted-foreground mt-1">
            파일을 드래그하거나 클릭하여 선택하세요 (최대 10MB)
          </p>
        </div>
      </div>
    </Card>
  );
}
