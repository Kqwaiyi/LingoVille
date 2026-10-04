import type { LiveAudio, LiveSocket, LiveSocketHandlers } from './liveSession.ts';
import type { OpenMic } from './voiceSession.ts';

// The browser edges of the Live session. Ported from the voice prototype; the
// protocol logic around them is in liveSession.ts and tested without a browser.

const MIC_RATE = 16_000;
const MIC_CONSTRAINTS: MediaStreamConstraints = { audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } };
/** How often the mic check reads the level: about as often as the worklet reports it. */
const MIC_CHECK_INTERVAL_MS = 100;
/** The mic level shown to the Player, from 0 to 1: the RMS loudness, scaled up so speech fills most of it. */
const MIC_LEVEL_GAIN = 4;
const NPC_RATE = 24_000;
/** ~100 ms of mic audio per message. */
const MIC_CHUNK_SAMPLES = 1_600;

/**
 * Runs on the audio thread: averages the mic down to 16 kHz, converts it to
 * 16-bit PCM and posts ~100 ms at a time with its loudness. Inline, so it
 * loads the same way in dev and in a build.
 */
const MIC_WORKLET = `
class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / ${MIC_RATE};
    this.out = new Int16Array(${MIC_CHUNK_SAMPLES});
    this.length = 0;
    this.sum = 0;
    this.count = 0;
    this.position = 0;
    this.energy = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i];
      this.count++;
      if (++this.position < this.step) continue;
      this.position -= this.step;
      const sample = Math.max(-1, Math.min(1, this.sum / this.count));
      this.sum = 0;
      this.count = 0;
      this.energy += sample * sample;
      this.out[this.length++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      if (this.length === this.out.length) {
        const level = Math.min(1, Math.sqrt(this.energy / this.length) * ${MIC_LEVEL_GAIN});
        this.port.postMessage({ pcm: this.out.buffer, level }, [this.out.buffer]);
        this.out = new Int16Array(${MIC_CHUNK_SAMPLES});
        this.length = 0;
        this.energy = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(data: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function createBrowserAudio(): LiveAudio {
  const context = new AudioContext();
  let mic: MediaStream | null = null;
  let closed = false;
  let nextStart = 0;
  const playing = new Set<AudioBufferSourceNode>();
  let drainWaiters: (() => void)[] = [];

  const notifyIfDrained = () => {
    if (playing.size > 0 && !closed) return;
    const waiters = drainWaiters;
    drainWaiters = [];
    for (const done of waiters) done();
  };

  return {
    startMic: async (onChunk) => {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      if (closed) return stream.getTracks().forEach((track) => track.stop());
      mic = stream;
      const moduleUrl = URL.createObjectURL(new Blob([MIC_WORKLET], { type: 'text/javascript' }));
      await context.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);
      if (closed) return;
      const capture = new AudioWorkletNode(context, 'mic-capture');
      capture.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => onChunk(toBase64(e.data.pcm), e.data.level);
      context.createMediaStreamSource(stream).connect(capture);
      await context.resume();
    },

    play: (data) => {
      if (closed) return;
      const samples = new Int16Array(fromBase64(data));
      const buffer = context.createBuffer(1, samples.length, NPC_RATE);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) channel[i] = samples[i]! / 0x8000;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      // Chunks play back to back; a gap only opens if the network falls behind.
      nextStart = Math.max(nextStart, context.currentTime);
      source.start(nextStart);
      nextStart += buffer.duration;
      playing.add(source);
      source.onended = () => {
        playing.delete(source);
        notifyIfDrained();
      };
      void context.resume();
    },

    stopPlayback: () => {
      for (const source of playing) {
        source.onended = null;
        source.stop();
      }
      playing.clear();
      nextStart = 0;
      notifyIfDrained();
    },

    drained: () =>
      new Promise<void>((resolve) => {
        drainWaiters.push(resolve);
        notifyIfDrained();
      }),

    close: () => {
      if (closed) return;
      closed = true;
      mic?.getTracks().forEach((track) => track.stop());
      playing.clear();
      notifyIfDrained();
      void context.close();
    },
  };
}

/** The browser's mic, for the mic check: its level on the same scale as a conversation's. */
export const openBrowserMic: OpenMic = async (onLevel) => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('this browser has no mic access');
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  const stopStream = () => stream.getTracks().forEach((track) => track.stop());
  let context: AudioContext;
  try {
    context = new AudioContext();
    const analyser = context.createAnalyser();
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
      onLevel(Math.min(1, Math.sqrt(energy / samples.length) * MIC_LEVEL_GAIN));
    }, MIC_CHECK_INTERVAL_MS);
    void context.resume();
    return () => {
      clearInterval(timer);
      stopStream();
      void context.close();
    };
  } catch (error) {
    // Opened but unusable: the mic is let go, or the browser would keep showing it as in use.
    stopStream();
    throw error;
  }
};

export function openBrowserSocket(url: string, handlers: LiveSocketHandlers): LiveSocket {
  const socket = new WebSocket(url);
  // Binary frames are decoded synchronously, so messages keep their order.
  socket.binaryType = 'arraybuffer';
  const decoder = new TextDecoder();
  socket.onopen = () => handlers.onOpen();
  socket.onmessage = (e: MessageEvent<string | ArrayBuffer>) =>
    handlers.onMessage(typeof e.data === 'string' ? e.data : decoder.decode(e.data));
  socket.onclose = (e) => handlers.onClose(e.code, e.reason);
  return {
    send: (text) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(text);
    },
    close: () => socket.close(1000),
  };
}
