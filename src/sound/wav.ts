/**
 * Testljuden räknas fram i webbläsaren, så att testsidan inte behöver några
 * ljudfiler. Uppdragens röster och ljud blir riktiga filer.
 */

export const SAMPLE_RATE_HZ = 22050;
const WAV_HEADER_BYTES = 44;
const MAX_INT16 = 32767;

/**
 * Packar ljud som en wav-fil (mono, 16 bitar).
 * @param samples värden mellan -1 och 1
 */
export function encodeWav(samples: Float32Array, sampleRateHz: number = SAMPLE_RATE_HZ): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  /** @param offset @param text */
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt-blockets längd
  view.setUint16(20, 1, true); // okomprimerat (PCM)
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true); // byte per sekund
  view.setUint16(32, 2, true); // byte per sampel
  view.setUint16(34, 16, true); // bitar per sampel
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(WAV_HEADER_BYTES + i * 2, Math.round(clamped * MAX_INT16), true);
  });
  return new Uint8Array(buffer);
}

/**
 * En klockton som klingar av: varje ton börjar med ett tydligt slag.
 */
export function synthesizeChime({ notesHz, noteMs, sampleRateHz = SAMPLE_RATE_HZ }: { notesHz: number[]; noteMs: number; sampleRateHz?: number }): Float32Array {
  const samplesPerNote = Math.round((noteMs / 1000) * sampleRateHz);
  const samples = new Float32Array(samplesPerNote * notesHz.length);
  const VOLUME = 0.6;
  const DECAY_PER_NOTE = 4; // tonen har klingat av till ungefär 2 % när nästa börjar
  notesHz.forEach((frequencyHz, noteIndex) => {
    for (let i = 0; i < samplesPerNote; i += 1) {
      const decay = Math.exp((-DECAY_PER_NOTE * i) / samplesPerNote);
      const wave = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRateHz);
      samples[noteIndex * samplesPerNote + i] = VOLUME * decay * wave;
    }
  });
  return samples;
}

/**
 * Tystnad, för att låsa upp ett ljudelement i ett tryck.
 */
export function synthesizeSilence(durationMs: number, sampleRateHz: number = SAMPLE_RATE_HZ): Float32Array {
  return new Float32Array(Math.round((durationMs / 1000) * sampleRateHz));
}
