// jsdom không có WebGL. Stub tối thiểu để THREE.WebGLRenderer khởi tạo được và R3F <Canvas> chạy trong test.
// Chỉ đủ cho test cấu trúc (scene graph); việc vẽ thật được kiểm tra bằng Playwright trong trình duyệt.
const CONSTANTS: Record<string, number> = {
  VERSION: 0x1f02,
  MAX_TEXTURE_SIZE: 0x0d33,
  MAX_VERTEX_ATTRIBS: 0x8869,
  MAX_TEXTURE_IMAGE_UNITS: 0x8872,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8b4c,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d,
  MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
  MAX_VARYING_VECTORS: 0x8dfc,
  MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb,
  MAX_FRAGMENT_UNIFORM_VECTORS: 0x8dfd,
  MAX_SAMPLES: 0x8d57,
  SHADING_LANGUAGE_VERSION: 0x8b8c,
  RENDERER: 0x1f01,
  VENDOR: 0x1f00,
};

export function createWebGLStub(): WebGL2RenderingContext {
  const params: Record<number, unknown> = {
    [CONSTANTS.VERSION]: 'WebGL 2.0 (stub)',
    [CONSTANTS.SHADING_LANGUAGE_VERSION]: 'WebGL GLSL ES 3.00 (stub)',
    [CONSTANTS.RENDERER]: 'stub',
    [CONSTANTS.VENDOR]: 'stub',
    [CONSTANTS.MAX_TEXTURE_SIZE]: 4096,
    [CONSTANTS.MAX_CUBE_MAP_TEXTURE_SIZE]: 4096,
    [CONSTANTS.MAX_SAMPLES]: 4,
  };
  const target: Record<string | symbol, unknown> = {
    canvas: document.createElement('canvas'),
    drawingBufferWidth: 300,
    drawingBufferHeight: 150,
    getContextAttributes: () => ({
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
    }),
    getParameter: (p: number) => (p in params ? params[p] : 16),
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    getExtension: () => null,
    getSupportedExtensions: () => [],
    checkFramebufferStatus: () => 0x8cd5,
    getProgramParameter: (_p: unknown, pname: number) => (pname === 0x8b82 ? true : 0),
    getShaderParameter: (_s: unknown, pname: number) => (pname === 0x8b81 ? true : 0),
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getError: () => 0,
    isContextLost: () => false,
    getUniformLocation: () => ({}),
    getAttribLocation: () => 0,
    getActiveAttrib: () => null,
    getActiveUniform: () => null,
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) return CONSTANTS[prop] ?? 0; // hằng số GL
      return () => ({}); // mọi lệnh GL khác là no-op
    },
  }) as unknown as WebGL2RenderingContext;
}

export function installWebGLStub() {
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    return type.startsWith('webgl') ? createWebGLStub() : null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // R3F chỉ dựng children khi khung có kích thước: giả lập 300x150 và ResizeObserver báo ngay khi observe
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 150,
      width: 300,
      height: 150,
      toJSON: () => ({}),
    }) as DOMRect;
  globalThis.ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      queueMicrotask(() => this.cb([], this as unknown as ResizeObserver));
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
