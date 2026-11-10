/**
 * Iluminación dinámica con WebGL2.
 *
 * El mundo (terreno, objetos, personas) se dibuja con Canvas 2D en una capa aparte; acá se
 * sube como textura y se compone con un mapa de luces calculado a baja resolución:
 * luz ambiente + sol/luna con sombra del terreno + luces puntuales que el terreno tapa.
 * También aplica la distorsión de las ondas de choque. Si no hay WebGL2, la vista sigue
 * funcionando con el camino Canvas 2D de siempre.
 */

export interface Light { x: number; y: number; r: number; i: number; col: [number, number, number] }
export interface Shock { x: number; y: number; r: number; k: number }
export interface LightEnv { ambient: [number, number, number]; sun: [number, number, number]; dir: [number, number] }
export interface Frame {
  world: HTMLCanvasElement;
  vw: number; vh: number;
  camX: number; camY: number; zoom: number;
  offX: number; offY: number;
  lights: Light[];
  shocks: Shock[];
  env: LightEnv;
}

export const MAX_LIGHTS = 16;
const MAX_SHOCKS = 4;
/** El mapa de luces se calcula a 1/LIGHT_DIV de los píxeles CSS: la luz es suave y no necesita más. */
const LIGHT_DIV = 3;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const LIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uMask;
uniform vec2 uView, uOff, uCam, uWorld, uSunDir;
uniform float uZoom;
uniform vec3 uAmbient, uSun;
uniform vec4 uL[${MAX_LIGHTS}];
uniform vec3 uLC[${MAX_LIGHTS}];
uniform int uN;
float solid(vec2 p) {
  vec2 uv = p / uWorld;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return min(1.0, texture(uMask, uv).r * 255.0);
}
void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y) * uView;
  vec2 p = (scr - uOff) / uZoom + uCam;
  // sol o luna: cuanto más terreno hay entre el punto y la luz, más sombra
  float occ = 0.0;
  for (int i = 1; i <= 12; i++) occ += solid(p + uSunDir * (float(i) * 6.0));
  vec3 col = uAmbient + uSun * exp(-occ * 0.42);
  float pl = 0.0;
  for (int k = 0; k < ${MAX_LIGHTS}; k++) {
    if (k >= uN) break;
    vec2 d = uL[k].xy - p;
    float dist = length(d);
    float a = 1.0 - dist / uL[k].z;
    if (a <= 0.0) continue;
    a *= a;
    float s = 0.0;
    for (int j = 1; j <= 8; j++) s += solid(p + d * (float(j) / 9.0));
    a *= exp(-s * dist / 9.0 / 38.0) * uL[k].w;
    col += uLC[k] * a;
    pl += a;
  }
  o = vec4(col * 0.5, min(1.0, pl * 0.5));
}`;

const COMP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex, uLight;
uniform vec2 uView;
uniform vec4 uS[${MAX_SHOCKS}];
uniform int uSN;
void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y) * uView;
  vec2 off = vec2(0.0);
  for (int k = 0; k < ${MAX_SHOCKS}; k++) {
    if (k >= uSN) break;
    vec2 d = scr - uS[k].xy;
    float dist = length(d) + 0.001;
    float w = uS[k].z * 0.22 + 6.0;
    float ring = exp(-pow((dist - uS[k].z) / w, 2.0));
    off += d / dist * ring * uS[k].w;
  }
  vec2 uv = vUv - vec2(off.x, -off.y) / uView;
  vec4 c = texture(uTex, uv);
  vec4 L = texture(uLight, uv);
  vec3 rgb = c.rgb * L.rgb * 2.0;
  // filo de luz: el borde de cada silueta que mira hacia una luz puntual se enciende
  vec2 e = 1.6 / uView;
  vec2 n = vec2(texture(uTex, uv - vec2(e.x, 0.0)).a - texture(uTex, uv + vec2(e.x, 0.0)).a,
                texture(uTex, uv - vec2(0.0, e.y)).a - texture(uTex, uv + vec2(0.0, e.y)).a);
  vec2 g = 9.0 / uView;
  vec2 gl = vec2(texture(uLight, uv + vec2(g.x, 0.0)).a - texture(uLight, uv - vec2(g.x, 0.0)).a,
                 texture(uLight, uv + vec2(0.0, g.y)).a - texture(uLight, uv - vec2(0.0, g.y)).a);
  float rim = clamp(dot(n, gl) * 26.0, 0.0, 1.0) * clamp(L.a * 5.0, 0.0, 1.0);
  vec3 lc = L.rgb / max(0.001, max(L.r, max(L.g, L.b)));
  rgb += lc * rim * 0.75 * c.a;
  o = vec4(min(rgb, vec3(c.a)), c.a);
}`;

export class Lighting {
  canvas: HTMLCanvasElement;
  ok = false;
  private gl!: WebGL2RenderingContext;
  private pL!: WebGLProgram;
  private pC!: WebGLProgram;
  private uL: Record<string, WebGLUniformLocation | null> = {};
  private uC: Record<string, WebGLUniformLocation | null> = {};
  private texWorld!: WebGLTexture;
  private texMask!: WebGLTexture;
  private texLight!: WebGLTexture;
  private fbo!: WebGLFramebuffer;
  private lw = 0;
  private lh = 0;
  private tw = 0;
  private th = 0;
  private mw = 1;
  private mh = 1;
  private bufL = new Float32Array(MAX_LIGHTS * 4);
  private bufC = new Float32Array(MAX_LIGHTS * 3);
  private bufS = new Float32Array(MAX_SHOCKS * 4);

  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return;
    this.gl = gl;
    try {
      this.pL = this.program(VERT, LIGHT_FRAG);
      this.pC = this.program(VERT, COMP_FRAG);
    } catch (err) {
      console.warn('[luces] sin WebGL2 utilizable:', err);
      return;
    }
    for (const n of ['uMask', 'uView', 'uOff', 'uCam', 'uWorld', 'uSunDir', 'uZoom', 'uAmbient', 'uSun', 'uL', 'uLC', 'uN']) this.uL[n] = gl.getUniformLocation(this.pL, n);
    for (const n of ['uTex', 'uLight', 'uView', 'uS', 'uSN']) this.uC[n] = gl.getUniformLocation(this.pC, n);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.pL, this.pC]) {
      const loc = gl.getAttribLocation(p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.texWorld = this.tex(gl.LINEAR);
    this.texMask = this.tex(gl.LINEAR);
    this.texLight = this.tex(gl.LINEAR);
    this.fbo = gl.createFramebuffer()!;
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ok = false;
    });
    this.ok = true;
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as [number, string][]) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }

  private tex(filter: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Tamaño en píxeles reales de la capa del mundo y en píxeles CSS de la vista. */
  resize(pw: number, ph: number, vw: number, vh: number): void {
    if (!this.ok) return;
    const gl = this.gl;
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.lw = Math.max(2, Math.ceil(vw / LIGHT_DIV));
    this.lh = Math.max(2, Math.ceil(vh / LIGHT_DIV));
    gl.bindTexture(gl.TEXTURE_2D, this.texLight);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.lw, this.lh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texLight, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.tw = this.th = 0;
  }

  /** Sube la máscara de solidez completa (al empezar la partida). */
  setMask(mask: Uint8Array, w: number, h: number): void {
    if (!this.ok) return;
    const gl = this.gl;
    this.mw = w;
    this.mh = h;
    gl.bindTexture(gl.TEXTURE_2D, this.texMask);
    this.unpack(false, 0, 0, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, mask);
  }

  /** Actualiza solo el rectángulo que cambió con un cráter. */
  patchMask(mask: Uint8Array, cx: number, cy: number, r: number): void {
    if (!this.ok) return;
    const gl = this.gl;
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const x1 = Math.min(this.mw, Math.ceil(cx + r + 2));
    const y1 = Math.min(this.mh, Math.ceil(cy + r + 2));
    if (x1 <= x0 || y1 <= y0) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texMask);
    this.unpack(false, this.mw, x0, y0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl.RED, gl.UNSIGNED_BYTE, mask);
    this.unpack(false, 0, 0, 0);
  }

  private unpack(flip: boolean, rowLen: number, skipX: number, skipY: number): void {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, flip);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, rowLen);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, skipX);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, skipY);
  }

  render(f: Frame): void {
    if (!this.ok) return;
    const gl = this.gl;
    // 1) mapa de luces a baja resolución
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.lw, this.lh);
    gl.useProgram(this.pL);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texMask);
    const u = this.uL;
    gl.uniform1i(u.uMask, 0);
    gl.uniform2f(u.uView, f.vw, f.vh);
    gl.uniform2f(u.uOff, f.offX, f.offY);
    gl.uniform2f(u.uCam, f.camX, f.camY);
    gl.uniform2f(u.uWorld, this.mw, this.mh);
    gl.uniform2f(u.uSunDir, f.env.dir[0], f.env.dir[1]);
    gl.uniform1f(u.uZoom, f.zoom);
    gl.uniform3fv(u.uAmbient, f.env.ambient);
    gl.uniform3fv(u.uSun, f.env.sun);
    const n = Math.min(MAX_LIGHTS, f.lights.length);
    for (let i = 0; i < n; i++) {
      const l = f.lights[i];
      this.bufL.set([l.x, l.y, l.r, l.i], i * 4);
      this.bufC.set(l.col, i * 3);
    }
    gl.uniform4fv(u.uL, this.bufL);
    gl.uniform3fv(u.uLC, this.bufC);
    gl.uniform1i(u.uN, n);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2) composición a resolución completa
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.pC);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texWorld);
    this.unpack(true, 0, 0, 0);
    if (this.tw !== f.world.width || this.th !== f.world.height) {
      this.tw = f.world.width;
      this.th = f.world.height;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f.world);
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.world);
    this.unpack(false, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texLight);
    const c = this.uC;
    gl.uniform1i(c.uTex, 0);
    gl.uniform1i(c.uLight, 1);
    gl.uniform2f(c.uView, f.vw, f.vh);
    const sn = Math.min(MAX_SHOCKS, f.shocks.length);
    for (let i = 0; i < sn; i++) {
      const s = f.shocks[i];
      this.bufS.set([s.x, s.y, s.r, s.k], i * 4);
    }
    gl.uniform4fv(c.uS, this.bufS);
    gl.uniform1i(c.uSN, sn);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
