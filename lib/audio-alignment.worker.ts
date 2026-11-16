import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny';
import { alignAudio, analysisSeconds, AudioFingerprint, type AudioMatch } from './audio-alignment';
import { roles, type Role } from './model';

async function analyze(files: Record<Role, File>): Promise<AudioMatch> {
  const tracks = {
    ego: new AudioFingerprint(),
    left: new AudioFingerprint(),
    right: new AudioFingerprint(),
  };
  for (const role of roles) {
    const input = new Input({ source: new BlobSource(files[role]), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return { alignment: { method: 'unverified', reason: 'missing-audio' } };
      if (!await track.canDecode()) {
        return { alignment: { method: 'unverified', reason: 'decode-failed' } };
      }
      const sink = new AudioSampleSink(track);
      for await (const sample of sink.samples(0, analysisSeconds)) {
        try {
          const channels = Array.from({ length: sample.numberOfChannels }, (_, planeIndex) => {
            const data = new Float32Array(sample.numberOfFrames);
            sample.copyTo(data, { format: 'f32-planar', planeIndex });
            return data;
          });
          tracks[role].append(channels, sample.sampleRate, sample.timestamp);
        } finally {
          sample.close();
        }
      }
    } finally {
      input.dispose();
    }
  }
  return alignAudio(tracks);
}

self.onmessage = async ({ data }: MessageEvent<Record<Role, File>>) => {
  try {
    self.postMessage(await analyze(data));
  } catch {
    self.postMessage({ alignment: { method: 'unverified', reason: 'decode-failed' } } satisfies AudioMatch);
  }
};
