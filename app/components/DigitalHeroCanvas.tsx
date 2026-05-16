"use client";

import { useEffect, useRef } from "react";

type NodePoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
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

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(34, Math.floor((width * height) / 26000));
      nodes = Array.from({ length: count }, (_, index) => ({
        x: ((index * 157) % Math.max(width, 1)) + Math.random() * 40,
        y: ((index * 89) % Math.max(height, 1)) + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 1.1 + Math.random() * 2.4
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(239, 246, 255, 0.92)");
      gradient.addColorStop(0.42, "rgba(248, 250, 252, 0.72)");
      gradient.addColorStop(1, "rgba(236, 253, 245, 0.86)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = "rgba(15, 23, 42, 0.055)";
      context.lineWidth = 1;

      for (let x = -20; x < width + 20; x += 42) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + height * 0.16, height);
        context.stroke();
      }

      for (let y = 24; y < height; y += 42) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y + Math.sin(y * 0.01) * 18);
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

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);

          if (distance < 150) {
            context.strokeStyle = `rgba(14, 116, 144, ${0.19 - distance / 900})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      for (const node of nodes) {
        context.fillStyle = "rgba(8, 145, 178, 0.74)";
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = "rgba(15, 23, 42, 0.055)";
      context.font = "12px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.fillText("AUTH.SEQUENCE / APPROVAL.RAIL / NAVER.SA", 32, height - 32);

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
