"use client";

import { useEffect, useRef } from "react";

type NodePoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
};

export function DigitalHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let nodes: NodePoint[] = [];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const baseSeed = 41;

    const pseudoRandom = (index: number) => {
      const value = Math.sin(index * 16807 + baseSeed) * 10000;
      return value - Math.floor(value);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(52, Math.floor((width * height) / 19000));
      nodes = Array.from({ length: count }, (_, index) => ({
        x: pseudoRandom(index + 1) * width,
        y: pseudoRandom(index + 19) * height,
        vx: (pseudoRandom(index + 37) - 0.5) * 0.38,
        vy: (pseudoRandom(index + 73) - 0.5) * 0.38,
        r: 0.9 + pseudoRandom(index + 101) * 2.8,
        hue: pseudoRandom(index + 127) > 0.68 ? 14 : 155
      }));
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);

      const phase = time * 0.00018;
      const gradient = context.createRadialGradient(width * 0.72, height * 0.42, 20, width * 0.72, height * 0.42, width * 0.68);
      gradient.addColorStop(0, "rgba(255, 91, 57, 0.24)");
      gradient.addColorStop(0.34, "rgba(34, 197, 94, 0.105)");
      gradient.addColorStop(0.72, "rgba(14, 17, 15, 0.92)");
      gradient.addColorStop(1, "rgba(8, 10, 9, 1)");
      context.fillStyle = "#0c0e0c";
      context.fillRect(0, 0, width, height);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const verticalGradient = context.createLinearGradient(0, 0, width, height);
      verticalGradient.addColorStop(0, "rgba(247, 242, 232, 0.05)");
      verticalGradient.addColorStop(1, "rgba(247, 242, 232, 0.01)");
      context.fillStyle = verticalGradient;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = "rgba(247, 242, 232, 0.055)";
      context.lineWidth = 1;

      for (let x = -80; x < width + 80; x += 48) {
        context.beginPath();
        context.moveTo(x + Math.sin(phase + x * 0.01) * 10, 0);
        context.lineTo(x + height * 0.22, height);
        context.stroke();
      }

      for (let y = 28; y < height; y += 48) {
        context.beginPath();
        context.moveTo(0, y + Math.cos(phase + y * 0.012) * 10);
        context.lineTo(width, y + Math.sin(phase + y * 0.01) * 22);
        context.stroke();
      }

      if (!reduceMotion) {
        for (const node of nodes) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < 0 || node.x > width) {
            node.vx *= -1;
          }

          if (node.y < 0 || node.y > height) {
            node.vy *= -1;
          }
        }
      }

      const focalX = width * (0.72 + Math.sin(phase) * 0.018);
      const focalY = height * (0.46 + Math.cos(phase * 1.3) * 0.026);

      for (let ring = 0; ring < 5; ring += 1) {
        context.strokeStyle = ring % 2 === 0 ? "rgba(255, 91, 57, 0.18)" : "rgba(61, 185, 132, 0.16)";
        context.lineWidth = ring === 0 ? 1.5 : 1;
        context.beginPath();
        context.ellipse(
          focalX,
          focalY,
          92 + ring * 58 + Math.sin(phase * 5 + ring) * 4,
          34 + ring * 28,
          phase + ring * 0.32,
          0,
          Math.PI * 2
        );
        context.stroke();
      }

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);

          if (distance < 132) {
            const opacity = Math.max(0, 0.18 - distance / 820);
            context.strokeStyle = `rgba(187, 247, 208, ${opacity})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      for (const node of nodes) {
        context.fillStyle =
          node.hue === 14 ? "rgba(255, 91, 57, 0.82)" : "rgba(110, 231, 183, 0.72)";
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = "rgba(247, 242, 232, 0.18)";
      context.font = "12px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.fillText("NAVER.SA / APPROVAL.RAIL / PAYLOAD.DRAFT", 32, height - 34);

      context.fillStyle = "rgba(255, 91, 57, 0.72)";
      context.fillRect(width - 132, 32, 72, 2);
      context.fillStyle = "rgba(110, 231, 183, 0.52)";
      context.fillRect(width - 92, 42, 44, 2);

      if (!reduceMotion) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas aria-hidden="true" className="digital-hero-canvas" ref={canvasRef} />;
}
