"use client";

import { useEffect, useRef } from "react";

const rings = [
  { className: "orbit-ring outer", direction: 1, offset: 14, seconds: 28 },
  { className: "orbit-ring middle", direction: -1, offset: 128, seconds: 34 },
  { className: "orbit-ring inner", direction: 1, offset: 242, seconds: 22 }
];

export function HeroRadarOrbit() {
  const ringRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startedAt) / 1000;

      rings.forEach((ring, index) => {
        const node = ringRefs.current[index];
        if (!node) {
          return;
        }

        const degrees = ring.offset + (elapsed / ring.seconds) * 360 * ring.direction;
        node.style.transform = `translate3d(-50%, -50%, 0) rotate(${degrees}deg)`;
      });

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="hero-orbit" aria-hidden="true">
      {rings.map((ring, index) => (
        <span
          className={ring.className}
          key={ring.className}
          ref={(node) => {
            ringRefs.current[index] = node;
          }}
        />
      ))}
      <span className="orbit-comet alpha" />
      <span className="orbit-comet beta" />
      <span className="orbit-node one" />
      <span className="orbit-node two" />
      <span className="orbit-node three" />
    </div>
  );
}
