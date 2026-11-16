// @ts-check

/**
 * Visar en rundbild (equirektangulär, 2:1) på två sätt. Rundvisaren ritar
 * bilden som insidan av ett klot med WebGL, utan bibliotek. Reserven visar
 * bilden som en bred remsa som bara går att panorera i sidled.
 * @typedef {import('./lookDirection.js').LookDirection} LookDirection
 */

import { yawToStripOffsetPx } from './lookDirection.js';

/** Synfält i höjdled. Ska prövas på riktiga mobiler. */
export const FIELD_OF_VIEW_DEG = 75;

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
const float PI = 3.14159265358979;
void main() {
  vec3 ray = normalize(vec3(screen * halfSize, -1.0));
  ray = vec3(ray.x, ray.y * pitch.x - ray.z * pitch.y, ray.y * pitch.y + ray.z * pitch.x);
  ray = vec3(ray.x * yaw.x - ray.z * yaw.y, ray.y, ray.x * yaw.y + ray.z * yaw.x);
  float longitude = atan(ray.x, -ray.z);
  float latitude = asin(clamp(ray.y, -1.0, 1.0));
  gl_FragColor = texture2D(image, vec2(longitude / (2.0 * PI) + 0.5, 0.5 - latitude / PI));
}`;

/** @param {number} degrees */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * @param {WebGLRenderingContext} gl
 * @param {number} type
 * @param {string} source
 */
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Kunde inte skapa shadern');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shaderfel');
  return shader;
}

/** @param {WebGLRenderingContext} gl */
function buildProgram(gl) {
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
 * @param {HTMLCanvasElement} canvas
 */
export function createSphereView(canvas) {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;
  const program = buildProgram(gl);
  const uniforms = {
    halfSize: gl.getUniformLocation(program, 'halfSize'),
    yaw: gl.getUniformLocation(program, 'yaw'),
    pitch: gl.getUniformLocation(program, 'pitch'),
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
     * @param {HTMLImageElement} image
     * @returns {boolean} false om bilden är större än mobilen klarar
     */
    setImage(image) {
      const maxSidePx = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (image.naturalWidth > maxSidePx || image.naturalHeight > maxSidePx) return false;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      return true;
    },

    /** @param {LookDirection} look */
    draw(look) {
      matchCanvasToScreen();
      const halfHeight = Math.tan(toRadians(FIELD_OF_VIEW_DEG) / 2);
      gl.uniform2f(uniforms.halfSize, (halfHeight * canvas.width) / canvas.height, halfHeight);
      gl.uniform2f(uniforms.yaw, Math.cos(toRadians(look.yawDeg)), Math.sin(toRadians(look.yawDeg)));
      gl.uniform2f(uniforms.pitch, Math.cos(toRadians(look.pitchDeg)), Math.sin(toRadians(look.pitchDeg)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

/**
 * Reserven: bilden som en bred remsa som upprepas i sidled.
 * @param {HTMLElement} strip
 */
export function createStripView(strip) {
  let imageAspect = 2;
  strip.style.backgroundRepeat = 'repeat-x';
  strip.style.backgroundSize = `auto ${100 / STRIP_SHARE_OF_IMAGE_HEIGHT}%`;

  return {
    /** @param {HTMLImageElement} image */
    setImage(image) {
      imageAspect = image.naturalWidth / image.naturalHeight;
      strip.style.backgroundImage = `url("${image.src}")`;
    },

    /** @param {LookDirection} look */
    draw(look) {
      const imageWidthPx = (strip.clientHeight / STRIP_SHARE_OF_IMAGE_HEIGHT) * imageAspect;
      const offsetPx = yawToStripOffsetPx(look.yawDeg, { imageWidthPx, viewWidthPx: strip.clientWidth });
      strip.style.backgroundPosition = `${offsetPx}px 50%`;
    },
  };
}
