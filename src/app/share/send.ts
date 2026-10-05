// Sends a share card's image on, when the person asks: through the system's share sheet (on phones
// and inside the Android app), or as a downloaded file. The app itself uploads nothing.

export const fileName = (card: string) => `who-am-i-${card}.png`;

const png = (blob: Blob, name: string) => new File([blob], name, { type: 'image/png' });

/** Whether this browser can hand an image to the system's share sheet. */
export function canShareImages(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [png(new Blob(), 'probe.png')] });
  } catch {
    return false;
  }
}

/** Opens the share sheet with the image. Cancelling it is not a failure. */
export async function shareImage(blob: Blob, name: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share({ files: [png(blob, name)], title: 'Who Am I' });
    return 'shared';
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/** Saves the image as a downloaded file. */
export function saveImage(blob: Blob, name: string): void {
  const url = URL.createObjectURL(png(blob, name));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
