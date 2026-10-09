/**
 * src/app/core/file-picker.ts
 * Opens the system file chooser and returns the chosen files as a promise (an empty list when cancelled).
 */

/** Opens the file chooser for the given types; `multiple` lets the person pick several files. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise<File[]>(function open(resolve) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = function chosen() {
      resolve(Array.from(input.files ?? []));
    };
    input.oncancel = function cancelled() {
      resolve([]);
    };
    input.click();
  });
}

/** Opens the file chooser for a single file; resolves to null when the person cancels. */
export async function pickFile(accept: string): Promise<File | null> {
  const files = await pickFiles(accept, false);
  return files[0] ?? null;
}
