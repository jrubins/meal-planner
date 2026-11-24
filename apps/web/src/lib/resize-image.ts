/** Longest side of an uploaded photo, in pixels: plenty for a phone or a laptop screen. */
const MAX_SIDE = 1600;

/**
 * Shrinks a photo to at most MAX_SIDE pixels and re-encodes it as JPEG, so uploads stay small
 * (a few hundred KB) and phone formats such as HEIC become something every browser shows.
 * Also applies the photo's EXIF orientation, since the canvas draws it upright.
 */
export async function resizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process images');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image'))),
      'image/jpeg',
      0.85,
    );
  });
}
