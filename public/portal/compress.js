// Achica un video en el navegador antes de subirlo (máx. 720p, bitrate según duración),
// así entran videos largos o en 4K en el límite de 50 MB por archivo.
// Se reproduce el video en un <canvas> y se graba con MediaRecorder: tarda lo
// mismo que dura el video y la pantalla tiene que quedar abierta.

const MAX_SIDE = 1280;            // 720p en vertical u horizontal
const MAX_BITRATE = 2_500_000;    // bits por segundo
const TARGET_BYTES = 40 * 1024 * 1024;

export const canCompress = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

function pickMime() {
  // H.264 en MP4 se ve en todos los celulares (iPhone incluido); después WebM.
  const options = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

export async function compressVideo(file, onProgress = () => {}) {
  if (!canCompress()) throw new Error('Este navegador no puede achicar videos. Grabá un video más corto o en 720p.');

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  // En algunos celulares el video tiene que estar en la página para reproducirse.
  Object.assign(video.style, { position: 'fixed', left: '-10px', top: '-10px', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none' });
  document.body.append(video);

  try {
    await new Promise((ok, fail) => {
      video.onloadedmetadata = ok;
      video.onerror = () => fail(new Error('No se pudo leer el video.'));
    });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('No se pudo leer la duración del video.');

    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((video.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((video.videoHeight * scale) / 2) * 2;
    const ctx = canvas.getContext('2d');

    const mimeType = pickMime();
    const bitrate = Math.max(600_000, Math.min(MAX_BITRATE, Math.floor((TARGET_BYTES * 8 * 0.9) / duration)));
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType, videoBitsPerSecond: bitrate });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((ok) => { recorder.onstop = ok; });

    let drawing = true;
    const draw = () => {
      if (!drawing) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(1, video.currentTime / duration));
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw);
      else requestAnimationFrame(draw);
    };

    const ended = new Promise((ok, fail) => {
      video.onended = ok;
      video.onerror = () => fail(new Error('Se cortó la lectura del video.'));
    });
    recorder.start(1000);
    await video.play();
    draw();
    await ended;
    drawing = false;
    recorder.stop();
    await stopped;
    onProgress(1);

    const type = (recorder.mimeType || mimeType || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    if (!blob.size) throw new Error('No se pudo achicar el video.');
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    return new File([blob], `serie.${ext}`, { type });
  } finally {
    video.pause();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
