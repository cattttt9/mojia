import { useEffect, useRef } from "react";
import type { ForestPeriod } from "./types";

interface ParticleCanvasProps {
  period: ForestPeriod;
  reducedMotion: boolean;
}

type Leaf = { x: number; y: number; size: number; vx: number; vy: number; angle: number; spin: number; alpha: number; phase: number; sprite: number };
type Firefly = { x: number; y: number; radius: number; speedX: number; speedY: number; phase: number; blink: number };

function createLeaves(width: number, height: number, count: number): Leaf[] {
  return Array.from({ length: count }, (_, index) => ({
    x: width * (0.08 + Math.random() * 0.92), y: Math.random() * height * 0.76,
    size: 9 + Math.random() * 9, vx: -0.015 + Math.random() * 0.035, vy: 0.018 + Math.random() * 0.038,
    angle: Math.random() * Math.PI * 2, spin: -0.0014 + Math.random() * 0.0028,
    alpha: 0.24 + Math.random() * 0.24, phase: index * 0.73, sprite: index % 3,
  }));
}

function createFireflies(width: number, height: number, count: number): Firefly[] {
  return Array.from({ length: count }, (_, index) => ({
    x: width * (0.1 + Math.random() * 0.86), y: height * (0.2 + Math.random() * 0.66), radius: 0.8 + Math.random() * 1.9,
    speedX: 0.18 + Math.random() * 0.32, speedY: 0.13 + Math.random() * 0.25,
    phase: index * 1.37 + Math.random() * 2, blink: 0.7 + Math.random() * 1.3,
  }));
}

export function ParticleCanvas({ period, reducedMotion }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !parent || !context) return;
    let frame = 0, width = 0, height = 0, lastTime = performance.now();
    let leaves: Leaf[] = [], fireflies: Firefly[] = [], inViewport = true, pageVisible = !document.hidden;
    const leafSprites = [1, 2, 3].map((index) => { const image = new Image(); image.src = `/assets/forest/particle-leaf-${index}.webp`; return image; });

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      leaves = createLeaves(width, height, reducedMotion ? 0 : 9);
      fireflies = createFireflies(width, height, reducedMotion ? 5 : 18);
    };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; }, { threshold: 0.05 });
    resizeObserver.observe(parent); intersectionObserver.observe(parent); resize();

    const drawLeaf = (leaf: Leaf) => {
      const sprite = leafSprites[leaf.sprite];
      if (!sprite.complete) return;
      context.save(); context.translate(leaf.x, leaf.y); context.rotate(leaf.angle); context.globalAlpha = leaf.alpha;
      context.drawImage(sprite, -leaf.size, -leaf.size * 0.56, leaf.size * 2, leaf.size * 1.12); context.restore();
    };
    const drawLight = (fly: Firefly, time: number, intensity: number) => {
      const pulse = 0.25 + (Math.sin(time * fly.blink + fly.phase) + 1) * 0.36;
      const gradient = context.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, fly.radius * 9);
      gradient.addColorStop(0, `rgba(255,238,156,${0.96 * pulse * intensity})`);
      gradient.addColorStop(0.32, `rgba(244,203,93,${0.38 * pulse * intensity})`);
      gradient.addColorStop(1, "rgba(244,203,93,0)");
      context.fillStyle = gradient; context.beginPath(); context.arc(fly.x, fly.y, fly.radius * 9, 0, Math.PI * 2); context.fill();
    };
    const render = (now: number) => {
      const dt = Math.min(32, now - lastTime); lastTime = now;
      if (inViewport && pageVisible) {
        const time = now / 1000; context.clearRect(0, 0, width, height);
        if (!reducedMotion) leaves.forEach((leaf) => {
          leaf.x += (leaf.vx + Math.sin(time * 0.52 + leaf.phase) * 0.046) * dt; leaf.y += leaf.vy * dt; leaf.angle += leaf.spin * dt;
          if (leaf.y > height + 20 || leaf.x < -40 || leaf.x > width + 40) { leaf.x = width * (0.34 + Math.random() * 0.72); leaf.y = -24 - Math.random() * 110; }
          drawLeaf(leaf);
        });
        fireflies.forEach((fly, index) => {
          if (period !== "night" && index > 6) return;
          fly.x += Math.sin(time * fly.speedX + fly.phase) * 0.055 * dt; fly.y += Math.cos(time * fly.speedY + fly.phase) * 0.034 * dt;
          drawLight(fly, time, period === "night" ? 1 : 0.42);
        });
      }
      frame = window.requestAnimationFrame(render);
    };
    const onVisibility = () => { pageVisible = !document.hidden; lastTime = performance.now(); };
    document.addEventListener("visibilitychange", onVisibility); frame = window.requestAnimationFrame(render);
    return () => { resizeObserver.disconnect(); intersectionObserver.disconnect(); document.removeEventListener("visibilitychange", onVisibility); window.cancelAnimationFrame(frame); };
  }, [period, reducedMotion]);
  return <canvas ref={canvasRef} className="handdrawn-forest-particles" aria-hidden="true" />;
}

