"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

const particles = [
  { x: 0.08, y: 0.24, dx: 90, dy: -28, size: 7, phase: 0, period: 5200, accent: "green" },
  { x: 0.16, y: 0.62, dx: 132, dy: 42, size: 5, phase: 740, period: 6100, accent: "orange" },
  { x: 0.28, y: 0.38, dx: -94, dy: 62, size: 8, phase: 1320, period: 5700, accent: "green" },
  { x: 0.38, y: 0.72, dx: 148, dy: -58, size: 6, phase: 2140, period: 6800, accent: "orange" },
  { x: 0.49, y: 0.22, dx: -118, dy: 72, size: 9, phase: 310, period: 5400, accent: "green" },
  { x: 0.57, y: 0.52, dx: 112, dy: -84, size: 6, phase: 1720, period: 5000, accent: "orange" },
  { x: 0.68, y: 0.28, dx: -104, dy: 92, size: 8, phase: 2460, period: 6500, accent: "green" },
  { x: 0.76, y: 0.64, dx: 128, dy: -34, size: 5, phase: 910, period: 5900, accent: "green" },
  { x: 0.86, y: 0.42, dx: -150, dy: 54, size: 9, phase: 2840, period: 7200, accent: "orange" },
  { x: 0.94, y: 0.72, dx: -108, dy: -76, size: 6, phase: 4200, period: 6300, accent: "green" }
];

export function HeroMotionLayer() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const particleRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const layer = layerRef.current;

    if (!layer) {
      return;
    }

    let animationFrame = 0;

    const tick = (time: number) => {
      const { width, height } = layer.getBoundingClientRect();

      particles.forEach((particle, index) => {
        const element = particleRefs.current[index];

        if (!element) {
          return;
        }

        const progress = ((time + particle.phase) % particle.period) / particle.period;
        const orbit = progress * Math.PI * 2;
        const driftX = Math.cos(orbit) * particle.dx + Math.sin(orbit * 0.5) * 28;
        const driftY = Math.sin(orbit) * particle.dy + Math.cos(orbit * 0.75) * 22;
        const pulse = 0.82 + Math.sin(orbit * 1.8) * 0.24;
        const x = particle.x * width + driftX;
        const y = particle.y * height + driftY;

        element.style.opacity = String(0.42 + Math.max(0, pulse - 0.72));
        element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${pulse})`;
      });

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="hero-motion-layer" ref={layerRef}>
      {particles.map((particle, index) => (
        <span
          className={`hero-motion-dot ${particle.accent}`}
          key={`${particle.x}-${particle.y}`}
          ref={(element) => {
            particleRefs.current[index] = element;
          }}
          style={{ "--dot-size": `${particle.size}px` } as CSSProperties & Record<"--dot-size", string>}
        />
      ))}
      <span className="hero-motion-vector one" />
      <span className="hero-motion-vector two" />
      <span className="hero-motion-vector three" />
    </div>
  );
}
