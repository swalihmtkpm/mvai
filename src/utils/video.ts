export const generateVideoThumbnail = (videoFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Thumbnail generation timed out'));
    }, 10000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      if (video.src) URL.revokeObjectURL(video.src);
    };

    video.onloadedmetadata = () => {
      // Seek to 10% or 1 second, whichever is smaller
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        cleanup();
        resolve(dataUrl);
      } else {
        cleanup();
        reject(new Error('Could not get canvas context'));
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Error loading video'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
};
