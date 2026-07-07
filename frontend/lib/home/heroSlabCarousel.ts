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
import { ASSETS } from "@/constants/assets";

const AZURE = 0x1a6fff;
const CARD_COUNT = 10;
const ORBIT_RADIUS = 4.1;
const AUTO_SPIN = 0.16;

export const HERO_SLAB_CAROUSEL_SOURCES = [
  ASSETS.ds.heroSlab,
  ASSETS.ds.cards.charizard,
  ASSETS.ds.cards.lebron,
  ASSETS.ds.cards.pikachu,
  ASSETS.ds.cards.luka,
  ASSETS.ds.cards.nidoking,
  ASSETS.ds.cards.pikachuEx,
  ASSETS.ds.cards.charizard,
  ASSETS.ds.cards.lebron,
  ASSETS.ds.cards.luka,
] as const;

type FadeEntry = [Material, number];

type CardUserData = {
  baseAngle: number;
  fade: FadeEntry[];
};

/** Matches prototype `document.querySelector('.wrap')` — first 1240px page shell. */
const PAGE_SHELL_ALIGN_SELECTOR = ".tkl-wrap";

export type HeroSlabCarouselOptions = {
  host: HTMLElement;
  heroSection: HTMLElement;
  mobileSlot: HTMLElement | null;
  prefersReducedMotion?: boolean;
  imageSources?: readonly string[];
};

export type HeroSlabCarouselController = {
  dispose: () => void;
};

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
  grad.addColorStop(0.5, "#1a1a1e");
  grad.addColorStop(1, "#050506");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "rgba(26,111,255,0.5)";
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

function makeCardTexture(i: number): CanvasTexture {
  const data = [
    { t: "JORDAN LOGOMAN", s: "#b5341f", n: "PSA 10" },
    { t: "CHARIZARD 1ST ED", s: "#e0631f", n: "PSA 10" },
    { t: "LEBRON CHROME RC", s: "#3a6ea5", n: "BGS 9.5" },
    { t: "PIKACHU VMAX", s: "#f5c518", n: "CGC 9" },
    { t: "LUKA PRIZM RC", s: "#6b2fa0", n: "SGC 10" },
    { t: "NIDOKING 1ST ED", s: "#1f6b57", n: "PSA 9" },
    { t: "PIKACHU EX FA", s: "#1a6fff", n: "BGS 10" },
    { t: "CHARIZARD BASE", s: "#e0631f", n: "PSA 10" },
    { t: "LEBRON CHROME", s: "#3a6ea5", n: "SGC 9.5" },
    { t: "LUKA BASE RC", s: "#6b2fa0", n: "CGC 9.5" },
  ][i % 10]!;

  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 540;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D unavailable");

  g.fillStyle = "#0e0e10";
  g.fillRect(0, 0, 360, 540);
  g.fillStyle = "#f3f1ea";
  g.fillRect(14, 14, 332, 512);
  g.fillStyle = "#0a0a0b";
  g.fillRect(22, 22, 316, 60);
  g.fillStyle = "#1a6fff";
  g.font = "700 26px monospace";
  g.fillText("TOKENABLE", 34, 60);

  const ig = g.createLinearGradient(22, 90, 338, 430);
  ig.addColorStop(0, data.s);
  ig.addColorStop(1, "#101012");
  g.fillStyle = ig;
  g.fillRect(22, 90, 316, 348);
  g.strokeStyle = "rgba(255,255,255,.18)";
  g.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.arc(180, 264, 30 + k * 22, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#0a0a0b";
  g.font = "700 30px serif";
  g.textAlign = "center";
  g.fillText(data.t, 180, 478);
  g.textAlign = "left";
  g.fillStyle = "#1a6fff";
  g.fillRect(22, 494, 70, 24);
  g.fillStyle = "#ffffff";
  g.font = "700 14px monospace";
  g.fillText(data.n, 30, 511);
  for (let x = 110; x < 338; x += 5) {
    g.fillStyle = Math.random() > 0.5 ? "#0a0a0b" : "#f3f1ea";
    g.fillRect(x, 496, 3, 20);
  }

  const tex = new CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = SRGBColorSpace;
  return tex;
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
  g.fillStyle = "#1a6fff";
  g.font = "600 14px monospace";
  g.fillText("VAULTED • ON-CHAIN", W2 / 2, H2 / 2 + 18);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
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
    prefersReducedMotion = false,
    imageSources = HERO_SLAB_CAROUSEL_SOURCES,
  } = options;

  let wasMobile: boolean | null = null;
  const isMobileViewport = () => window.innerWidth < 768;

  placeCarouselHost(host, heroSection, mobileSlot, isMobileViewport());
  wasMobile = isMobileViewport();

  if (!host.clientWidth || !host.clientHeight) return null;

  ColorManagement.enabled = true;

  let W = host.clientWidth;
  let H = host.clientHeight;

  const renderer = new GLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new ThreeScene();
  const env = makeEnv(renderer);
  scene.environment = env;

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
  const maxAniso = renderer.capabilities.getMaxAnisotropy?.() ?? 8;
  const backTex = makeCardBack();
  const sideMat = new StdMat({ color: 0x0d0d10, roughness: 0.5, metalness: 0.2 });

  for (let i = 0; i < CARD_COUNT; i++) {
    const a = (i / CARD_COUNT) * Math.PI * 2;
    const src = imageSources[i % imageSources.length] ?? imageSources[0]!;

    const face = new PhysMat({
      metalness: 0.0,
      roughness: 0.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.85,
      transparent: true,
    });
    const back = new PhysMat({
      map: backTex,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.42,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.85,
      transparent: true,
    });
    const side = sideMat.clone() as MeshStandardMaterial;
    side.transparent = true;

    const tex = loader.load(
      src,
      undefined,
      undefined,
      () => {
        face.map = makeCardTexture(i);
        face.needsUpdate = true;
      },
    );
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = maxAniso;
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
      envMapIntensity: 1.6,
      transmission: 0.35,
      ior: 1.46,
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
  const autoSpin = prefersReducedMotion ? 0 : AUTO_SPIN;

  const loop = () => {
    raf = requestAnimationFrame(loop);
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
  loop();

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
      env.dispose();
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
