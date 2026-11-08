/* ==========================================================================
   CodeVerse — script.js
   Three.js r128 + OrbitControls r128 + data.js

   الأجزاء (تُلصق بالترتيب في ملف واحد):
     3أ  الإعدادات والحالة وتحميل الخامات
     3ب  الخامات البرمجية البديلة
     3ج  الشيدرز والنجوم والأقمار الصناعية
     3د  مشهد الأرض (صفحة الهبوط)
     3هـ مشهد المجموعة الشمسية: الأجرام والأقمار والمدارات
     3و  المذنب والحزام والمجرة والتسميات والقائمة
     3ز  الكاميرا والتحديد ولوحة المعلومات
     3ح  الموسيقى والانتقال وحلقة الرسم والتشغيل
   ========================================================================== */
(function () {
  'use strict';

  /* ========================================================================
     0. دوال أساسية (تُعرَّف أولاً لأن فحوص البداية تستخدمها)
     ======================================================================== */
  function $(id) { return document.getElementById(id); }
  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }

  function showError(title, message) {
    setText('error-title', title);
    setText('error-message', message);
    const box = $('error-screen');
    if (box) box.hidden = false; else window.alert(title + '\n' + message);
    document.body.classList.remove('is-loading');
    const loader = $('loader');
    if (loader) loader.hidden = true;
  }

  /** يفحص data.js ويرجع قائمة بالمشاكل (فارغة = سليم). */
  function validateData(D) {
    const p = [];
    if (!D) return ['window.CODEVERSE_DATA غير معرّف'];
    if (!Array.isArray(D.bodies) || D.bodies.length < 9) {
      p.push('bodies يجب أن يحتوي 9 عناصر: الشمس ثم 8 كواكب');
    } else {
      if (D.bodies[0].id !== 'sun') p.push('العنصر الأول في bodies يجب أن يكون الشمس (id: sun)');
      D.bodies.forEach(function (b, i) {
        ['id', 'name', 'en', 'type', 'color', 'desc', 'radius', 'tex'].forEach(function (k) {
          if (b[k] === undefined) p.push('bodies[' + i + '] ينقصه الحقل ' + k);
        });
        if (!Array.isArray(b.stats)) p.push('bodies[' + i + '] ينقصه stats');
        if (!Array.isArray(b.facts)) p.push('bodies[' + i + '] ينقصه facts');
      });
    }
    if (!Array.isArray(D.moons)) {
      p.push('moons غير موجود');
    } else {
      D.moons.forEach(function (m, i) {
        ['id', 'parent', 'name', 'radius', 'orbit', 'speed', 'tex'].forEach(function (k) {
          if (m[k] === undefined) p.push('moons[' + i + '] ينقصه الحقل ' + k);
        });
      });
    }
    if (!Array.isArray(D.extras)) {
      p.push('extras غير موجود');
    } else {
      ['comet', 'belt', 'andromeda'].forEach(function (id) {
        if (!D.extras.some(function (e) { return e.id === id; })) p.push('extras ينقصه العنصر ' + id);
      });
    }
    return p;
  }

  /* ========================================================================
     1. فحوص الأمان
     ======================================================================== */
  if (window.__CODEVERSE_LIB_ERROR__) return;

  if (typeof THREE === 'undefined' || typeof THREE.OrbitControls === 'undefined') {
    showError('المكتبات غير محمّلة', 'لم يتم تحميل Three.js أو OrbitControls. تأكد من الاتصال بالإنترنت أو من وجود مجلد libs/.');
    return;
  }

  const DATA = window.CODEVERSE_DATA;
  const dataProblems = validateData(DATA);
  if (dataProblems.length) {
    console.error('[CodeVerse] مشاكل في data.js:', dataProblems);
    showError('بيانات data.js غير مكتملة', dataProblems.slice(0, 6).join('\n'));
    return;
  }

  const REQUIRED_IDS = [
    'loader', 'loader-bar', 'loader-text', 'error-screen', 'error-title', 'error-message', 'error-reload-btn',
    'texture-notice', 'texture-notice-text', 'texture-notice-close',
    'landing-page', 'landing-canvas', 'music-btn', 'music-btn-label', 'music-tip', 'enter-btn', 'enter-btn-label',
    'stat-planets', 'stat-moons', 'stat-stars',
    'solar-page', 'solar-canvas', 'labels-layer', 'home-btn', 'reset-btn', 'orbits-btn', 'labels-btn',
    'fullscreen-btn', 'solar-music-btn', 'volume-slider', 'speed-slider', 'speed-value', 'planet-nav', 'solar-hint',
    'info-panel', 'close-panel-btn', 'planet-swatch', 'planet-name', 'planet-name-en', 'planet-type',
    'planet-description', 'moon-section', 'moon-title', 'moon-list', 'planet-stats', 'planet-facts',
    'focus-btn', 'panel-reset-btn', 'transition-overlay', 'space-audio'
  ];
  const missingIds = REQUIRED_IDS.filter(function (id) { return !$(id); });
  if (missingIds.length) {
    console.error('[CodeVerse] عناصر ناقصة في index.html:', missingIds);
    showError('عناصر ناقصة في index.html', missingIds.join('، '));
    return;
  }

  /* ========================================================================
     2. الإعدادات
     ======================================================================== */
  const BODIES = DATA.bodies;          // [0] الشمس ثم 8 كواكب
  const MOONS = DATA.moons;
  const EX = {};
  DATA.extras.forEach(function (e) { EX[e.id] = e; });

  const TEXTURE_PATH = 'textures/';
  const REMOTE_BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/';

  // color:true  -> خامات تُعرض بمواد قياسية (تحتاج sRGB)
  // color:false -> خامات للشيدر أو القيم الخام
  // remote      -> بدائل اختيارية من الإنترنت إن غاب الملف المحلي
  const TEXTURE_DEFS = {
    sun:             { file: '2k_sun.jpg',               color: true },
    mercury:         { file: '2k_mercury.jpg',           color: true },
    venusSurface:    { file: '2k_venus_surface.jpg',     color: true },
    venusAtmosphere: { file: '2k_venus_atmosphere.jpg',  color: true },
    earthDay:        { file: '2k_earth_daymap.jpg',      color: false, remote: [REMOTE_BASE + 'earth_atmos_2048.jpg'] },
    earthClouds:     { file: '2k_earth_clouds.jpg',      color: false },
    earthNight:      { file: '2k_earth_nightmap.jpg',    color: false, remote: [REMOTE_BASE + 'earth_lights_2048.png'] },
    moon:            { file: '2k_moon.jpg',              color: true,  remote: [REMOTE_BASE + 'moon_1024.jpg'] },
    mars:            { file: '2k_mars.jpg',              color: true },
    jupiter:         { file: '2k_jupiter.jpg',           color: true },
    saturn:          { file: '2k_saturn.jpg',            color: true },
    saturnRing:      { file: '2k_saturn_ring_alpha.png', color: true },
    uranus:          { file: '2k_uranus.jpg',            color: true },
    neptune:         { file: '2k_neptune.jpg',           color: true },
    stars:           { file: '2k_stars.jpg',             color: true }
  };

  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    Math.min(window.screen.width, window.screen.height) < 600;
  const SPHERE_SEG = IS_MOBILE ? 40 : 72;
  const LANDING_STARS = IS_MOBILE ? 1800 : 3500;
  const SOLAR_STARS = IS_MOBILE ? 3000 : 6500;
  const BELT_COUNT = IS_MOBILE ? 450 : 1000;
  const GALAXY_STARS = IS_MOBILE ? 3500 : 7500;
  const MAX_PIXEL_RATIO = IS_MOBILE ? 1.5 : 2;
  const ENABLE_SHADOWS = !IS_MOBILE;
  const TAU = Math.PI * 2;
  const OVERVIEW_R = 128;              // نصف القطر الذي يجب أن يتسع في العرض الشامل

  /* ========================================================================
     3. دوال مساعدة وحالة التطبيق
     ======================================================================== */
  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const rand = function (a, b) { return a + Math.random() * (b - a); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const smooth = function (a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const deg = THREE.MathUtils.degToRad;

  const state = {
    mode: 'landing',       // 'landing' | 'solar'
    busy: false,           // أثناء الانتقال بين الصفحتين
    contextLost: false,
    selectedId: null,
    speed: 1,
    lastTime: 0
  };

  const landing = {
    canvas: $('landing-canvas'), renderer: null, scene: null, camera: null,
    w: 1, h: 1, active: true, ready: false,
    root: null, earth: null, clouds: null, atmos: null, stars: null, meteors: [],
    sunDir: new THREE.Vector3(0.85, 0.32, 0.55).normalize(),
    radius: 1.6, zoom: 0, zoomTarget: 0, intro: 0,
    dragging: false, lastX: 0, lastY: 0, spinVel: 0
  };

  const solar = {
    canvas: $('solar-canvas'), renderer: null, scene: null, camera: null, controls: null,
    w: 1, h: 1, active: false, ready: false,
    root: null, sky: null, stars: null, sunLight: null, sunGlow: [],
    pickables: [], orbitLines: [], moonLines: [], sats: [], meteors: [],
    comet: null, belt: null, galaxy: null,
    labelsOn: true, orbitsOn: true, labels: []
  };

  const ENT = {};        // id -> كيان قابل للتحديد (شمس، كوكب، قمر، مذنب...)
  const ENT_LIST = [];

  // كائنات مؤقتة تُعاد استخدامها (لا نُنشئ كائنات جديدة داخل حلقة الرسم)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const V1 = new THREE.Vector3();
  const V2 = new THREE.Vector3();
  const V3 = new THREE.Vector3();
  const V4 = new THREE.Vector3();

  const clock = new THREE.Clock();
  const textureCache = {};
  const moonTexCache = {};
  const missingTextures = [];
  let loadedCount = 0;
  let maxAniso = 4;

  // موارد مشتركة تُنشأ مرة واحدة (في الجزء 3ج)
  let SPHERE_GEO = null;
  let SPHERE_LOW = null;
  let CIRCLE_GEO = null;
  let GLOW_TEX = null;
  let DOT_TEX = null;
  let BLACK_TEX = null;

  /* ========================================================================
     4. تحميل الخامات (محلي ثم إنترنت ثم بديل برمجي)
     ======================================================================== */
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  function updateLoader(text) {
    const total = Object.keys(TEXTURE_DEFS).length;
    const pct = Math.round((loadedCount / total) * 90);
    $('loader-bar').style.width = pct + '%';
    if (text) setText('loader-text', text);
  }

  /** يحمّل صورة واحدة؛ يرجع الخامة أو null، ولا يرفض أبداً. */
  function loadImageTexture(url, def) {
    return new Promise(function (resolve) {
      let settled = false;
      const timer = setTimeout(function () {
        if (!settled) { settled = true; resolve(null); }
      }, 15000);
      try {
        textureLoader.load(
          url,
          function (tex) {
            if (settled) { tex.dispose(); return; }
            settled = true; clearTimeout(timer);
            if (def.color) tex.encoding = THREE.sRGBEncoding;
            tex.anisotropy = maxAniso;
            resolve(tex);
          },
          undefined,
          function () {
            if (settled) return;
            settled = true; clearTimeout(timer); resolve(null);
          }
        );
      } catch (e) {
        settled = true; clearTimeout(timer); resolve(null);
      }
    });
  }

  /** إن كانت صورة الحلقات بلا شفافية، يحوّل سطوعها إلى شفافية. */
  function ensureRingAlpha(tex) {
    try {
      const img = tex.image;
      const w = Math.min(img.width, 512), h = Math.min(img.height, 512);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h);
      const d = data.data;
      let minA = 255;
      for (let i = 3; i < d.length; i += 4) { if (d[i] < minA) minA = d[i]; }
      if (minA < 250) return tex;                       // فيها شفافية حقيقية
      for (let i = 0; i < d.length; i += 4) {
        d[i + 3] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        d[i] = 226; d[i + 1] = 208; d[i + 2] = 170;
      }
      g.putImageData(data, 0, 0);
      const t2 = new THREE.CanvasTexture(c);
      t2.encoding = THREE.sRGBEncoding;
      t2.anisotropy = maxAniso;
      tex.dispose();
      return t2;
    } catch (e) {
      return tex;
    }
  }

  async function loadTexture(key) {
    const def = TEXTURE_DEFS[key];
    let tex = await loadImageTexture(TEXTURE_PATH + def.file, def);
    if (!tex) {
      missingTextures.push(def.file);
      if (def.remote) {
        for (let i = 0; i < def.remote.length && !tex; i++) {
          tex = await loadImageTexture(def.remote[i], def);
        }
      }
    }
    if (tex && key === 'saturnRing') tex = ensureRingAlpha(tex);
    loadedCount++;
    textureCache[key] = tex || null;
    updateLoader();
    return tex || null;
  }

  function loadAllTextures() {
    return Promise.all(Object.keys(TEXTURE_DEFS).map(loadTexture));
  }

  function canvasToTexture(canvas, srgb) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(4, maxAniso);
    return t;
  }

  /** يرجع الخامة المحمّلة، أو بديلاً برمجياً، أو null (PROC يُعرَّف في الجزء 3ب). */
  function getTex(key) {
    if (textureCache[key]) return textureCache[key];
    const make = PROC[key];
    const canvas = make ? make() : null;
    const tex = canvas ? canvasToTexture(canvas, TEXTURE_DEFS[key].color) : null;
    textureCache[key] = tex;
    return tex;
  }

  /** ينبّه المستخدم إلى الخامات التي لم تُحمَّل من مجلد textures/. */
  function showTextureNotice() {
    if (!missingTextures.length) return;
    setText('texture-notice-text',
      'تعذّر تحميل ' + missingTextures.length + ' ملف من مجلد textures/ وتم استبدالها بخامات برمجية: ' +
      missingTextures.join('، ') + '. ضع الملفات بالأسماء نفسها لتظهر بالجودة الكاملة.');
    $('texture-notice').hidden = false;
  }

  /* ==== نهاية الجزء 3أ — الصق الجزء 3ب هنا مباشرة ==== */
    /* ========================================================================
     5. الخامات البرمجية البديلة (تُستخدم فقط إن غاب ملف الخامة)
     ======================================================================== */
  function hash3(ix, iy, iz) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    return lerp(
      lerp(lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
      w
    );
  }

  function fbm(x, y, z, oct) {
    let a = 0.5, s = 0, f = 1;
    for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return s;
  }

  function hexRGB(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixRGB(a, b, t, out) {
    out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t);
  }

  /** يرسم خريطة كروية (equirectangular)؛ الدالة تستلم نقطة على كرة الوحدة. */
  function paintSphere(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const d = img.data;
    const rgb = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      const lat = (0.5 - (y + 0.5) / h) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let x = 0; x < w; x++) {
        const lon = ((x + 0.5) / w) * TAU;
        fn(cl * Math.cos(lon), sl, cl * Math.sin(lon), lat, rgb);
        const i = (y * w + x) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function addCraters(canvas, count, rMin, rMax) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = h * 0.12 + Math.random() * h * 0.76;
      const r = rMin + Math.pow(Math.random(), 2.2) * (rMax - rMin);
      const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.30)');
      gr.addColorStop(0.72, 'rgba(0,0,0,0.12)');
      gr.addColorStop(0.88, 'rgba(255,255,255,0.20)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }

  const PROC = {
    sun: function () {
      const a = [190, 60, 0], b = [255, 150, 20], c2 = [255, 232, 140];
      return paintSphere(512, 256, function (x, y, z, lat, o) {
        const n = fbm(x * 3.2 + 4, y * 3.2, z * 3.2, 5), m = fbm(x * 9 + 2, y * 9, z * 9, 3);
        const t = clamp(n * 1.25 + m * 0.35, 0, 1);
        if (t < 0.55) mixRGB(a, b, t / 0.55, o); else mixRGB(b, c2, (t - 0.55) / 0.45, o);
      });
    },
    mercury: function () {
      const c = paintSphere(512, 256, function (x, y, z, lat, o) {
        const v = 95 + fbm(x * 3 + 2, y * 3, z * 3 + 5, 5) * 110;
        o[0] = v; o[1] = v * 0.97; o[2] = v * 0.93;
      });
      addCraters(c, 140, 2, 14);
      return c;
    },
    venusSurface: function () {
      return paintSphere(512, 256, function (x, y, z, lat, o) {
        mixRGB([150, 100, 50], [205, 150, 80], fbm(x * 3 + 1, y * 3, z * 3, 5), o);
      });
    },
    venusAtmosphere: function () {
      return paintSphere(512, 256, function (x, y, z, lat, o) {
        const w = fbm(x * 2 + 7, y * 4, z * 2, 3);
        const n = fbm(x * 2.5 + w * 2.2, y * 6 + w * 1.5, z * 2.5 + w * 2.2, 5);
        mixRGB([226, 190, 120], [252, 236, 190], clamp(n * 1.3 - 0.15, 0, 1), o);
      });
    },
    earthDay: function () {
      const deep = [10, 38, 92], shallow = [34, 112, 170], green = [58, 118, 56], olive = [118, 126, 64];
      const tan = [176, 154, 104], rock = [150, 140, 128], snow = [238, 244, 250], ice = [210, 225, 240];
      return paintSphere(1024, 512, function (x, y, z, lat, o) {
        const n = fbm(x * 1.7 + 3.1, y * 1.7 + 1.3, z * 1.7 + 7.7, 6);
        const absLat = Math.abs(lat) / (Math.PI / 2);
        const iceEdge = 0.9 + (fbm(x * 7, y * 7, z * 7, 2) - 0.4) * 0.12;
        if (absLat > iceEdge) { mixRGB(snow, ice, fbm(x * 9, y * 9, z * 9, 2), o); return; }
        if (n > 0.54) {
          const h = clamp((n - 0.54) / 0.22, 0, 1);
          const dry = smooth(0.18, 0.32, absLat) * (1 - smooth(0.45, 0.6, absLat)) * smooth(0.4, 0.6, fbm(x * 3 + 11, y * 3, z * 3, 3));
          mixRGB(green, olive, clamp(h * 1.2 + absLat * 0.6, 0, 1), o);
          mixRGB(o, tan, dry, o);
          mixRGB(o, rock, smooth(0.6, 0.9, h), o);
          if (absLat > 0.8) mixRGB(o, snow, smooth(0.8, 0.9, absLat), o);
        } else {
          mixRGB(shallow, deep, clamp((0.54 - n) / 0.2, 0, 1), o);
        }
      });
    },
    earthClouds: function () {
      return paintSphere(1024, 512, function (x, y, z, lat, o) {
        const w = fbm(x * 2 + 30, y * 2, z * 2, 3);
        const n = fbm(x * 2.6 + w * 1.4, y * 3.4 + w, z * 2.6 + w * 1.4, 6);
        const absLat = Math.abs(lat) / (Math.PI / 2);
        const v = 255 * clamp(smooth(0.46, 0.66, n) * (0.85 + 0.3 * smooth(0.55, 0.85, absLat)), 0, 1);
        o[0] = v; o[1] = v; o[2] = v;
      });
    },
    moon: function () {
      const c = paintSphere(512, 256, function (x, y, z, lat, o) {
        const n = fbm(x * 1.5 + 1, y * 1.5, z * 1.5 + 6, 5);
        mixRGB([172, 170, 166], [88, 88, 94], smooth(0.5, 0.58, n) * 0.9, o);
        const v = 0.9 + fbm(x * 8, y * 8, z * 8, 3) * 0.2;
        o[0] *= v; o[1] *= v; o[2] *= v;
      });
      addCraters(c, 200, 2, 12);
      return c;
    },
    mars: function () {
      const c = paintSphere(512, 256, function (x, y, z, lat, o) {
        const n = fbm(x * 2.2 + 8, y * 2.2, z * 2.2, 5);
        const dark = smooth(0.5, 0.62, fbm(x * 1.6 + 3, y * 1.6, z * 1.6, 4));
        mixRGB([188, 104, 60], [212, 140, 84], n, o);
        mixRGB(o, [92, 50, 40], dark * 0.75, o);
        const absLat = Math.abs(lat) / (Math.PI / 2);
        if (absLat > 0.9) mixRGB(o, [240, 242, 246], smooth(0.9, 0.95, absLat), o);
      });
      addCraters(c, 40, 2, 9);
      return c;
    },
    jupiter: function () {
      const c = paintSphere(512, 256, function (x, y, z, lat, o) {
        const turb = fbm(x * 3.5, y * 14, z * 3.5, 4);
        const band = Math.sin(lat * 13 + turb * 3.0) + Math.sin(lat * 31 + turb * 5) * 0.35;
        const t = clamp(0.5 + 0.4 * band, 0, 1);
        if (t < 0.5) mixRGB([138, 88, 58], [214, 170, 128], t * 2, o);
        else mixRGB([214, 170, 128], [240, 226, 198], (t - 0.5) * 2, o);
      });
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(176,72,44,0.9)';
      g.beginPath(); g.ellipse(c.width * 0.68, c.height * 0.6, 22, 12, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(236,200,170,0.5)'; g.lineWidth = 3; g.stroke();
      return c;
    },
    saturn: function () {
      return paintSphere(512, 256, function (x, y, z, lat, o) {
        const turb = fbm(x * 3, y * 10, z * 3, 3);
        const t = clamp(0.5 + 0.32 * (Math.sin(lat * 11 + turb * 1.6) + Math.sin(lat * 27 + turb * 3) * 0.3), 0, 1);
        if (t < 0.5) mixRGB([200, 170, 118], [222, 200, 150], t * 2, o);
        else mixRGB([222, 200, 150], [238, 222, 184], (t - 0.5) * 2, o);
      });
    },
    saturnRing: function () {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 8;
      const g = c.getContext('2d');
      for (let x = 0; x < 512; x++) {
        const t = x / 512;
        let a = 0.55 + 0.35 * Math.sin(t * 95) * Math.cos(t * 31);
        if (t > 0.58 && t < 0.63) a = 0.04;
        if (t < 0.1) a *= (t / 0.1) * 0.6;
        if (t > 0.94) a *= (1 - t) / 0.06;
        g.fillStyle = 'rgba(226,208,170,' + clamp(a, 0, 1).toFixed(3) + ')';
        g.fillRect(x, 0, 1, 8);
      }
      return c;
    },
    uranus: function () {
      return paintSphere(512, 256, function (x, y, z, lat, o) {
        const t = clamp(0.5 + 0.35 * Math.sin(lat * 8 + fbm(x * 2, y * 6, z * 2, 3) * 2), 0, 1);
        mixRGB([104, 190, 198], [150, 226, 228], t, o);
      });
    },
    neptune: function () {
      const c = paintSphere(512, 256, function (x, y, z, lat, o) {
        const turb = fbm(x * 3, y * 8, z * 3, 4);
        const t = clamp(0.5 + 0.4 * Math.sin(lat * 9 + turb * 3), 0, 1);
        mixRGB([36, 64, 176], [70, 110, 224], t, o);
      });
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(14,24,90,0.7)';
      g.beginPath(); g.ellipse(c.width * 0.4, c.height * 0.62, 18, 10, 0, 0, TAU); g.fill();
      return c;
    }
    // earthNight و stars: لا بديل برمجي عمداً
  };

  /** خامة برمجية صغيرة لقمر، تُبنى من الحقل tex في data.js. */
  function makeMoonTexture(def) {
    if (moonTexCache[def.id]) return moonTexCache[def.id];
    const t = def.tex || { mode: 'rock', base: '#888888', alt: '#aaaaaa', craters: 20 };
    const A = hexRGB(t.base), B = hexRGB(t.alt || t.base), sc = t.scale || 2.4;
    const crack = [150, 104, 72], dark = [58, 40, 30], orange = [222, 128, 40];
    const c = paintSphere(256, 128, function (x, y, z, lat, o) {
      const n = fbm(x * sc + 5, y * sc + 2, z * sc + 9, 5);
      let k = smooth(0.34, 0.66, n);
      if (t.mode === 'twotone') k = smooth(-0.15, 0.15, x + (n - 0.5) * 0.35);
      mixRGB(A, B, k, o);
      if (t.mode === 'volcanic') {
        mixRGB(o, orange, smooth(0.5, 0.7, fbm(x * 7 + 1, y * 7, z * 7, 3)) * 0.7, o);
        mixRGB(o, dark, smooth(0.72, 0.8, fbm(x * 11 + 4, y * 11, z * 11, 2)), o);
      } else if (t.mode === 'cracks') {
        const r = 1 - Math.abs(2 * fbm(x * 4 + 2, y * 4, z * 4 + 8, 4) - 1);
        mixRGB(o, crack, smooth(0.9, 0.97, r) * 0.9, o);
      } else if (t.mode === 'haze') {
        const f = 0.94 + fbm(x * 3, y * 3, z * 3, 3) * 0.1;
        o[0] *= f; o[1] *= f; o[2] *= f;
      }
    });
    if (t.craters) addCraters(c, t.craters, 1.5, 6);
    const tex = canvasToTexture(c, true);
    moonTexCache[def.id] = tex;
    return tex;
  }

  /* ========================================================================
     6. الشيدرز والموارد المشتركة
     ======================================================================== */
  const OVERVIEW_DIR = new THREE.Vector3(0, Math.sin(deg(30)), Math.cos(deg(30)));
  const INTRO_POS = new THREE.Vector3(0, 22, 62);
  const SAT = { mat: null, geo: null };
  let SPHERE_MID = null;
  const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const ORBIT_MAT = new THREE.LineBasicMaterial({ color: 0x7fa0ff, transparent: true, opacity: 0.26, depthWrite: false });
  const MOON_ORBIT_MAT = new THREE.LineBasicMaterial({ color: 0xa7b8ff, transparent: true, opacity: 0.16, depthWrite: false });

  function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.9; }

  const EARTH_VERT = [
    'varying vec2 vUv;',
    'varying vec3 vNormalW;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vUv = uv;',
    '  vNormalW = normalize(mat3(modelMatrix) * normal);',
    '  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  const EARTH_FRAG = [
    'uniform sampler2D uDay;',
    'uniform sampler2D uNight;',
    'uniform vec3 uSunDir;',
    'uniform float uHasNight;',
    'varying vec2 vUv;',
    'varying vec3 vNormalW;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec3 n = normalize(vNormalW);',
    '  vec3 L = normalize(uSunDir);',
    '  float d = dot(n, L);',
    '  float dayAmt = smoothstep(-0.10, 0.25, d);',
    '  vec3 day = texture2D(uDay, vUv).rgb;',
    '  vec3 night = texture2D(uNight, vUv).rgb;',
    '  vec3 lit = day * (0.05 + 1.05 * max(d, 0.0));',
    '  float twi = smoothstep(0.0, 0.18, d) * (1.0 - smoothstep(0.18, 0.45, d));',
    '  lit += vec3(0.22, 0.09, 0.02) * twi * 0.5;',
    '  float ocean = clamp((day.b - max(day.r, day.g)) * 3.0, 0.0, 1.0);',
    '  vec3 V = normalize(cameraPosition - vWorldPos);',
    '  vec3 H = normalize(L + V);',
    '  float spec = pow(max(dot(n, H), 0.0), 70.0) * ocean * 0.6;',
    '  lit += vec3(1.0, 0.95, 0.85) * spec * smoothstep(0.0, 0.2, d);',
    '  vec3 dark = day * 0.035 + night * vec3(1.0, 0.82, 0.5) * 1.35 * uHasNight;',
    '  gl_FragColor = vec4(mix(dark, lit, dayAmt), 1.0);',
    '}'
  ].join('\n');

  const ATMOS_VERT = [
    'varying vec3 vN;',
    'void main() {',
    '  vN = normalize(normalMatrix * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  const ATMOS_FRAG = [
    'uniform vec3 uColor;',
    'uniform float uC;',
    'uniform float uP;',
    'uniform float uI;',
    'varying vec3 vN;',
    'void main() {',
    '  float inten = pow(max(uC - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), uP) * uI;',
    '  gl_FragColor = vec4(uColor * min(inten, 1.0), 1.0);',
    '}'
  ].join('\n');

  function createEarthMaterial(sunDirVec) {
    const night = getTex('earthNight');
    return new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: getTex('earthDay') },
        uNight: { value: night || BLACK_TEX },
        uSunDir: { value: sunDirVec.clone() },
        uHasNight: { value: night ? 1.0 : 0.0 }
      },
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG
    });
  }

  function createAtmosphereMaterial(color, intensity) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uC: { value: 0.55 }, uP: { value: 4.0 }, uI: { value: intensity }
      },
      vertexShader: ATMOS_VERT,
      fragmentShader: ATMOS_FRAG,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
  }

  /** دائرة وحدة في المستوى XZ، تُستخدم للمدارات بعد تكبيرها. */
  function createCircleGeometry(segments) {
    const pts = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU;
      pts[i * 3] = Math.cos(a);
      pts[i * 3 + 1] = 0;
      pts[i * 3 + 2] = -Math.sin(a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }

  function createStars(count, rMin, rMax, size) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * TAU;
      const s = Math.sqrt(1 - u * u);
      const r = rand(rMin, rMax);
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(th);
      const k = Math.random();
      const b = rand(0.55, 1);
      if (k < 0.6) c.setRGB(b * 0.85, b * 0.92, b);
      else if (k < 0.85) c.setRGB(b, b, b * 0.92);
      else c.setRGB(b, b * 0.8, b * 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: size, map: DOT_TEX, vertexColors: true, transparent: true,
      depthWrite: false, sizeAttenuation: true, alphaTest: 0.01
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  function createGlowSprite(color, scale, opacity) {
    const mat = new THREE.SpriteMaterial({
      map: GLOW_TEX, color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    return s;
  }

  function makeGlowTexture(stops) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    stops.forEach(function (st) { gr.addColorStop(st[0], st[1]); });
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /** حلقة بإحداثيات UV شعاعية ليعمل معها شريط خامة أحادي البعد. */
  function createRingGeometry(inner, outer, vertical) {
    const geo = new THREE.RingGeometry(inner, outer, 128, 1);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const t = (Math.sqrt(x * x + y * y) - inner) / (outer - inner);
      if (vertical) uv.setXY(i, 0.5, t); else uv.setXY(i, t, 0.5);
    }
    uv.needsUpdate = true;
    return geo;
  }

  function initSharedAssets() {
    SPHERE_GEO = new THREE.SphereGeometry(1, SPHERE_SEG, Math.round(SPHERE_SEG * 0.75));
    SPHERE_MID = new THREE.SphereGeometry(1, 32, 24);
    SPHERE_LOW = new THREE.SphereGeometry(1, 16, 12);
    CIRCLE_GEO = createCircleGeometry(192);
    GLOW_TEX = makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.65)'], [0.45, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
    DOT_TEX = makeGlowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
    BLACK_TEX = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    BLACK_TEX.needsUpdate = true;
    buildSatelliteAssets();
  }

  function createRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    r.setClearColor(0x02030a, 1);
    r.outputEncoding = THREE.sRGBEncoding;
    return r;
  }

  function watchContext(canvas) {
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      state.contextLost = true;
      setText('texture-notice-text', 'توقف عرض WebGL مؤقتاً، وتجري محاولة استعادته...');
      $('texture-notice').hidden = false;
    });
    canvas.addEventListener('webglcontextrestored', function () {
      state.contextLost = false;
      $('texture-notice').hidden = true;
    });
  }

  /* ---------- الشهب ---------- */
  function createMeteors(scene, count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      scene.add(line);
      list.push({ line: line, vel: new THREE.Vector3(), life: 0, max: 1, delay: rand(0.5, 5) });
    }
    return list;
  }

  function resetMeteor(mt, range, speed, len) {
    mt.line.position.set(rand(-range, range), rand(range * 0.1, range * 0.8), rand(-range, range * 0.3));
    mt.vel.set(-rand(0.7, 1), -rand(0.15, 0.5), rand(-0.2, 0.2)).normalize().multiplyScalar(speed);
    const a = mt.line.geometry.attributes.position;
    V4.copy(mt.vel).normalize().multiplyScalar(-len);
    a.setXYZ(0, 0, 0, 0);
    a.setXYZ(1, V4.x, V4.y, V4.z);
    a.needsUpdate = true;
    mt.life = 0;
    mt.max = rand(0.8, 1.5);
  }

  function updateMeteors(list, dt, range, speed, len) {
    for (let i = 0; i < list.length; i++) {
      const mt = list[i];
      if (mt.delay > 0) {
        mt.delay -= dt;
        mt.line.material.opacity = 0;
        if (mt.delay > 0) continue;
        resetMeteor(mt, range, speed, len);
      }
      mt.life += dt;
      const k = mt.life / mt.max;
      if (k >= 1) { mt.delay = rand(2, 8); mt.line.material.opacity = 0; continue; }
      mt.line.position.addScaledVector(mt.vel, dt);
      mt.line.material.opacity = Math.sin(k * Math.PI) * 0.9;
    }
  }

  /* ========================================================================
     7. الأقمار الصناعية (مفصّلة، لا مكعبات)
     ======================================================================== */
  const SAT_ORBITS = [
    { r: 2.55, incX: 0.0,  incZ: 0.0,  speed: 1.15, phase: 0.0, variant: 0, scale: 0.26 },
    { r: 2.85, incX: 0.9,  incZ: 0.3,  speed: 0.95, phase: 2.1, variant: 1, scale: 0.25 },
    { r: 3.15, incX: -0.7, incZ: -0.4, speed: 0.78, phase: 4.0, variant: 2, scale: 0.23 },
    { r: 2.7,  incX: 1.45, incZ: 0.1,  speed: 1.05, phase: 1.0, variant: 1, scale: 0.25 },
    { r: 3.0,  incX: 0.35, incZ: -1.0, speed: 0.85, phase: 5.2, variant: 0, scale: 0.26 },
    { r: 3.35, incX: -1.2, incZ: 0.6,  speed: 0.70, phase: 3.1, variant: 2, scale: 0.22 }
  ];

  function buildSatelliteAssets() {
    SAT.mat = {
      body:  new THREE.MeshStandardMaterial({ color: 0xcfd5e0, metalness: 0.45, roughness: 0.4 }),
      foil:  new THREE.MeshStandardMaterial({ color: 0xd4a53c, metalness: 0.55, roughness: 0.32 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x16347f, metalness: 0.35, roughness: 0.3, emissive: 0x081a4d, emissiveIntensity: 0.55 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 0.5, roughness: 0.45 }),
      dark:  new THREE.MeshStandardMaterial({ color: 0x23272f, metalness: 0.3, roughness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf0f3f8, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }),
      lens:  new THREE.MeshStandardMaterial({ color: 0x0a1118, metalness: 0.8, roughness: 0.15, emissive: 0x0b2a44, emissiveIntensity: 0.6 })
    };
    SAT.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
      cone: new THREE.ConeGeometry(1, 1, 12),
      dish: new THREE.SphereGeometry(1, 20, 8, 0, TAU, 0, 0.95)
    };
  }

  function part(parent, geo, mat, px, py, pz, sx, sy, sz, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.scale.set(sx, sy, sz);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }

  /** جناح ألواح شمسية مقسّم إلى مقاطع، على محور X. */
  function panelWing(parent, side, segs, len, wid, startX) {
    const segLen = len / segs;
    part(parent, SAT.geo.cyl, SAT.mat.frame, side * (startX + len / 2), 0, 0, 0.02, len + 0.04, 0.02, 0, 0, Math.PI / 2);
    for (let i = 0; i < segs; i++) {
      const cx = side * (startX + (i + 0.5) * segLen);
      part(parent, SAT.geo.box, SAT.mat.frame, cx, 0, 0, segLen - 0.012, 0.014, wid + 0.05);
      part(parent, SAT.geo.box, SAT.mat.panel, cx, 0.004, 0, segLen - 0.045, 0.016, wid - 0.02);
    }
  }

  function createSatellite(variant, scale) {
    const g = new THREE.Group();
    if (variant === 0) {
      // قمر اتصالات: جسم معدني + شريط ذهبي + جناحان + صحن + هوائيات
      part(g, SAT.geo.box, SAT.mat.body, 0, 0, 0, 0.5, 0.42, 0.62);
      part(g, SAT.geo.box, SAT.mat.foil, 0, -0.05, 0, 0.52, 0.2, 0.64);
      panelWing(g, 1, 4, 1.2, 0.62, 0.25);
      panelWing(g, -1, 4, 1.2, 0.62, 0.25);
      part(g, SAT.geo.cyl, SAT.mat.frame, 0, 0.3, 0.1, 0.018, 0.28, 0.018);
      part(g, SAT.geo.dish, SAT.mat.white, 0, 0.5, 0.1, 0.2, 0.2, 0.2, Math.PI - 0.5, 0, 0);
      part(g, SAT.geo.cyl, SAT.mat.frame, 0, 0.58, 0.14, 0.01, 0.14, 0.01);
      part(g, SAT.geo.cyl, SAT.mat.frame, -0.15, 0.4, -0.1, 0.006, 0.55, 0.006);
      part(g, SAT.geo.box, SAT.mat.dark, 0.15, 0.23, 0.1, 0.16, 0.05, 0.2);
      part(g, SAT.geo.box, SAT.mat.white, -0.12, -0.24, 0.1, 0.18, 0.05, 0.14);
      part(g, SAT.geo.cone, SAT.mat.dark, 0.12, 0, -0.36, 0.06, 0.1, 0.06, -Math.PI / 2, 0, 0);
      part(g, SAT.geo.cone, SAT.mat.dark, -0.12, 0, -0.36, 0.06, 0.1, 0.06, -Math.PI / 2, 0, 0);
      part(g, SAT.geo.cyl, SAT.mat.lens, 0, 0, 0.33, 0.07, 0.06, 0.07, Math.PI / 2, 0, 0);
    } else if (variant === 1) {
      // قمر رصد: جسم أسطواني + عدسة + ظلة + جناحان
      part(g, SAT.geo.cyl, SAT.mat.foil, 0, 0, 0, 0.23, 0.9, 0.23, Math.PI / 2, 0, 0);
      part(g, SAT.geo.cyl, SAT.mat.dark, 0, 0, -0.46, 0.25, 0.05, 0.25, Math.PI / 2, 0, 0);
      part(g, SAT.geo.cyl, SAT.mat.lens, 0, 0, 0.46, 0.17, 0.04, 0.17, Math.PI / 2, 0, 0);
      part(g, SAT.geo.cyl, SAT.mat.white, 0, 0, 0.58, 0.21, 0.2, 0.21, Math.PI / 2, 0, 0);
      panelWing(g, 1, 5, 1.0, 0.5, 0.22);
      panelWing(g, -1, 5, 1.0, 0.5, 0.22);
      part(g, SAT.geo.cyl, SAT.mat.frame, 0, 0.3, -0.35, 0.012, 0.5, 0.012);
      part(g, SAT.geo.box, SAT.mat.dark, 0, 0.57, -0.35, 0.1, 0.06, 0.1);
      part(g, SAT.geo.box, SAT.mat.white, 0, -0.2, -0.1, 0.16, 0.08, 0.2);
      part(g, SAT.geo.cone, SAT.mat.dark, 0, 0, -0.52, 0.07, 0.12, 0.07, -Math.PI / 2, 0, 0);
    } else {
      // قمر/محطة: جسر مركزي + وحدات + أجنحة مزدوجة + مشعّات
      part(g, SAT.geo.box, SAT.mat.frame, 0, 0, 0, 1.7, 0.08, 0.08);
      part(g, SAT.geo.cyl, SAT.mat.white, 0, 0, 0, 0.17, 0.6, 0.17, Math.PI / 2, 0, 0);
      part(g, SAT.geo.cyl, SAT.mat.white, 0.32, 0, 0, 0.13, 0.4, 0.13);
      part(g, SAT.geo.cyl, SAT.mat.body, -0.32, 0, 0, 0.12, 0.34, 0.12);
      part(g, SAT.geo.box, SAT.mat.dark, 0, 0.12, 0.32, 0.18, 0.1, 0.12);
      part(g, SAT.geo.box, SAT.mat.white, 0, 0.36, 0, 0.5, 0.012, 0.25);
      const w1 = new THREE.Group(); w1.position.z = 0.4; g.add(w1);
      const w2 = new THREE.Group(); w2.position.z = -0.4; g.add(w2);
      panelWing(w1, 1, 3, 0.7, 0.42, 0.5);
      panelWing(w1, -1, 3, 0.7, 0.42, 0.5);
      panelWing(w2, 1, 3, 0.7, 0.42, 0.5);
      panelWing(w2, -1, 3, 0.7, 0.42, 0.5);
      part(g, SAT.geo.cyl, SAT.mat.frame, 0.25, 0.3, 0, 0.008, 0.5, 0.008);
      part(g, SAT.geo.dish, SAT.mat.white, 0.25, 0.58, 0, 0.12, 0.12, 0.12, Math.PI - 0.4, 0, 0);
    }
    g.scale.setScalar(scale);
    return g;
  }

  /* ========================================================================
     8. مشهد الأرض (صفحة الهبوط)
     ======================================================================== */
  function buildLanding() {
    const L = landing, R = L.radius;
    L.scene = new THREE.Scene();
    L.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);
    L.root = new THREE.Group();
    L.scene.add(L.root);
    L.tilt = new THREE.Group();
    L.tilt.rotation.z = deg(23.4);
    L.root.add(L.tilt);
    L.spin = 2.2; L.cloudOff = 0; L.enter = 0; L.dist = 9; L.offX = 0; L.offY = 0; L.lastT = 0;

    const sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
    sun.position.copy(L.sunDir).multiplyScalar(50);
    L.scene.add(sun);
    L.scene.add(new THREE.AmbientLight(0x18233f, 0.7));

    L.earth = new THREE.Mesh(SPHERE_GEO, createEarthMaterial(L.sunDir));
    L.earth.scale.setScalar(R);
    L.tilt.add(L.earth);

    L.clouds = new THREE.Mesh(SPHERE_GEO, new THREE.MeshLambertMaterial({
      color: 0xffffff, alphaMap: getTex('earthClouds'), transparent: true, opacity: 0.9, depthWrite: false
    }));
    L.clouds.scale.setScalar(R * 1.012);
    L.tilt.add(L.clouds);

    L.atmos = new THREE.Mesh(SPHERE_GEO, createAtmosphereMaterial(0x4f9bff, 1.35));
    L.atmos.scale.setScalar(R * 1.15);
    L.root.add(L.atmos);

    L.stars = createStars(LANDING_STARS, 120, 320, 0.35);
    L.scene.add(L.stars);

    [[0x5b3df0, 150, 0.16, -60, 25, -140], [0x1c6bff, 190, 0.11, 70, -30, -170], [0xb03cff, 120, 0.08, 20, 60, -120]].forEach(function (n) {
      const s = createGlowSprite(n[0], n[1], n[2]);
      s.position.set(n[3], n[4], n[5]);
      L.scene.add(s);
    });

    L.meteors = createMeteors(L.scene, 4);
    watchContext(L.canvas);
    bindLandingEvents();
    resizeLanding();
  }

  function resizeLanding() {
    const L = landing;
    if (!L.renderer || !L.camera) return;
    L.w = Math.max(1, L.canvas.clientWidth);
    L.h = Math.max(1, L.canvas.clientHeight);
    L.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    L.renderer.setSize(L.w, L.h, false);
    L.camera.aspect = L.w / L.h;
    L.camera.updateProjectionMatrix();
    layoutLanding();
  }

  /** يحدد بعد الكاميرا وموضع الأرض: يسار الشاشة على الشاشات العريضة، وأعلاها على الجوال. */
  function layoutLanding() {
    const L = landing;
    if (!L.camera) return;
    const aspect = L.w / L.h;
    const tanV = Math.tan(deg(L.camera.fov / 2));
    const R = L.radius;
    const wide = aspect > 1.1;
    const halfH = wide ? R / 0.6 : Math.max(R / 0.33, (R / 0.82) / aspect);
    L.dist = halfH / tanV;
    L.offX = wide ? -0.36 * halfH * aspect : 0;
    L.offY = wide ? 0 : 0.38 * halfH;
  }

  function applyLandingCamera() {
    const L = landing, e = L.enter;
    const introE = 1 - Math.pow(1 - L.intro, 3);
    const z = L.dist * lerp(1.5, 1, introE) * lerp(1, 0.74, L.zoom) * lerp(1, 0.45, e);
    L.camera.position.set(0, 0, z);
    L.root.position.set(L.offX * (1 - e), L.offY * (1 - e), 0);
  }

  function updateLanding(dt) {
    const L = landing;
    L.intro = Math.min(1, L.intro + dt / 3.4);
    L.zoom += (L.zoomTarget - L.zoom) * Math.min(1, dt * 4);
    if (!L.dragging) {
      L.spinVel += (0.06 - L.spinVel) * Math.min(1, dt * 1.2);
      L.spin += L.spinVel * dt;
    }
    L.cloudOff += dt * 0.014;
    L.earth.rotation.y = L.spin;
    L.clouds.rotation.y = L.spin + L.cloudOff;
    L.stars.rotation.y += dt * 0.004;
    updateMeteors(L.meteors, dt, 60, 70, 7);
    applyLandingCamera();
  }

  function bindLandingEvents() {
    const L = landing, c = L.canvas, pts = new Map();
    let pinch = 0;

    function pinchDist() {
      const a = Array.from(pts.values());
      return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }

    c.addEventListener('pointerdown', function (e) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* تجاهل */ }
      if (pts.size === 1) {
        L.dragging = true; L.lastX = e.clientX; L.lastY = e.clientY; L.lastT = performance.now();
      } else if (pts.size === 2) {
        L.dragging = false; pinch = pinchDist();
      }
    });

    c.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const d = pinchDist();
        L.zoomTarget = clamp(L.zoomTarget + (d - pinch) * 0.004, 0, 1);
        pinch = d;
        return;
      }
      if (!L.dragging) return;
      const dx = e.clientX - L.lastX, dy = e.clientY - L.lastY;
      const now = performance.now();
      const dtm = Math.max(8, now - L.lastT) / 1000;
      L.lastX = e.clientX; L.lastY = e.clientY; L.lastT = now;
      const dr = dx * 0.0055;
      L.spin += dr;
      L.spinVel = clamp(dr / dtm, -4, 4);
      L.tilt.rotation.x = clamp(L.tilt.rotation.x + dy * 0.0035, -0.5, 0.5);
    });

    function up(e) {
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        L.dragging = false;
      } else if (pts.size === 1) {
        const p = Array.from(pts.values())[0];
        L.lastX = p.x; L.lastY = p.y; L.lastT = performance.now(); L.dragging = true;
      }
    }
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      L.zoomTarget = clamp(L.zoomTarget - e.deltaY * 0.0007, 0, 1);
    }, { passive: false });
  }

  /* ========================================================================
     9. مشهد المجموعة الشمسية
     ======================================================================== */
  function buildSolar() {
    const S = solar;
    S.renderer = createRenderer(S.canvas);
    if (ENABLE_SHADOWS) {
      S.renderer.shadowMap.enabled = true;
      S.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    watchContext(S.canvas);

    S.scene = new THREE.Scene();
    S.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
    S.root = new THREE.Group();
    S.scene.add(S.root);
    S.planetEnts = []; S.moonEnts = []; S.solids = [];
    S.shiftX = 0; S.shiftY = 0; S.targetShiftX = 0; S.targetShiftY = 0; S.viewOffsetOn = false;
    S.pulse = 0;

    S.scene.add(new THREE.AmbientLight(0x2a3555, 0.55));
    S.sunLight = new THREE.PointLight(0xfff0d8, 1.7, 0, 1);
    if (ENABLE_SHADOWS) {
      S.sunLight.castShadow = true;
      S.sunLight.shadow.mapSize.set(1024, 1024);
      S.sunLight.shadow.camera.near = 1;
      S.sunLight.shadow.camera.far = 300;
      S.sunLight.shadow.bias = -0.0006;
    }
    S.root.add(S.sunLight);

    const skyTex = getTex('stars');
    if (skyTex) {
      S.sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 32),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, color: 0x9aa4c4 }));
      S.sky.renderOrder = -10;
      S.scene.add(S.sky);
    }
    S.stars = createStars(SOLAR_STARS, 900, 1700, 3.2);
    S.scene.add(S.stars);

    BODIES.forEach(buildBodyEntity);
    MOONS.forEach(buildMoonEntity);
    buildComet();
    buildBelt();
    buildGalaxy();
    S.meteors = createMeteors(S.scene, 4);

    buildLabels();
    buildNav();
    setupControls();
    resizeSolar();
    S.camera.position.copy(INTRO_POS);
    S.controls.target.set(0, 0, 0);
    S.camera.lookAt(0, 0, 0);
  }

  function buildBodyEntity(b) {
    const S = solar;
    const isStar = b.kind === 'star';
    const pivot = new THREE.Group();
    const tiltG = new THREE.Group();
    tiltG.rotation.z = deg(b.tilt || 0);
    pivot.add(tiltG);

    let mat, earthMat = null;
    if (isStar) {
      mat = new THREE.MeshBasicMaterial({ map: getTex(b.tex) });
    } else if (b.special === 'earth') {
      earthMat = createEarthMaterial(V3.set(1, 0, 0));
      mat = earthMat;
    } else {
      mat = new THREE.MeshStandardMaterial({ map: getTex(b.tex), roughness: 0.95, metalness: 0 });
    }
    const mesh = new THREE.Mesh(SPHERE_GEO, mat);
    mesh.scale.setScalar(b.radius);
    mesh.castShadow = ENABLE_SHADOWS && !isStar;
    tiltG.add(mesh);
    S.solids.push(mesh);

    // طبقة غيوم (الأرض) أو غلاف سميك (الزهرة)
    let layerMesh = null;
    if (b.layer) {
      const lm = b.layer.tex === 'earthClouds'
        ? new THREE.MeshLambertMaterial({ color: 0xffffff, alphaMap: getTex('earthClouds'), transparent: true, opacity: b.layer.opacity, depthWrite: false })
        : new THREE.MeshLambertMaterial({ map: getTex(b.layer.tex), transparent: true, opacity: b.layer.opacity, depthWrite: false });
      layerMesh = new THREE.Mesh(SPHERE_GEO, lm);
      layerMesh.scale.setScalar(b.radius * b.layer.scale);
      tiltG.add(layerMesh);
    }

    // توهج جوي
    if (b.atmos) {
      const am = new THREE.Mesh(SPHERE_GEO, createAtmosphereMaterial(b.atmos.color, b.atmos.intensity));
      am.scale.setScalar(b.radius * 1.16);
      pivot.add(am);
    }

    // حلقات (زحل وأورانوس)
    if (b.ring) {
      const rt = b.ring.tex ? getTex(b.ring.tex) : null;
      let rmat;
      if (rt) {
        rmat = new THREE.MeshStandardMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, metalness: 0 });
      } else {
        rmat = new THREE.MeshBasicMaterial({ color: b.ring.color, transparent: true, opacity: b.ring.opacity, side: THREE.DoubleSide, depthWrite: false });
      }
      const vertical = !!(rt && rt.image && rt.image.height > rt.image.width);
      const ring = new THREE.Mesh(createRingGeometry(b.ring.inner, b.ring.outer, vertical), rmat);
      ring.rotation.x = -Math.PI / 2;
      ring.receiveShadow = ENABLE_SHADOWS && !!rt;
      tiltG.add(ring);
    }

    // توهج الشمس
    if (isStar) {
      S.sunGlow = [];
      [[0xffd27a, b.radius * 6, 0.55], [0xff8a2a, b.radius * 11, 0.22], [0xffb060, b.radius * 18, 0.08]].forEach(function (g) {
        const sp = createGlowSprite(g[0], g[1], g[2]);
        pivot.add(sp);
        S.sunGlow.push({ sp: sp, base: g[1], op: g[2] });
      });
    }

    // أقمار صناعية حول الأرض
    const sats = [];
    if (b.satellites) {
      SAT_ORBITS.forEach(function (def) {
        const pg = new THREE.Group();
        pg.rotation.set(def.incX, 0, def.incZ);
        const line = new THREE.LineLoop(CIRCLE_GEO, MOON_ORBIT_MAT);
        line.scale.set(def.r, 1, def.r);
        pg.add(line);
        S.moonLines.push(line);
        const obj = createSatellite(def.variant, def.scale);
        pg.add(obj);
        pivot.add(pg);
        sats.push({ def: def, obj: obj, a: def.phase });
      });
    }

    // منطقة النقر
    const hitR = Math.max(b.radius * 1.25, b.ring ? b.ring.outer * 0.9 : 0);
    const hit = new THREE.Mesh(SPHERE_LOW, HIT_MAT);
    hit.scale.setScalar(hitR);
    hit.userData.id = b.id;
    pivot.add(hit);
    S.pickables.push(hit);

    const angle = b.phase || 0;
    pivot.position.set(Math.cos(angle) * b.orbit, 0, -Math.sin(angle) * b.orbit);
    S.root.add(pivot);

    if (b.orbit > 0) {
      const line = new THREE.LineLoop(CIRCLE_GEO, ORBIT_MAT);
      line.scale.set(b.orbit, 1, b.orbit);
      S.root.add(line);
      S.orbitLines.push(line);
    }

    const extent = Math.max(b.radius, b.ring ? b.ring.outer : 0, b.satellites ? 3.6 : 0);
    const ent = {
      id: b.id, kind: b.kind, data: b, color: b.color, radius: b.radius,
      node: pivot, pivot: pivot, mesh: mesh, layer: layerMesh, layerSpeed: b.layer ? b.layer.speed : 0,
      earthMat: earthMat, angle: angle, hit: hit, hitBase: hitR, hitPx: 14, moons: [], sats: sats,
      focusDist: isStar ? b.radius * 3.4 : Math.max(extent * 3.0, 6),
      minDist: b.radius * (isStar ? 1.3 : 1.5)
    };
    ENT[b.id] = ent;
    ENT_LIST.push(ent);
    S.planetEnts.push(ent);
  }

  function buildMoonEntity(m) {
    const S = solar;
    const parent = ENT[m.parent];
    if (!parent) { console.warn('[CodeVerse] قمر بلا كوكب أم:', m.id); return; }
    const pb = parent.data;

    const og = new THREE.Group();
    og.rotation.z = deg(m.parent === 'earth' ? 0 : (pb.tilt || 0));
    const inner = new THREE.Group();
    inner.rotation.x = deg(m.parent === 'uranus' ? 0 : (m.incl || 0));
    og.add(inner);
    parent.pivot.add(og);

    const line = new THREE.LineLoop(CIRCLE_GEO, MOON_ORBIT_MAT);
    line.scale.set(m.orbit, 1, m.orbit);
    inner.add(line);
    S.moonLines.push(line);

    const node = new THREE.Group();
    inner.add(node);
    const tex = (m.texKey && getTex(m.texKey)) || makeMoonTexture(m);
    const mesh = new THREE.Mesh(SPHERE_MID, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
    mesh.scale.setScalar(m.radius);
    mesh.receiveShadow = ENABLE_SHADOWS;
    node.add(mesh);
    S.solids.push(mesh);

    const hitR = Math.max(m.radius * 2.2, 0.45);
    const hit = new THREE.Mesh(SPHERE_LOW, HIT_MAT);
    hit.scale.setScalar(hitR);
    hit.userData.id = m.id;
    node.add(hit);
    S.pickables.push(hit);

    const ent = {
      id: m.id, kind: 'moon', data: m, color: m.color, radius: m.radius,
      node: node, mesh: mesh, angle: m.phase || 0, orbit: m.orbit, speed: Math.abs(m.speed) * 0.7,
      hit: hit, hitBase: hitR, hitPx: 11, moons: [], sats: [],
      focusDist: Math.max(m.radius * 5, 2.2), minDist: Math.max(m.radius * 1.8, 0.8)
    };
    ENT[m.id] = ent;
    ENT_LIST.push(ent);
    S.moonEnts.push(ent);
    parent.moons.push(ent);
  }

  function buildComet() {
    const S = solar, d = EX.comet;
    const a = d.orbitA, e = d.orbitE, b = a * Math.sqrt(1 - e * e);
    const og = new THREE.Group();
    og.rotation.set(deg(d.incl), deg(d.argPeri), 0);
    S.root.add(og);

    const N = 200, pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const E = (i / N) * TAU;
      pts[i * 3] = a * (Math.cos(E) - e); pts[i * 3 + 1] = 0; pts[i * 3 + 2] = b * Math.sin(E);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const line = new THREE.LineLoop(lg, new THREE.LineBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.22, depthWrite: false }));
    og.add(line);
    S.orbitLines.push(line);

    const node = new THREE.Group();
    og.add(node);
    const nucleus = new THREE.Mesh(SPHERE_LOW, new THREE.MeshStandardMaterial({ color: 0x8d8f96, roughness: 1 }));
    nucleus.scale.set(d.radius, d.radius * 0.8, d.radius * 0.9);
    node.add(nucleus);
    node.add(createGlowSprite(0x9fd8ff, 5, 0.9));

    // ذيل من جسيمات (أيوني أزرق + غباري دافئ) يمتد على المحور Z المحلي
    const tail = new THREE.Group();
    S.root.add(tail);
    const TN = IS_MOBILE ? 380 : 700, L = d.tailLength;
    const tp = new Float32Array(TN * 3), tc = new Float32Array(TN * 3);
    for (let i = 0; i < TN; i++) {
      const z = L * Math.pow(Math.random(), 1.6);
      const dust = Math.random() < 0.35;
      const spread = 0.12 + z * (dust ? 0.11 : 0.06);
      tp[i * 3] = gauss() * spread + (dust ? z * 0.12 : 0);
      tp[i * 3 + 1] = gauss() * spread * 0.6;
      tp[i * 3 + 2] = z;
      const f = 1 - (z / L) * 0.85;
      if (dust) { tc[i * 3] = 1 * f; tc[i * 3 + 1] = 0.82 * f; tc[i * 3 + 2] = 0.55 * f; }
      else { tc[i * 3] = 0.7 * f; tc[i * 3 + 1] = 0.9 * f; tc[i * 3 + 2] = 1 * f; }
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    const tailMat = new THREE.PointsMaterial({
      size: 0.75, map: DOT_TEX, vertexColors: true, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    const tailPts = new THREE.Points(tg, tailMat);
    tailPts.frustumCulled = false;
    tail.add(tailPts);

    const hit = new THREE.Mesh(SPHERE_LOW, HIT_MAT);
    hit.scale.setScalar(1.8);
    hit.userData.id = 'comet';
    node.add(hit);
    S.pickables.push(hit);

    S.comet = { a: a, e: e, b: b, M: d.phase || 0, speed: d.speed, node: node, tail: tail, tailMat: tailMat };
    const ent = {
      id: 'comet', kind: 'comet', data: d, color: d.color, radius: d.radius, node: node,
      hit: hit, hitBase: 1.8, hitPx: 14, moons: [], sats: [], focusDist: 9, minDist: 2
    };
    ENT.comet = ent;
    ENT_LIST.push(ent);
  }

  function buildBelt() {
    const S = solar, d = EX.belt;
    const group = new THREE.Group();
    S.root.add(group);
    const inst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      BELT_COUNT
    );
    inst.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const mid = (d.inner + d.outer) / 2, half = (d.outer - d.inner) / 2;
    for (let i = 0; i < BELT_COUNT; i++) {
      const ang = Math.random() * TAU;
      const r = clamp(mid + gauss() * half * 0.55, d.inner, d.outer);
      const s = rand(0.05, 0.2) * (Math.random() < 0.04 ? 2.2 : 1);
      dummy.position.set(Math.cos(ang) * r, gauss() * d.thickness * 0.5, -Math.sin(ang) * r);
      dummy.scale.set(s, s * rand(0.6, 1), s * rand(0.7, 1));
      dummy.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (inst.setColorAt) inst.setColorAt(i, col.setHSL(0.08, 0.15, rand(0.28, 0.55)));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);

    const node = new THREE.Object3D();
    node.position.set(mid, 0, 0);
    group.add(node);

    // منطقة نقر على شكل حلقة (Torus) غير مرئية
    const hit = new THREE.Mesh(new THREE.TorusGeometry(mid, half * 0.5, 8, 48), HIT_MAT);
    hit.rotation.x = Math.PI / 2;
    hit.userData.id = 'belt';
    group.add(hit);
    S.pickables.push(hit);

    S.belt = { group: group };
    const ent = {
      id: 'belt', kind: 'belt', data: d, color: d.color, radius: 8, node: node,
      moons: [], sats: [], focusDist: 34, minDist: 8
    };
    ENT.belt = ent;
    ENT_LIST.push(ent);
  }

  function buildGalaxy() {
    const S = solar, d = EX.andromeda, N = GALAXY_STARS, size = d.size;
    const group = new THREE.Group();
    group.position.set(d.position[0], d.position[1], d.position[2]);
    const tiltG = new THREE.Group();
    tiltG.rotation.set(deg(d.tiltX), 0, deg(d.tiltZ));
    group.add(tiltG);
    const spinG = new THREE.Group();
    tiltG.add(spinG);

    const pos = new Float32Array(N * 3), colArr = new Float32Array(N * 3);
    const cCore = new THREE.Color(d.coreColor), cArm = new THREE.Color(d.armColor), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      let x, y, z, t;
      const bulge = i < N * 0.22;
      if (bulge) {
        const r = Math.abs(gauss()) * size * 0.14;
        const th = rand(0, TAU), ph = Math.acos(rand(-1, 1));
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph) * 0.55; z = r * Math.sin(ph) * Math.sin(th); t = 0;
      } else {
        const k = i % d.arms;
        const rn = Math.pow(Math.random(), 0.62);
        const r = rn * size;
        const th = rn * 5.2 + k * (TAU / d.arms) + gauss() * 0.22 * (0.4 + rn);
        x = Math.cos(th) * r + gauss() * size * 0.025;
        z = Math.sin(th) * r + gauss() * size * 0.025;
        y = gauss() * size * 0.012 * (1.2 - rn);
        t = rn;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      c.copy(cCore).lerp(cArm, clamp(t * 1.6, 0, 1));
      c.multiplyScalar(bulge ? rand(0.7, 1) : rand(0.35, 1) * (1 - t * 0.35));
      colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.6, map: DOT_TEX, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true
    }));
    pts.frustumCulled = false;
    spinG.add(pts);
    group.add(createGlowSprite(d.coreColor, size * 0.85, 0.75));
    group.add(createGlowSprite(d.armColor, size * 2.4, 0.10));

    const hit = new THREE.Mesh(SPHERE_LOW, HIT_MAT);
    hit.scale.setScalar(size * 0.5);
    hit.userData.id = 'andromeda';
    group.add(hit);
    S.pickables.push(hit);
    S.root.add(group);

    S.galaxy = { group: group, spinG: spinG };
    const ent = {
      id: 'andromeda', kind: 'galaxy', data: d, color: d.color, radius: size * 0.5, node: group,
      moons: [], sats: [], focusDist: size * 2.8, minDist: size * 0.4
    };
    ENT.andromeda = ent;
    ENT_LIST.push(ent);
  }

  /* ---------- التسميات وقائمة الأجرام ---------- */
  function buildLabels() {
    const layer = $('labels-layer');
    layer.textContent = '';
    solar.labels = [];
    ENT_LIST.forEach(function (ent) {
      const elm = document.createElement('div');
      elm.className = 'body-label' + (ent.kind === 'moon' ? ' is-moon' : '');
      elm.textContent = ent.data.name;
      elm.style.display = 'none';
      elm.addEventListener('click', function (e) { e.stopPropagation(); selectEntity(ent.id); });
      layer.appendChild(elm);
      solar.labels.push({ ent: ent, el: elm, visible: false });
    });
  }

  function buildNav() {
    const nav = $('planet-nav');
    nav.textContent = '';
    ENT_LIST.forEach(function (ent) {
      if (ent.kind === 'moon') return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-btn';
      btn.dataset.id = ent.id;
      const dot = document.createElement('span');
      dot.className = 'nav-btn__dot';
      dot.style.setProperty('--c', ent.color);
      const txt = document.createElement('span');
      txt.textContent = ent.data.name;
      btn.appendChild(dot);
      btn.appendChild(txt);
      btn.addEventListener('click', function () { selectEntity(ent.id); });
      nav.appendChild(btn);
    });
  }

  function setNavActive(id) {
    const list = $('planet-nav').querySelectorAll('.nav-btn');
    for (let i = 0; i < list.length; i++) list[i].classList.toggle('is-active', list[i].dataset.id === id);
    const act = $('planet-nav').querySelector('.nav-btn.is-active');
    if (act && act.scrollIntoView) { try { act.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) { /* تجاهل */ } }
  }

  function refreshLabelSelection() {
    solar.labels.forEach(function (l) { l.el.classList.toggle('is-selected', l.ent.id === state.selectedId); });
  }

  /* ========================================================================
     10. نظام الكاميرا
     ======================================================================== */
  const cam = {
    ent: null, flying: false, follow: false, atOverview: false, t: 0, dur: 2.4, dist: 20, arc: 0,
    fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), dir: new THREE.Vector3(),
    toPos: new THREE.Vector3(), toTarget: new THREE.Vector3(), last: new THREE.Vector3()
  };

  function setupControls() {
    const c = new THREE.OrbitControls(solar.camera, solar.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.rotateSpeed = 0.55;
    c.zoomSpeed = 0.9;
    c.enablePan = false;
    c.minDistance = 14;
    c.maxDistance = 1000;
    c.addEventListener('start', function () { cam.atOverview = false; hideHint(); });
    solar.controls = c;
  }

  function overviewDistance() {
    const S = solar;
    const tanV = Math.tan(deg(S.camera.fov / 2));
    return OVERVIEW_R / (tanV * Math.min(1, S.w / S.h)) * 1.06;
  }

  function getOverviewPos(out) { return out.copy(OVERVIEW_DIR).multiplyScalar(overviewDistance()); }

  function entityPos(ent, out) { return ent.node.getWorldPosition(out); }

  function startFlight(ent, dur) {
    const S = solar;
    cam.ent = ent; cam.flying = true; cam.follow = false; cam.t = 0; cam.dur = dur;
    cam.atOverview = false;
    cam.fromPos.copy(S.camera.position);
    cam.fromTarget.copy(S.controls.target);
    S.controls.enabled = false;
    if (ent) {
      entityPos(ent, V1);
      cam.dir.copy(S.camera.position).sub(V1);
      if (cam.dir.lengthSq() < 1e-4) cam.dir.set(0, 0.4, 1);
      cam.dir.normalize();
      cam.dir.y = clamp(cam.dir.y, -0.6, 0.85);
      cam.dir.normalize();
      cam.dist = ent.focusDist;
      V2.copy(cam.dir).multiplyScalar(cam.dist).add(V1);
    } else {
      cam.dist = 0;
      getOverviewPos(V2);
    }
    cam.arc = clamp(cam.fromPos.distanceTo(V2) * 0.16, 0, 60);
  }

  function flyToOverview(dur) { startFlight(null, dur || 2.6); }

  function updateCamera(dt) {
    const S = solar, c = S.camera;
    if (cam.flying) {
      cam.t += dt / cam.dur;
      const k = Math.min(1, cam.t), e = easeInOut(k);
      if (cam.ent) {
        entityPos(cam.ent, cam.toTarget);
        cam.toPos.copy(cam.dir).multiplyScalar(cam.dist).add(cam.toTarget);
      } else {
        cam.toTarget.set(0, 0, 0);
        getOverviewPos(cam.toPos);
      }
      c.position.lerpVectors(cam.fromPos, cam.toPos, e);
      c.position.y += Math.sin(k * Math.PI) * cam.arc;
      S.controls.target.lerpVectors(cam.fromTarget, cam.toTarget, e);
      c.lookAt(S.controls.target);
      if (k >= 1) {
        cam.flying = false;
        cam.follow = !!cam.ent;
        cam.atOverview = !cam.ent;
        cam.last.copy(cam.toTarget);
        S.controls.enabled = true;
        S.controls.minDistance = cam.ent ? cam.ent.minDist : 14;
        S.controls.update();
      }
    } else {
      if (cam.follow && cam.ent) {
        entityPos(cam.ent, V1);
        V2.copy(V1).sub(cam.last);
        c.position.add(V2);
        S.controls.target.add(V2);
        cam.last.copy(V1);
      }
      S.controls.update();
    }
  }

  /** يزيح الصورة جانباً كي لا تغطي لوحة المعلومات الجرم المحدد. */
  function computeShift(open) {
    const S = solar;
    S.targetShiftX = 0; S.targetShiftY = 0;
    if (!open) return;
    const panel = $('info-panel');
    if (window.innerWidth <= 820) S.targetShiftY = Math.min(panel.offsetHeight, S.h * 0.6) / 2;
    else S.targetShiftX = (panel.offsetWidth + 32) / 2;
  }

  function updateViewOffset(dt) {
    const S = solar, k = Math.min(1, dt * 6);
    S.shiftX += (S.targetShiftX - S.shiftX) * k;
    S.shiftY += (S.targetShiftY - S.shiftY) * k;
    if (S.targetShiftX === 0 && S.targetShiftY === 0 && Math.abs(S.shiftX) < 0.3 && Math.abs(S.shiftY) < 0.3) {
      if (S.viewOffsetOn) { S.camera.clearViewOffset(); S.viewOffsetOn = false; }
      S.shiftX = 0; S.shiftY = 0;
    } else {
      S.camera.setViewOffset(S.w, S.h, -S.shiftX, S.shiftY, S.w, S.h);
      S.viewOffsetOn = true;
    }
  }

  /** يكبّر مناطق النقر عن بُعد لتسهّل اختيار الأجرام الصغيرة. */
  function updateHitScales() {
    const S = solar, pxK = Math.tan(deg(S.camera.fov / 2)) / (S.h / 2);
    for (let i = 0; i < ENT_LIST.length; i++) {
      const ent = ENT_LIST[i];
      if (!ent.hit || !ent.hitPx) continue;
      ent.hit.getWorldPosition(V1);
      const d = S.camera.position.distanceTo(V1);
      ent.hit.scale.setScalar(Math.max(ent.hitBase, d * pxK * ent.hitPx));
    }
  }

  function updateLabels() {
    const S = solar, cm = S.camera, tanV = Math.tan(deg(cm.fov / 2));
    for (let i = 0; i < S.labels.length; i++) {
      const lb = S.labels[i], ent = lb.ent;
      let show = S.labelsOn;
      let sx = 0, sy = 0;
      if (show && ent.kind === 'moon' && state.selectedId !== ent.id && state.selectedId !== ent.data.parent) {
        entityPos(ent, V1);
        if (cm.position.distanceTo(V1) > 22) show = false;
      }
      if (show) {
        entityPos(ent, V1);
        const dist = cm.position.distanceTo(V1);
        V2.copy(V1).project(cm);
        if (V2.z > 1 || V2.z < -1) {
          show = false;
        } else {
          sx = (V2.x * 0.5 + 0.5) * S.w;
          sy = (-V2.y * 0.5 + 0.5) * S.h;
          if (sx < -60 || sx > S.w + 60 || sy < -40 || sy > S.h + 40) {
            show = false;
          } else {
            sy -= clamp(ent.radius / (dist * tanV) * (S.h / 2), 0, S.h * 0.4) + 10;
          }
        }
      }
      if (show !== lb.visible) { lb.visible = show; lb.el.style.display = show ? '' : 'none'; }
      if (show) lb.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-100%)';
    }
  }

  function updateSolar(dt) {
    const S = solar, t = dt * state.speed;
    S.pulse += dt;

    for (let i = 0; i < S.planetEnts.length; i++) {
      const ent = S.planetEnts[i], b = ent.data;
      if (b.orbit > 0) {
        ent.angle += b.orbitSpeed * t;
        ent.pivot.position.set(Math.cos(ent.angle) * b.orbit, 0, -Math.sin(ent.angle) * b.orbit);
      }
      ent.mesh.rotation.y += b.spin * t;
      if (ent.layer) ent.layer.rotation.y += ent.layerSpeed * t;
      if (ent.earthMat) {
        V1.copy(ent.pivot.position).negate().normalize();
        ent.earthMat.uniforms.uSunDir.value.copy(V1);
      }
      for (let j = 0; j < ent.sats.length; j++) {
        const s = ent.sats[j];
        s.a += s.def.speed * t;
        s.obj.position.set(Math.cos(s.a) * s.def.r, 0, -Math.sin(s.a) * s.def.r);
        s.obj.rotation.set(0, s.a, Math.PI / 2);
      }
    }

    for (let i = 0; i < S.moonEnts.length; i++) {
      const m = S.moonEnts[i];
      m.angle += m.speed * t;
      m.node.position.set(Math.cos(m.angle) * m.orbit, 0, -Math.sin(m.angle) * m.orbit);
      m.mesh.rotation.y = m.angle;
    }

    // المذنب: حل معادلة كبلر ثم توجيه الذيل بعيداً عن الشمس
    const C = S.comet;
    C.M += C.speed * t;
    let E = C.M;
    for (let k = 0; k < 6; k++) E -= (E - C.e * Math.sin(E) - C.M) / (1 - C.e * Math.cos(E));
    C.node.position.set(C.a * (Math.cos(E) - C.e), 0, C.b * Math.sin(E));
    C.node.getWorldPosition(V1);
    C.tail.position.copy(V1);
    V2.copy(V1).multiplyScalar(2);
    C.tail.lookAt(V2);
    const dSun = V1.length();
    C.tail.scale.set(1, 1, clamp(1.6 - dSun / 90, 0.3, 1.5));
    C.tailMat.opacity = clamp(1.3 - dSun / 110, 0.25, 1);

    S.belt.group.rotation.y += EX.belt.speed * t;
    S.galaxy.spinG.rotation.y += EX.andromeda.spin * t;

    for (let i = 0; i < S.sunGlow.length; i++) {
      const g = S.sunGlow[i], p = 1 + Math.sin(S.pulse * (0.8 + i * 0.35)) * 0.03;
      g.sp.scale.set(g.base * p, g.base * p, 1);
    }

    updateMeteors(S.meteors, dt, 260, 140, 24);
    updateCamera(dt);
    updateViewOffset(dt);
    updateHitScales();
    updateLabels();
  }

  function resizeSolar() {
    const S = solar;
    if (!S.renderer) return;
    S.w = Math.max(1, S.canvas.clientWidth);
    S.h = Math.max(1, S.canvas.clientHeight);
    S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    S.renderer.setSize(S.w, S.h, false);
    S.camera.aspect = S.w / S.h;
    S.camera.updateProjectionMatrix();
    if (cam.atOverview && !cam.flying && !cam.ent) {
      getOverviewPos(S.camera.position);
      S.controls.target.set(0, 0, 0);
      S.camera.lookAt(0, 0, 0);
    }
    if ($('info-panel').classList.contains('is-open')) computeShift(true);
  }

  /* ========================================================================
     11. التحديد ولوحة المعلومات
     ======================================================================== */
  function mk(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function hideHint() { $('solar-hint').classList.add('is-hidden'); }

  function fillPanel(ent) {
    const d = ent.data;
    $('planet-swatch').style.setProperty('--c', d.color);
    setText('planet-name', d.name);
    setText('planet-name-en', d.en);
    const parent = ent.kind === 'moon' ? ENT[d.parent] : null;
    setText('planet-type', parent ? 'قمر طبيعي حول ' + parent.data.name : (d.type || ''));
    setText('planet-description', d.desc);

    const moonSec = $('moon-section'), list = $('moon-list');
    list.textContent = '';
    if (ent.moons && ent.moons.length) {
      setText('moon-title', 'الأقمار (' + ent.moons.length + ')');
      ent.moons.forEach(function (m) {
        const li = mk('li');
        const btn = mk('button', 'moon-item');
        btn.type = 'button';
        btn.dataset.id = m.id;
        const dot = mk('span', 'moon-item__dot');
        dot.style.setProperty('--c', m.color);
        const box = mk('span', 'moon-item__text');
        box.appendChild(mk('span', 'moon-item__name', m.data.name));
        box.appendChild(mk('span', 'moon-item__desc', m.data.desc));
        btn.appendChild(dot);
        btn.appendChild(box);
        li.appendChild(btn);
        list.appendChild(li);
      });
      moonSec.hidden = false;
    } else {
      moonSec.hidden = true;
    }

    const stats = $('planet-stats');
    stats.textContent = '';
    (d.stats || []).forEach(function (s) {
      const row = mk('div', 'stat-item');
      row.appendChild(mk('dt', '', s[0]));
      row.appendChild(mk('dd', '', s[1]));
      stats.appendChild(row);
    });

    const facts = $('planet-facts');
    facts.textContent = '';
    (d.facts || []).forEach(function (f) { facts.appendChild(mk('li', '', f)); });

    const sc = document.querySelector('.info-panel__scroll');
    if (sc) sc.scrollTop = 0;
  }

  function openPanel() {
    const p = $('info-panel');
    p.classList.add('is-open');
    p.setAttribute('aria-hidden', 'false');
    computeShift(true);
  }

  function closePanel() {
    const p = $('info-panel');
    p.classList.remove('is-open');
    p.setAttribute('aria-hidden', 'true');
    if (solar.ready) computeShift(false);
  }

  function selectEntity(id) {
    const ent = ENT[id];
    if (!ent || state.mode !== 'solar' || state.busy) return;
    state.selectedId = id;
    fillPanel(ent);
    openPanel();
    setNavActive(ent.kind === 'moon' ? ent.data.parent : id);
    refreshLabelSelection();
    hideHint();
    startFlight(ent, 2.6);
  }

  function deselect() {
    state.selectedId = null;
    closePanel();
    setNavActive(null);
    refreshLabelSelection();
    if (state.mode === 'solar') flyToOverview(2.6);
  }

  /** يحدد الجرم تحت المؤشر (الأقمار لها أولوية إن لم يحجبها جرم أمامها). */
  function pick(clientX, clientY) {
    const S = solar, r = S.canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, S.camera);
    const hits = raycaster.intersectObjects(S.pickables, false);
    if (!hits.length) return null;
    let blockers = null;
    for (let i = 0; i < hits.length; i++) {
      const ent = ENT[hits[i].object.userData.id];
      if (ent && ent.kind === 'moon') {
        if (!blockers) blockers = raycaster.intersectObjects(S.solids, false);
        if (!blockers.length || blockers[0].distance > hits[i].distance) return ent.id;
      }
    }
    return hits[0].object.userData.id;
  }

  function bindSolarEvents() {
    const S = solar;
    let down = null, lastHover = 0;

    S.canvas.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), ok: e.isPrimary && (e.button === 0 || e.pointerType === 'touch') };
    });

    window.addEventListener('pointerup', function (e) {
      if (!down) return;
      const d = down;
      down = null;
      if (!d.ok || !solar.active) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7 && performance.now() - d.t < 700) {
        const id = pick(e.clientX, e.clientY);
        if (id) selectEntity(id);
      }
    });

    S.canvas.addEventListener('pointermove', function (e) {
      if (down || e.pointerType === 'touch' || !solar.active) return;
      const now = performance.now();
      if (now - lastHover < 90) return;
      lastHover = now;
      S.canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : '';
    });

    S.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ========================================================================
     12. الموسيقى (ملف صوتي، أو موسيقى هادئة مولّدة بالكود)
     ======================================================================== */
  const MUSIC_FILE = 'audio/space-ambient.mp3';
  const music = { on: false, ctx: null, master: null, bus: null, shimmerTimer: 0, usingFile: false, fileFailed: false, vol: 0.5, fadeTimer: 0 };

  function syncMusicUI() {
    $('music-btn').setAttribute('aria-pressed', music.on ? 'true' : 'false');
    $('solar-music-btn').setAttribute('aria-pressed', music.on ? 'true' : 'false');
    setText('music-btn-label', music.on ? 'إيقاف الموسيقى' : 'الموسيقى');
    $('music-tip').classList.add('is-hidden');
  }

  function fadeAudioTo(target, ms, done) {
    const a = $('space-audio');
    clearInterval(music.fadeTimer);
    const from = a.volume, t0 = performance.now();
    music.fadeTimer = setInterval(function () {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = clamp(from + (target - from) * k, 0, 1);
      if (k >= 1) { clearInterval(music.fadeTimer); if (done) done(); }
    }, 40);
  }

  function buildAmbient(AC) {
    const ctx = music.ctx = new AC();
    const master = music.master = ctx.createGain();
    master.gain.value = 0;
    const bus = music.bus = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.55;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    bus.connect(master);
    bus.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(master);
    master.connect(ctx.destination);

    // وسادة صوتية هادئة: وتر لا ثانوي مع إزاحة طفيفة في التردد وتموّج بطيء
    [[110, 0.20], [164.81, 0.14], [220, 0.12], [261.63, 0.08], [329.63, 0.05]].forEach(function (n, i) {
      [-6, 6].forEach(function (det) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'sine' : 'triangle';
        o.frequency.value = n[0];
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = n[1] * 0.5;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700 + i * 180;
        f.Q.value = 0.4;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.04 + i * 0.017 + (det > 0 ? 0.01 : 0);
        const lg = ctx.createGain();
        lg.gain.value = n[1] * 0.28;
        lfo.connect(lg);
        lg.connect(g.gain);
        o.connect(f);
        f.connect(g);
        g.connect(bus);
        o.start();
        lfo.start();
      });
    });
  }

  function scheduleShimmer() {
    clearTimeout(music.shimmerTimer);
    if (!music.on || music.usingFile || !music.ctx) return;
    const ctx = music.ctx, notes = [440, 523.25, 659.25, 783.99, 880, 987.77];
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = 'sine';
    o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    o.connect(g);
    g.connect(music.bus);
    o.start(t);
    o.stop(t + 6);
    music.shimmerTimer = setTimeout(scheduleShimmer, rand(3500, 8000));
  }

  function startGenerated() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { music.on = false; syncMusicUI(); return; }
    music.usingFile = false;
    try {
      if (!music.ctx) buildAmbient(AC);
      music.ctx.resume();
      music.master.gain.cancelScheduledValues(music.ctx.currentTime);
      music.master.gain.setTargetAtTime(music.vol * 0.55, music.ctx.currentTime, 0.8);
      scheduleShimmer();
    } catch (err) {
      console.warn('[CodeVerse] تعذّر تشغيل الصوت المولّد:', err);
      music.on = false;
      syncMusicUI();
    }
  }

  function startMusic() {
    music.on = true;
    syncMusicUI();
    const audio = $('space-audio');
    if (!music.fileFailed) {
      if (!audio.getAttribute('src')) audio.setAttribute('src', MUSIC_FILE);
      audio.volume = 0;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(function () {
          if (!music.on) { audio.pause(); return; }
          music.usingFile = true;
          fadeAudioTo(music.vol, 1500);
        }).catch(function () {
          audio.removeAttribute('src');
          try { audio.load(); } catch (e) { /* تجاهل */ }
          music.fileFailed = true;
          music.usingFile = false;
          if (music.on) startGenerated();
        });
      } else {
        music.usingFile = true;
        fadeAudioTo(music.vol, 1500);
      }
      return;
    }
    startGenerated();
  }

  function stopMusic() {
    music.on = false;
    syncMusicUI();
    clearTimeout(music.shimmerTimer);
    if (music.usingFile) {
      const a = $('space-audio');
      fadeAudioTo(0, 900, function () { a.pause(); });
    } else if (music.ctx) {
      const ctx = music.ctx;
      music.master.gain.cancelScheduledValues(ctx.currentTime);
      music.master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(function () { if (!music.on) ctx.suspend(); }, 1200);
    }
  }

  function toggleMusic() { if (music.on) stopMusic(); else startMusic(); }

  function setVolume(v) {
    music.vol = clamp(v, 0, 1);
    if (!music.on) return;
    if (music.usingFile) { $('space-audio').volume = music.vol; }
    else if (music.ctx) { music.master.gain.setTargetAtTime(music.vol * 0.55, music.ctx.currentTime, 0.1); }
  }

  /* ========================================================================
     13. الانتقال بين الصفحات وأزرار الواجهة
     ======================================================================== */
  function tween(duration, onUpdate) {
    return new Promise(function (resolve) {
      const t0 = performance.now();
      (function step(now) {
        const k = Math.min(1, (now - t0) / duration);
        onUpdate(k);
        if (k < 1) requestAnimationFrame(step); else resolve();
      })(t0);
    });
  }

  async function enterSolar() {
    if (state.busy || state.mode !== 'landing') return;
    state.busy = true;
    const btn = $('enter-btn'), overlay = $('transition-overlay');
    btn.disabled = true;
    try {
      const zoomP = tween(1300, function (k) { landing.enter = easeInOut(k); });
      await wait(750);
      overlay.classList.add('is-on');
      await Promise.all([zoomP, wait(750)]);

      // نبني المجموعة الشمسية ونتأكد أنها ترسم إطاراً قبل إخفاء صفحة الهبوط
      if (!solar.ready) buildSolar();
      resizeSolar();
      solar.renderer.render(solar.scene, solar.camera);
      if (solar.renderer.getContext().isContextLost()) throw new Error('فُقد سياق WebGL أثناء التجهيز.');

      solar.camera.position.copy(INTRO_POS);
      solar.controls.target.set(0, 0, 0);
      solar.camera.lookAt(0, 0, 0);
      cam.ent = null; cam.follow = false; cam.flying = false; cam.atOverview = false;
      state.selectedId = null;
      closePanel(); setNavActive(null); refreshLabelSelection();

      solar.ready = true;
      solar.active = true;
      state.mode = 'solar';
      landing.active = false;
      $('landing-page').classList.remove('is-active');
      $('solar-page').classList.add('is-active');
      $('solar-page').setAttribute('aria-hidden', 'false');
      $('solar-hint').classList.remove('is-hidden');

      await wait(120);
      overlay.classList.remove('is-on');
      startFlight(null, 4.4);
      state.busy = false;
    } catch (err) {
      console.error('[CodeVerse]', err);
      overlay.classList.remove('is-on');
      landing.enter = 0;
      solar.active = false;
      state.mode = 'landing';
      landing.active = true;
      btn.disabled = false;
      state.busy = false;
      showError('تعذّر فتح المجموعة الشمسية', (err && err.message ? err.message : String(err)) + '\nافتح F12 ثم Console لرؤية التفاصيل.');
    }
  }

  async function goHome() {
    if (state.busy || state.mode !== 'solar') return;
    state.busy = true;
    const overlay = $('transition-overlay');
    overlay.classList.add('is-on');
    await wait(750);
    closePanel();
    state.selectedId = null;
    setNavActive(null);
    refreshLabelSelection();
    cam.follow = false; cam.flying = false; cam.ent = null;
    solar.controls.enabled = true;
    landing.enter = 0; landing.zoom = 0; landing.zoomTarget = 0; landing.intro = 0.5;
    landing.active = true;
    solar.active = false;
    state.mode = 'landing';
    $('solar-page').classList.remove('is-active');
    $('solar-page').setAttribute('aria-hidden', 'true');
    $('landing-page').classList.add('is-active');
    $('enter-btn').disabled = false;
    await wait(150);
    overlay.classList.remove('is-on');
    state.busy = false;
  }

  function toggleFullscreen() {
    const d = document, el = d.documentElement;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    const exit = d.exitFullscreen || d.webkitExitFullscreen;
    if (!req) {
      setText('texture-notice-text', 'ملء الشاشة غير مدعوم في هذا المتصفح.');
      $('texture-notice').hidden = false;
      setTimeout(function () { $('texture-notice').hidden = true; }, 3500);
      return;
    }
    try {
      const r = isFs ? exit.call(d) : req.call(el);
      if (r && r.catch) r.catch(function () { /* تجاهل */ });
    } catch (e) { /* تجاهل */ }
  }

  function selectByOffset(delta) {
    const list = ENT_LIST.filter(function (e) { return e.kind !== 'moon'; });
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i].id === state.selectedId) idx = i;
    const next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length;
    selectEntity(list[next].id);
  }

  function bindUI() {
    $('enter-btn').addEventListener('click', enterSolar);
    $('home-btn').addEventListener('click', goHome);
    $('reset-btn').addEventListener('click', deselect);
    $('close-panel-btn').addEventListener('click', deselect);
    $('panel-reset-btn').addEventListener('click', deselect);
    $('focus-btn').addEventListener('click', function () {
      const ent = ENT[state.selectedId];
      if (ent) startFlight(ent, 2.2);
    });

    $('orbits-btn').addEventListener('click', function () {
      solar.orbitsOn = !solar.orbitsOn;
      solar.orbitLines.forEach(function (l) { l.visible = solar.orbitsOn; });
      solar.moonLines.forEach(function (l) { l.visible = solar.orbitsOn; });
      this.classList.toggle('is-on', solar.orbitsOn);
      this.setAttribute('aria-pressed', solar.orbitsOn ? 'true' : 'false');
    });

    $('labels-btn').addEventListener('click', function () {
      solar.labelsOn = !solar.labelsOn;
      this.classList.toggle('is-on', solar.labelsOn);
      this.setAttribute('aria-pressed', solar.labelsOn ? 'true' : 'false');
    });

    $('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', function () {
      $('fullscreen-btn').classList.toggle('is-on', !!document.fullscreenElement);
    });

    $('music-btn').addEventListener('click', toggleMusic);
    $('solar-music-btn').addEventListener('click', toggleMusic);
    $('volume-slider').addEventListener('input', function () { setVolume(parseFloat(this.value)); });

    $('speed-slider').addEventListener('input', function () {
      state.speed = parseFloat(this.value);
      setText('speed-value', state.speed.toFixed(1) + 'x');
    });

    $('moon-list').addEventListener('click', function (e) {
      const b = e.target.closest ? e.target.closest('.moon-item') : null;
      if (b) selectEntity(b.dataset.id);
    });

    $('texture-notice-close').addEventListener('click', function () { $('texture-notice').hidden = true; });

    bindSolarEvents();
    solar.orbitsOn = true;

    window.addEventListener('keydown', function (e) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && tag !== 'BUTTON') { e.preventDefault(); toggleMusic(); return; }
      if (state.mode !== 'solar' || state.busy) return;
      if (e.key === 'Escape') { deselect(); }
      else if (e.key === 'r' || e.key === 'R') { deselect(); }
      else if (e.key === 'ArrowRight') { selectByOffset(1); }
      else if (e.key === 'ArrowLeft') { selectByOffset(-1); }
      else if (e.key >= '0' && e.key <= '8') {
        const b = BODIES[parseInt(e.key, 10)];
        if (b) selectEntity(b.id);
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (!music.on) return;
      if (document.hidden) {
        if (music.usingFile) $('space-audio').pause(); else if (music.ctx) music.ctx.suspend();
      } else {
        if (music.usingFile) { const p = $('space-audio').play(); if (p && p.catch) p.catch(function () { /* تجاهل */ }); }
        else if (music.ctx) music.ctx.resume();
      }
    });

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });
  }

  function onResize() {
    resizeLanding();
    resizeSolar();
  }

  /* ========================================================================
     14. حلقة الرسم
     ======================================================================== */
  let frameErrors = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state.contextLost) return;
    try {
      if (landing.active && landing.ready) {
        updateLanding(dt);
        landing.renderer.render(landing.scene, landing.camera);
      }
      if (solar.active && solar.ready) {
        updateSolar(dt);
        solar.renderer.render(solar.scene, solar.camera);
      }
      frameErrors = 0;
    } catch (err) {
      console.error('[CodeVerse] خطأ أثناء الرسم:', err);
      if (++frameErrors === 5) {
        showError('توقف الرسم بسبب خطأ', (err && err.message ? err.message : String(err)) + '\nافتح F12 ثم Console وأرسل لي أول خطأ أحمر.');
      }
    }
  }

  /* ========================================================================
     15. بدء التشغيل
     ======================================================================== */
  async function init() {
    try {
      updateLoader('جارٍ تجهيز المشهد...');
      landing.renderer = createRenderer(landing.canvas);
      maxAniso = Math.min(8, landing.renderer.capabilities.getMaxAnisotropy());
      initSharedAssets();

      updateLoader('جارٍ تحميل الخامات...');
      await loadAllTextures();

      updateLoader('جارٍ بناء الأرض...');
      buildLanding();
      setText('stat-planets', String(BODIES.length - 1));
      setText('stat-moons', String(MOONS.length));
      setText('stat-stars', '1');
      bindUI();
      showTextureNotice();

      $('loader-bar').style.width = '100%';
      await wait(350);
      landing.ready = true;
      document.body.classList.remove('is-loading');
      $('loader').classList.add('is-done');
      clock.start();
      animate();
    } catch (err) {
      console.error('[CodeVerse]', err);
      const msg = err && err.message ? err.message : String(err);
      const noGL = /webgl/i.test(msg);
      showError(
        noGL ? 'المتصفح لا يدعم WebGL' : 'تعذّر تشغيل التجربة',
        noGL ? 'فعّل تسريع العتاد (Hardware Acceleration) في المتصفح أو جرّب متصفحاً آخر.' : msg + '\nافتح F12 ثم Console لرؤية التفاصيل.'
      );
    }
  }

  init();

})();