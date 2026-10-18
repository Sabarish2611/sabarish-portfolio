"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/use-media-query";
import { onIntroReveal } from "@/lib/intro";
import { cn } from "@/lib/cn";

/**
 * Hero visual — a "latent space": thousands of embedding-like points start as raw noise and
 * resolve into classes as the page arrives. One class (the threats) and a few outliers (the
 * anomalies) light up in the accent. The cursor probes the space; scrolling away dissolves it.
 */

const CLUSTERS = 7;
/** Which class glows: chosen per orientation so it always lands in the open band of the hero. */
const SIGNAL_CLUSTER_WIDE = 0;
const SIGNAL_CLUSTER_TALL = 5;
const ANOMALY_RATE = 0.012;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uScroll;
uniform float uMouseStrength;
uniform float uPixelRatio;
uniform float uSize;
uniform float uSignalCluster;
uniform vec3 uMouse;

attribute vec3 aTarget;
attribute vec4 aRandom; // x stagger, y size/speed, z twinkle phase, w cluster index (+100 = anomaly)

varying float vSignal;
varying float vAlpha;

void main() {
  // Every point converges on its own schedule: noise resolving into classes.
  float p = clamp(uProgress * 1.6 - aRandom.x * 0.6, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  vec3 pos = mix(position, aTarget, p);

  // Scrolling away dissolves the structure back into noise.
  pos = mix(pos, position * 1.35, uScroll * 0.85);
  pos.y += uScroll * 0.6;

  // Idle drift, calmer once clustered.
  float t = uTime * (0.18 + aRandom.y * 0.3) + aRandom.x * 6.2831853;
  pos += vec3(sin(t), cos(t * 0.87), sin(t * 0.63)) * mix(0.09, 0.035, p);

  vec4 world = modelMatrix * vec4(pos, 1.0);

  // The cursor probes the space: points part around it.
  vec2 d = world.xy - uMouse.xy;
  float dist = max(length(d), 1e-4);
  world.xy += (d / dist) * (1.0 - smoothstep(0.0, 1.25, dist)) * 0.55 * uMouseStrength;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  float anomaly = step(50.0, aRandom.w);
  float signal = max(anomaly, 1.0 - step(0.5, abs(mod(aRandom.w, 100.0) - uSignalCluster)));

  float size = uSize * (0.45 + aRandom.y) * (1.0 + signal * 0.9);
  gl_PointSize = min(size * uPixelRatio / -mv.z, 48.0);

  float twinkle = 0.7 + 0.3 * sin(uTime * (0.8 + aRandom.z * 1.6) + aRandom.z * 6.2831853);
  vSignal = signal * smoothstep(0.35, 1.0, p);
  vAlpha = mix(0.35, 1.0, p) * twinkle * (1.0 - uScroll * 0.75);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColorBase;
uniform vec3 uColorSignal;
uniform float uBaseAlpha;

varying float vSignal;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = pow(1.0 - d * 2.0, 1.4);
  vec3 color = mix(uColorBase, uColorSignal, vSignal);
  gl_FragColor = vec4(color, soft * vAlpha * mix(uBaseAlpha, 1.0, vSignal));
  #include <colorspace_fragment>
}
`;

type Uniform<T> = { value: T };
type FieldUniforms = {
  uTime: Uniform<number>;
  uProgress: Uniform<number>;
  uScroll: Uniform<number>;
  uMouse: Uniform<THREE.Vector3>;
  uMouseStrength: Uniform<number>;
  uPixelRatio: Uniform<number>;
  uSize: Uniform<number>;
  uSignalCluster: Uniform<number>;
  uColorBase: Uniform<THREE.Color>;
  uColorSignal: Uniform<THREE.Color>;
  uBaseAlpha: Uniform<number>;
};

/** Deterministic PRNG so the cloud is identical across renders, HMR and StrictMode. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCloud(count: number) {
  const rand = mulberry32(20230701);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const centers = Array.from({ length: CLUSTERS }, (_, c) => {
    const angle = (c / CLUSTERS) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const radius = 1.45 + rand() * 0.9;
    return new THREE.Vector3(Math.cos(angle) * radius * 1.45, Math.sin(angle) * radius * 0.52, (rand() - 0.5) * 1.6);
  });

  const position = new Float32Array(count * 3);
  const target = new Float32Array(count * 3);
  const random = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const cluster = Math.floor(rand() * CLUSTERS);
    const center = centers[cluster];
    const anomaly = rand() < ANOMALY_RATE;
    const spread = 0.17 + rand() * 0.26;
    position.set([gauss() * 2.9, gauss() * 1.1, gauss() * 1.4], i * 3);
    target.set([center.x + gauss() * spread, center.y + gauss() * spread, center.z + gauss() * spread], i * 3);
    random.set([rand(), rand(), rand(), cluster + (anomaly ? 100 : 0)], i * 4);
  }
  return { position, target, random };
}

function readThemeColors(base: THREE.Color, signal: THREE.Color) {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const light = root.dataset.theme === "light";
  base.set(styles.getPropertyValue("--particle").trim() || "#edeae4");
  // On the light page the raw accent is too pale to read; use its ink variant.
  signal.set(styles.getPropertyValue(light ? "--accent-ink" : "--accent").trim() || "#c6f432");
  return light;
}

function Field({ count, reduced }: { count: number; reduced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((s) => s.gl);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);

  const cloud = useMemo(() => buildCloud(count), [count]);
  // Stable: R3F copies these on mount — afterwards mutate materialRef.current.uniforms.
  const uniforms = useMemo<FieldUniforms>(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: reduced ? 1 : 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
      uMouseStrength: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 26 },
      uSignalCluster: { value: SIGNAL_CLUSTER_WIDE },
      uColorBase: { value: new THREE.Color("#edeae4") },
      uColorSignal: { value: new THREE.Color("#c6f432") },
      uBaseAlpha: { value: 0.5 },
    }),
    [reduced],
  );
  const [scratch] = useState(() => ({
    raycaster: new THREE.Raycaster(),
    plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    hit: new THREE.Vector3(),
    targetBase: new THREE.Color(),
    targetSignal: new THREE.Color(),
  }));
  const live = useRef({ ndc: new THREE.Vector2(), tilt: new THREE.Vector2(), pointer: false, scroll: 0, time: 0, introTarget: 0 });

  // Arrival: noise starts resolving when the preloader curtain lifts.
  useEffect(
    () =>
      onIntroReveal(() => {
        live.current.introTarget = 1;
      }),
    [],
  );

  // Pointer + scroll -> refs (window-level listeners; the canvas itself ignores pointer events).
  useEffect(() => {
    const canvas = gl.domElement;
    const l = live.current;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      l.ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      l.pointer = Math.abs(l.ndc.x) <= 1 && Math.abs(l.ndc.y) <= 1;
    };
    const onLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) l.pointer = false;
    };
    const onScroll = () => {
      l.scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    };
    onScroll();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [gl]);

  // Theme / accent -> colour targets (lerped in the frame loop) and blending mode.
  useEffect(() => {
    const apply = (snap: boolean) => {
      const material = materialRef.current;
      const light = readThemeColors(scratch.targetBase, scratch.targetSignal);
      if (!material) return;
      const u = material.uniforms as FieldUniforms;
      // Additive glow reads on dark; on the light page points must darken, so blend normally.
      material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      material.needsUpdate = true;
      u.uBaseAlpha.value = light ? 0.55 : 0.5;
      if (snap || reduced) {
        u.uColorBase.value.copy(scratch.targetBase);
        u.uColorSignal.value.copy(scratch.targetSignal);
      }
      invalidate();
    };
    apply(true);
    const observer = new MutationObserver(() => apply(false));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
    return () => observer.disconnect();
  }, [reduced, invalidate, scratch]);

  // Render only while visible; pause through WebGL context loss.
  useEffect(() => {
    const canvas = gl.domElement;
    let onScreen = true;
    let lost = false;
    const apply = () => {
      if (!reduced) setFrameloop(onScreen && !lost ? "always" : "never");
      if (!lost) invalidate();
    };
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (!last) return;
        onScreen = last.isIntersecting;
        apply();
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(canvas);
    const onLost = () => {
      lost = true;
      apply();
    };
    const onRestored = () => {
      lost = false;
      apply();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, reduced, setFrameloop, invalidate]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    const group = groupRef.current;
    if (!material || !group) return;
    const u = material.uniforms as FieldUniforms;
    const l = live.current;

    // Frame the cloud in the open band between the hero copy and the name; smaller on portrait.
    const aspect = state.size.width / Math.max(1, state.size.height);
    const wide = aspect > 1.1;
    group.position.set(wide ? 0.3 : 0, wide ? 0.12 : 0.15, 0);
    group.scale.setScalar(wide ? 1 : THREE.MathUtils.clamp(aspect * 1.35, 0.5, 0.9));
    u.uSignalCluster.value = wide ? SIGNAL_CLUSTER_WIDE : SIGNAL_CLUSTER_TALL;
    u.uPixelRatio.value = state.viewport.dpr;

    if (reduced) {
      u.uProgress.value = 1;
      u.uMouseStrength.value = 0;
      return;
    }

    // Own clock: setFrameloop() zeroes state.clock when pausing offscreen.
    const dt = Math.min(delta, 1 / 30);
    l.time += dt;
    u.uTime.value = l.time;
    u.uProgress.value = THREE.MathUtils.damp(u.uProgress.value, l.introTarget, 1.1, dt);
    u.uScroll.value = THREE.MathUtils.damp(u.uScroll.value, l.scroll, 6, dt);

    scratch.raycaster.setFromCamera(l.ndc, state.camera);
    const hovering = l.pointer && scratch.raycaster.ray.intersectPlane(scratch.plane, scratch.hit) !== null;
    if (hovering) {
      if (u.uMouseStrength.value < 0.01) u.uMouse.value.copy(scratch.hit);
      else u.uMouse.value.lerp(scratch.hit, 1 - Math.exp(-10 * dt));
    }
    u.uMouseStrength.value = THREE.MathUtils.damp(u.uMouseStrength.value, hovering ? 1 : 0, 4, dt);

    l.tilt.x = THREE.MathUtils.damp(l.tilt.x, l.pointer ? l.ndc.x : 0, 2, dt);
    l.tilt.y = THREE.MathUtils.damp(l.tilt.y, l.pointer ? l.ndc.y : 0, 2, dt);
    group.rotation.y = l.time * 0.035 + l.tilt.x * 0.22;
    group.rotation.x = -l.tilt.y * 0.12;

    const k = 1 - Math.exp(-4 * dt);
    u.uColorBase.value.lerp(scratch.targetBase, k);
    u.uColorSignal.value.lerp(scratch.targetSignal, k);
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cloud.position, 3]} />
          <bufferAttribute attach="attributes-aTarget" args={[cloud.target, 3]} />
          <bufferAttribute attach="attributes-aRandom" args={[cloud.random, 4]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** No WebGL (or a driver crash) must never take the page down — the hero simply has no field. */
class FieldBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LatentField({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [maxDpr, setMaxDpr] = useState(1.75);
  const [count] = useState(() =>
    navigator.hardwareConcurrency <= 4 || window.matchMedia("(pointer: coarse)").matches ? 7_000 : 14_000,
  );

  return (
    <div
      aria-hidden="true"
      className={cn("transition-opacity duration-[1600ms] ease-out", ready ? "opacity-100" : "opacity-0", className)}
    >
      <FieldBoundary>
        <Canvas
          dpr={[1, maxDpr]}
          frameloop={reduced ? "demand" : "always"}
          flat
          camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 50 }}
          gl={{ antialias: false, alpha: true, stencil: false, powerPreference: "high-performance" }}
          resize={{ scroll: false }}
          style={{ pointerEvents: "none" }}
          onCreated={() => setReady(true)}
        >
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setMaxDpr(1)}
            onIncline={() => setMaxDpr(1.75)}
            onFallback={() => setMaxDpr(1)}
          />
          <Field count={count} reduced={reduced} />
        </Canvas>
      </FieldBoundary>
    </div>
  );
}
