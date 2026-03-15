/**
 * Compress an image data URL to fit within Firestore's limits.
 * Keeps PNG format to preserve transparency. No white background.
 * Target: keep each logo under 500KB base64 string.
 */
export function compressImage(dataUrl, maxWidth = 200, maxHeight = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;

        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Clear canvas — transparent background preserved
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Always use PNG to keep transparency
        let result = canvas.toDataURL('image/png');

        // If PNG is too large, reduce dimensions further (still PNG, no JPEG)
        if (result.length > 500_000) {
          const smallerMax = Math.round(maxWidth * 0.6);
          const ratio2 = Math.min(smallerMax / img.width, smallerMax / img.height);
          const w2 = Math.max(Math.round(img.width * ratio2), 50);
          const h2 = Math.max(Math.round(img.height * ratio2), 50);
          canvas.width = w2;
          canvas.height = h2;
          ctx.clearRect(0, 0, w2, h2);
          ctx.drawImage(img, 0, 0, w2, h2);
          result = canvas.toDataURL('image/png');
        }

        // Last resort — even smaller
        if (result.length > 500_000) {
          const tinyMax = Math.round(maxWidth * 0.4);
          const ratio3 = Math.min(tinyMax / img.width, tinyMax / img.height);
          const w3 = Math.max(Math.round(img.width * ratio3), 32);
          const h3 = Math.max(Math.round(img.height * ratio3), 32);
          canvas.width = w3;
          canvas.height = h3;
          ctx.clearRect(0, 0, w3, h3);
          ctx.drawImage(img, 0, 0, w3, h3);
          result = canvas.toDataURL('image/png');
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

/**
 * Check if an image data URL is too large for Firestore and needs compression.
 */
export function needsCompression(dataUrl) {
  return dataUrl && dataUrl.length > 500_000;
}
