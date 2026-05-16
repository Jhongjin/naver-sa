"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

const cycleMs = 5000;
const activeMs = 3000;

const meteors = [
  { angle: -10, delay: 0, length: "min(31vw, 480px)", opacity: 0.96, top: 18 },
  { angle: -14, delay: 160, length: "min(22vw, 350px)", opacity: 0.9, top: 36 },
  { angle: -7, delay: 320, length: "min(26vw, 420px)", opacity: 0.92, top: 61 },
  { angle: -12, delay: 2500, length: "min(20vw, 320px)", opacity: 0.86, top: 27 },
  { angle: -5, delay: 2700, length: "min(23vw, 360px)", opacity: 0.86, top: 72 }
];

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export function HeroMeteorLayer() {
  const meteorRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();

    const render = (now: number) => {
      const elapsed = now - startedAt;

      meteors.forEach((meteor, index) => {
        const node = meteorRefs.current[index];
        if (!node) {
          return;
        }

        const cyclePosition = (((elapsed - meteor.delay) % cycleMs) + cycleMs) % cycleMs;

        if (cyclePosition > activeMs) {
          node.style.opacity = "0";
          node.style.transform = `translate3d(-30vw, 0, 0) rotate(${meteor.angle}deg)`;
          return;
        }

        const progress = cyclePosition / activeMs;
        const x = -30 + easeOutCubic(progress) * 176;
        const fade = Math.sin(progress * Math.PI);
        node.style.opacity = (fade * meteor.opacity).toFixed(3);
        node.style.transform = `translate3d(${x.toFixed(2)}vw, 0, 0) rotate(${meteor.angle}deg)`;
      });

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="hero-white-sweep" aria-hidden="true">
      {meteors.map((meteor, index) => (
        <span
          key={`${meteor.top}-${meteor.angle}`}
          ref={(node) => {
            meteorRefs.current[index] = node;
          }}
          style={
            {
              "--meteor-angle": `${meteor.angle}deg`,
              "--meteor-length": meteor.length,
              "--meteor-top": `${meteor.top}%`
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
