/**
 * Visar en rundbild (equirektangulär, 2:1) på två sätt. Rundvisaren ritar
 * bilden som insidan av ett klot med WebGL, utan bibliotek. Reserven visar
 * bilden som en bred remsa som bara går att panorera i sidled.
 */

import { fieldOfViewToHalfHeight, type LookDirection, lookToScreenPoint, screenPointToLook, stripLookToPoint, stripPointToLook, yawToStripOffsetPx } from './lookDirection.ts';

/** Remsan visar mitten av bilden, där en rundbild är minst förvrängd. */
const STRIP_SHARE_OF_IMAGE_HEIGHT = 0.5;

const VERTEX_SHADER = `
attribute vec2 corner;
varying vec2 screen;
void main() {
  screen = corner;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

// Varje bildpunkt på skärmen blir en riktning ut i rummet. Riktningen räknas
// om till longitud och latitud, som är bildens vågräta och lodräta led.
const FRAGMENT_SHADER = `
precision highp float;
varying vec2 screen;
uniform sampler2D image;
uniform vec2 halfSize;
uniform vec2 yaw;
uniform vec2 pitch;
uniform vec2 roll;
uniform float softness;
const float PI = 3.14159265358979;
void main() {
  vec2 point = screen * halfSize;
  point = vec2(point.x * roll.x + point.y * roll.y, point.y * roll.x - point.x * roll.y);
  // Mjukt perspektiv är stereografiskt: avståndet från mitten motsvarar
  // dubbla tangens för halva vinkeln, i stället för tangens för hela.
  float distance = length(point);
  float angle = 2.0 * atan(distance / 2.0);
  vec3 softRay = distance > 0.0 ? vec3(point / distance * sin(angle), -cos(angle)) : vec3(0.0, 0.0, -1.0);
  vec3 ray = mix(normalize(vec3(point, -1.0)), softRay, softness);
  ray = vec3(ray.x, ray.y * pitch.x - ray.z * pitch.y, ray.y * pitch.y + ray.z * pitch.x);
  ray = vec3(ray.x * yaw.x - ray.z * yaw.y, ray.y, ray.x * yaw.y + ray.z * yaw.x);
  float longitude = atan(ray.x, -ray.z);
  float latitude = asin(clamp(ray.y, -1.0, 1.0));
  gl_FragColor = texture2D(image, vec2(longitude / (2.0 * PI) + 0.5, 0.5 - latitude / PI));
}`;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Kunde inte skapa shadern');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shaderfel');
  return shader;
}

function buildProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error('Kunde inte skapa programmet');
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Länkfel');
  gl.useProgram(program);

  // En enda rektangel som täcker hela visaren. Allt arbete görs per bildpunkt.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  return program;
}

/**
 * Rundvisaren. Ger null om mobilen saknar WebGL, så att reserven kan ta över.
 */
export function createSphereView(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;
  const program = buildProgram(gl);
  const uniforms = {
    halfSize: gl.getUniformLocation(program, 'halfSize'),
    yaw: gl.getUniformLocation(program, 'yaw'),
    pitch: gl.getUniformLocation(program, 'pitch'),
    roll: gl.getUniformLocation(program, 'roll'),
    softness: gl.getUniformLocation(program, 'softness'),
  };

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  // WebGL 1 kan bara upprepa bilder vars sidor är tvåpotenser. Bilden låses
  // därför mot kanten, och skarven hamnar där longituden går från 180 till -180.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  function matchCanvasToScreen() {
    const widthPx = Math.round(canvas.clientWidth * devicePixelRatio);
    const heightPx = Math.round(canvas.clientHeight * devicePixelRatio);
    if (canvas.width === widthPx && canvas.height === heightPx) return;
    canvas.width = widthPx;
    canvas.height = heightPx;
    gl?.viewport(0, 0, widthPx, heightPx);
  }

  return {
    /**
     * @returns false om bilden är större än mobilen klarar
     */
    setImage(image: HTMLImageElement): boolean {
      const maxSidePx = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (image.naturalWidth > maxSidePx || image.naturalHeight > maxSidePx) return false;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      return true;
    },

    /**
     * @param lens synfält i höjdled och perspektiv
     */
    draw(look: LookDirection, { fieldOfViewDeg, perspective }: { fieldOfViewDeg: number; perspective: 'straight' | 'soft' }) {
      matchCanvasToScreen();
      const halfHeight = fieldOfViewToHalfHeight(fieldOfViewDeg, perspective);
      const rollDeg = look.rollDeg ?? 0;
      gl.uniform1f(uniforms.softness, perspective === 'soft' ? 1 : 0);
      gl.uniform2f(uniforms.roll, Math.cos(toRadians(rollDeg)), Math.sin(toRadians(rollDeg)));
      gl.uniform2f(uniforms.halfSize, (halfHeight * canvas.width) / canvas.height, halfHeight);
      gl.uniform2f(uniforms.yaw, Math.cos(toRadians(look.yawDeg)), Math.sin(toRadians(look.yawDeg)));
      gl.uniform2f(uniforms.pitch, Math.cos(toRadians(look.pitchDeg)), Math.sin(toRadians(look.pitchDeg)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    /**
     * Åt vilket håll en punkt på visaren pekar.
     * @param point i pixlar från visarens övre vänstra hörn
     */
    pointToLook(look: LookDirection, point: { xPx: number; yPx: number }, { fieldOfViewDeg, perspective }: { fieldOfViewDeg: number; perspective: 'straight' | 'soft' }): LookDirection {
      const [widthPx, heightPx] = [canvas.clientWidth, canvas.clientHeight];
      const screen = { x: (point.xPx / widthPx) * 2 - 1, y: 1 - (point.yPx / heightPx) * 2 };
      return screenPointToLook(look, screen, { aspect: widthPx / heightPx, fieldOfViewDeg, perspective });
    },

    /**
     * Var på visaren en riktning hamnar, i pixlar från dess övre vänstra
     * hörn, eller null om den ligger bakom spelaren.
     */
    lookToPoint(look: LookDirection, direction: LookDirection, { fieldOfViewDeg, perspective }: { fieldOfViewDeg: number; perspective: 'straight' | 'soft' }): { xPx: number; yPx: number } | null {
      const [widthPx, heightPx] = [canvas.clientWidth, canvas.clientHeight];
      // En dold visare har ingen storlek, och då finns ingen plats att rita på.
      if (widthPx === 0 || heightPx === 0) return null;
      const screen = lookToScreenPoint(look, direction, { aspect: widthPx / heightPx, fieldOfViewDeg, perspective });
      return screen && { xPx: ((screen.x + 1) / 2) * widthPx, yPx: ((1 - screen.y) / 2) * heightPx };
    },
  };
}

/**
 * Reserven: bilden som en bred remsa som upprepas i sidled.
 */
export function createStripView(strip: HTMLElement) {
  let imageAspect = 2;
  strip.style.backgroundRepeat = 'repeat-x';
  strip.style.backgroundSize = `auto ${100 / STRIP_SHARE_OF_IMAGE_HEIGHT}%`;

  return {
    setImage(image: HTMLImageElement) {
      imageAspect = image.naturalWidth / image.naturalHeight;
      strip.style.backgroundImage = `url("${image.src}")`;
    },

    draw(look: LookDirection) {
      const imageWidthPx = (strip.clientHeight / STRIP_SHARE_OF_IMAGE_HEIGHT) * imageAspect;
      const offsetPx = yawToStripOffsetPx(look.yawDeg, { imageWidthPx, viewWidthPx: strip.clientWidth });
      strip.style.backgroundPosition = `${offsetPx}px 50%`;
    },

    /** Åt vilket håll en punkt på remsan pekar, i pixlar från dess övre vänstra hörn. */
    pointToLook(look: LookDirection, point: { xPx: number; yPx: number }): LookDirection {
      const imageHeightPx = strip.clientHeight / STRIP_SHARE_OF_IMAGE_HEIGHT;
      return stripPointToLook(look.yawDeg, point, { imageWidthPx: imageHeightPx * imageAspect, imageHeightPx, viewWidthPx: strip.clientWidth, viewHeightPx: strip.clientHeight });
    },

    /** Var på remsan en riktning hamnar, i pixlar från dess övre vänstra hörn. */
    lookToPoint(look: LookDirection, direction: LookDirection): { xPx: number; yPx: number } {
      const imageHeightPx = strip.clientHeight / STRIP_SHARE_OF_IMAGE_HEIGHT;
      return stripLookToPoint(look.yawDeg, direction, { imageWidthPx: imageHeightPx * imageAspect, imageHeightPx, viewWidthPx: strip.clientWidth, viewHeightPx: strip.clientHeight });
    },
  };
}
