/**
 * Hero 3D graded-card carousel — port of `Tokenable-with design system/hero-slab-3d.js`.
 * Ten slabs orbit on the Y axis; drag adds momentum; auto-spins when idle.
 */

import type { Material, Mesh, MeshStandardMaterial } from "three";
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Clock,
  ColorManagement,
  DirectionalLight as DirLight,
  DoubleSide,
  ExtrudeGeometry,
  Group as ThreeGroup,
  LinearFilter,
  Mesh as ThreeMesh,
  MeshPhysicalMaterial as PhysMat,
  MeshStandardMaterial as StdMat,
  PMREMGenerator,
  PerspectiveCamera as PerspCam,
  PointLight as PtLight,
  Scene as ThreeScene,
  Shape,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer as GLRenderer,
  ACESFilmicToneMapping,
  EquirectangularReflectionMapping,
} from "three";
import {
  cardCountForTier,
  type HeroCarouselTier,
} from "@/lib/home/heroCarouselCapability";

const AZURE = 0x1a6fff;
const ORBIT_RADIUS = 4.1;
const AUTO_SPIN = 0.16;

type FadeEntry = [Material, number];

type CardUserData = {
  baseAngle: number;
  fade: FadeEntry[];
};

export type HeroSlabCarouselOptions = {
  host: HTMLElement;
  heroSection: HTMLElement;
  mobileSlot: HTMLElement | null;
  tier?: Exclude<HeroCarouselTier, "fallback">;
  prefersReducedMotion?: boolean;
  /** Cardhedger catalog cover URLs (Bubble `/crop_image`). */
  imageSources: readonly string[];
};

export type HeroSlabCarouselController = {
  dispose: () => void;
  pause: () => void;
  resume: () => void;
};

/** Matches prototype `document.querySelector('.wrap')` — first 1240px page shell. */
const PAGE_SHELL_ALIGN_SELECTOR = ".tkl-wrap";

function sharpenCardTexture(tex: import("three").Texture): void {
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function makeEnv(renderer: import("three").WebGLRenderer): import("three").Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D unavailable");

  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#3a3a42");
  grad.addColorStop(0.45, "#0e0e10");
  grad.addColorStop(0.5, "#0e0e0e");
  grad.addColorStop(1, "#050506");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "rgba(26, 111, 255,0.5)";
  g.fillRect(0, 96, 512, 26);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillRect(120, 30, 90, 12);
  g.fillRect(330, 50, 60, 8);

  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

function makeCardBack(): CanvasTexture {
  const W2 = 620;
  const H2 = 1040;
  const c = document.createElement("canvas");
  c.width = W2;
  c.height = H2;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D unavailable");

  const grad = g.createLinearGradient(0, 0, W2, H2);
  grad.addColorStop(0, "#18181d");
  grad.addColorStop(0.5, "#101015");
  grad.addColorStop(1, "#0a0a0d");
  g.fillStyle = grad;
  g.fillRect(0, 0, W2, H2);
  g.save();
  g.strokeStyle = "rgba(255,255,255,0.022)";
  g.lineWidth = 54;
  for (let x = -H2; x < W2 + H2; x += 130) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + H2, H2);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 2;
  roundRect(g, 28, 28, W2 - 56, H2 - 56, 30);
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#eef1f5";
  g.font = "bold 28px monospace";
  g.fillText("TOKENABLE", W2 / 2, H2 / 2 - 16);
  g.fillStyle = "#1A6FFF";
  g.font = "600 14px monospace";
  g.fillText("VAULTED • ON-CHAIN", W2 / 2, H2 / 2 + 18);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  sharpenCardTexture(tex);
  return tex;
}

function slabShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function camZForAspect(aspect: number): number {
  if (aspect >= 1.4) return 9.2;
  if (aspect >= 1.05) return 10.0;
  if (aspect >= 0.8) return 11.4;
  return 9.5;
}

function placeCarouselHost(
  host: HTMLElement,
  heroSection: HTMLElement,
  mobileSlot: HTMLElement | null,
  mobile: boolean,
) {
  if (mobile && mobileSlot) {
    if (host.parentElement !== mobileSlot) {
      mobileSlot.appendChild(host);
    }
    host.style.position = "relative";
    host.style.inset = "auto";
    host.style.width = "100%";
    host.style.height = "100%";
  } else {
    if (host.parentElement !== heroSection) {
      heroSection.insertBefore(host, heroSection.firstChild);
    }
    host.style.position = "absolute";
    host.style.inset = "0";
    host.style.width = "";
    host.style.height = "";
  }
}

export function createHeroSlabCarousel(
  options: HeroSlabCarouselOptions,
): HeroSlabCarouselController | null {
  const {
    host,
    heroSection,
    mobileSlot,
    tier = "full",
    prefersReducedMotion = false,
    imageSources,
  } = options;

  if (!imageSources.length) return null;

  const cardCount = Math.min(cardCountForTier(tier), imageSources.length);
  if (cardCount <= 0) return null;
  const useLightEnv = tier === "reduced";

  let wasMobile: boolean | null = null;
  const isMobileViewport = () => window.innerWidth < 768;

  placeCarouselHost(host, heroSection, mobileSlot, isMobileViewport());
  wasMobile = isMobileViewport();

  if (!host.clientWidth || !host.clientHeight) return null;

  ColorManagement.enabled = true;

  let W = host.clientWidth;
  let H = host.clientHeight;

  const renderer = new GLRenderer({
    antialias: !useLightEnv,
    alpha: true,
    powerPreference: useLightEnv ? "low-power" : "default",
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, useLightEnv ? 1.25 : 2),
  );
  renderer.setSize(W, H);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new ThreeScene();
  let env: import("three").Texture | null = null;
  if (!useLightEnv) {
    env = makeEnv(renderer);
    scene.environment = env;
  }

  const cam = new PerspCam(42, W / H, 0.1, 100);
  cam.position.set(0, 0, camZForAspect(W / H));

  const calcGroupX = () => {
    if (W < 768) return 0;
    const wrap = document.querySelector(PAGE_SHELL_ALIGN_SELECTOR);
    if (!wrap) {
      const shellW = Math.min(1240, W);
      const offsetPx = (W - shellW) / 2 + shellW - W / 2;
      const visW = 2 * Math.tan((21 * Math.PI) / 180) * camZForAspect(W / H);
      return (offsetPx / W) * visW;
    }
    const rect = wrap.getBoundingClientRect();
    const offsetPx = rect.right - W / 2;
    const visW = 2 * Math.tan((21 * Math.PI) / 180) * camZForAspect(W / H);
    return (offsetPx / W) * visW;
  };

  scene.add(new AmbientLight(0xffffff, 0.4));
  const d1 = new DirLight(0xffffff, 1.1);
  d1.position.set(3, 5, 6);
  scene.add(d1);
  const p1 = new PtLight(AZURE, 0.8, 40);
  p1.position.set(-5, 2, 4);
  scene.add(p1);

  const group = new ThreeGroup();
  group.position.x = calcGroupX();
  scene.add(group);

  const CW = 1.5;
  const CH = 2.5;
  const CD = 0.028;
  const FT = 0.03;
  const cardGeo = new BoxGeometry(CW, CH, CD);

  const RIMD = 0.03;
  const frame = slabShape(CW + 2 * FT, CH + 2 * FT, 0.085);
  frame.holes.push(slabShape(CW, CH, 0.07));
  const rimGeo = new ExtrudeGeometry(frame, {
    depth: RIMD,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.007,
    bevelSegments: 1,
    curveSegments: 10,
  });
  rimGeo.translate(0, 0, -(RIMD + 0.01) / 2);

  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous");
  const maxAniso = useLightEnv
    ? Math.min(renderer.capabilities.getMaxAnisotropy?.() ?? 4, 4)
    : (renderer.capabilities.getMaxAnisotropy?.() ?? 8);
  const backTex = makeCardBack();
  sharpenCardTexture(backTex);
  const sideMat = new StdMat({ color: 0x0d0d10, roughness: 0.5, metalness: 0.2 });

  const faceEnvIntensity = useLightEnv ? 0 : 0.85;
  const backEnvIntensity = useLightEnv ? 0 : 0.85;
  const rimEnvIntensity = useLightEnv ? 0 : 1.6;

  for (let i = 0; i < cardCount; i++) {
    const a = (i / cardCount) * Math.PI * 2;
    const src = imageSources[i]!;

    const face = new PhysMat({
      metalness: 0.0,
      roughness: 0.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: faceEnvIntensity,
      transparent: true,
    });
    const back = new PhysMat({
      map: backTex,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.42,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      envMapIntensity: backEnvIntensity,
      transparent: true,
    });
    const side = sideMat.clone() as MeshStandardMaterial;
    side.transparent = true;

    const tex = loader.load(src);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = maxAniso;
    sharpenCardTexture(tex);
    face.map = tex;

    const cardMesh = new ThreeMesh(cardGeo, [side, side, side, side, face, back]);

    const rimMat = new PhysMat({
      color: 0xe6e9ee,
      metalness: 0.0,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.4,
      envMapIntensity: rimEnvIntensity,
      side: DoubleSide,
    });
    const rim = new ThreeMesh(rimGeo, rimMat);

    const card = new ThreeGroup();
    card.add(cardMesh);
    card.add(rim);
    card.position.set(Math.sin(a) * ORBIT_RADIUS, 0, Math.cos(a) * ORBIT_RADIUS);
    card.rotation.y = a;
    (card.userData as CardUserData).baseAngle = a;
    (card.userData as CardUserData).fade = [
      [face, 1],
      [back, 1],
      [side, 1],
      [rimMat, 0.4],
    ];
    group.add(card);
  }

  const drag = { active: false, lastX: 0, vel: 0, angle: 0 };
  const px = (e: MouseEvent | TouchEvent) =>
    "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;

  const onDown = (e: MouseEvent | TouchEvent) => {
    drag.active = true;
    drag.lastX = px(e);
    drag.vel = 0;
    host.style.cursor = "grabbing";
  };
  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!drag.active) return;
    const x = px(e);
    const dx = x - drag.lastX;
    drag.lastX = x;
    drag.angle += dx * 0.006;
    drag.vel = dx * 0.006;
    if ("cancelable" in e && e.cancelable) e.preventDefault();
  };
  const onUp = () => {
    drag.active = false;
    host.style.cursor = "grab";
  };

  host.style.cursor = "grab";
  host.style.touchAction = "pan-y";
  host.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  host.addEventListener("touchstart", onDown, { passive: true });
  host.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);

  const clock = new Clock();
  let raf = 0;
  let paused = false;
  const autoSpin = prefersReducedMotion ? 0 : AUTO_SPIN;
  const targetFrameMs = useLightEnv ? 1000 / 30 : 1000 / 60;
  let lastFrameAt = 0;

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (paused) return;
    if (useLightEnv && now - lastFrameAt < targetFrameMs) return;
    lastFrameAt = now;

    const dt = Math.min(clock.getDelta(), 0.05);
    if (!drag.active) {
      drag.angle += drag.vel;
      drag.vel *= 0.94;
      if (Math.abs(drag.vel) < 0.0008) drag.vel = 0;
      drag.angle += autoSpin * dt;
    }
    group.rotation.y = drag.angle;
    group.children.forEach((card) => {
      const ud = card.userData as CardUserData;
      const c = Math.cos(ud.baseAngle + group.rotation.y);
      let f = (c + 0.15) / 0.6;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      card.visible = f > 0.01;
      for (const [mat, base] of ud.fade) {
        mat.opacity = base * f;
      }
    });
    renderer.render(scene, cam);
  };
  requestAnimationFrame(loop);

  const resizeRenderer = () => {
    W = host.clientWidth;
    H = host.clientHeight;
    if (W < 10 || H < 10) return;
    renderer.setSize(W, H);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    cam.position.z = camZForAspect(W / H);
    group.position.x = calcGroupX();
  };

  const reparentCarousel = () => {
    const mobile = isMobileViewport();
    if (mobile === wasMobile) return;
    wasMobile = mobile;
    placeCarouselHost(host, heroSection, mobileSlot, mobile);
    window.setTimeout(resizeRenderer, 100);
  };

  const onResize = () => resizeRenderer();
  reparentCarousel();
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("resize", reparentCarousel, { passive: true });

  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      clock.getDelta();
      lastFrameAt = 0;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      host.removeEventListener("touchstart", onDown);
      host.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("resize", reparentCarousel);

      renderer.dispose();
      renderer.domElement.remove();
      cardGeo.dispose();
      rimGeo.dispose();
      backTex.dispose();
      env?.dispose();
      scene.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = mesh.material;
        if (Array.isArray(mats)) mats.forEach((m) => m.dispose());
        else if (mats) mats.dispose();
      });
    },
  };
}
