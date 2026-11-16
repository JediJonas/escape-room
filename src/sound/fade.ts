/**
 * Uttoning efter kurvan volym × kvar³. En linjär sänkning låter som att
 * ljudet är starkt länge och sedan tystnar tvärt.
 * @param volume nivån när uttoningen börjar
 * @param steps antal punkter i kurvan, minst 2
 * @returns från volume ner till 0
 */
export function buildFadeOutCurve(volume: number, steps: number): Float32Array {
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i += 1) {
    const remaining = 1 - i / (steps - 1);
    curve[i] = volume * remaining ** 3;
  }
  return curve;
}
