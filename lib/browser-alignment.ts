import type { AudioMatch } from './audio-alignment';
import type { Role } from './model';

export function analyzeAudio(files: Record<Role, File>, signal: AbortSignal): Promise<AudioMatch> {
  const unavailable: AudioMatch = { alignment: { method: 'unverified', reason: 'decode-failed' } };
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    let worker: Worker;
    try {
      worker = new Worker(new URL('./audio-alignment.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(unavailable);
      return;
    }
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const finish = (result: AudioMatch) => {
      cleanup();
      resolve(result);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const timeout = setTimeout(() => finish(unavailable), 180_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<AudioMatch>) => finish(data);
    worker.onerror = event => {
      event.preventDefault();
      finish(unavailable);
    };
    worker.onmessageerror = () => finish(unavailable);
    try {
      worker.postMessage(files);
    } catch {
      finish(unavailable);
    }
  });
}
