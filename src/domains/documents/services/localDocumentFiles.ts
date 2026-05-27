export interface LocalFilePayload {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileDataUrl: string;
}

export function readLocalFile(file: File): Promise<LocalFilePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read file payload.'));
        return;
      }
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        fileDataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file payload.'));
    reader.readAsDataURL(file);
  });
}

export function downloadDataUrl(fileName: string, fileDataUrl?: string) {
  if (!fileDataUrl) return false;
  const anchor = document.createElement('a');
  anchor.href = fileDataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export function openDataUrl(fileDataUrl?: string) {
  if (!fileDataUrl) return false;
  const opened = window.open();
  if (!opened) return false;
  opened.document.write(`<iframe src="${fileDataUrl}" title="Document preview" style="border:0;width:100%;height:100vh"></iframe>`);
  opened.document.close();
  return true;
}
