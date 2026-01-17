// Trace: plan.md Task 2.1
// Protocol handler utilities for notegraph:// URL generation

/**
 * Builds a notegraph:// URL for opening a local file via the protocol handler.
 *
 * @param localDrivePath - The base path to the local Google Drive folder
 * @param relativePath - The relative path from the Drive folder to the file
 * @returns A notegraph://open?path=... URL with the full path URL-encoded
 */
export function buildLocalFileUrl(localDrivePath: string, relativePath: string): string {
  const fullPath = `${localDrivePath}/${relativePath}`;
  return `notegraph://open?path=${encodeURIComponent(fullPath)}`;
}
