"use client";

import { useEffect, useRef, useState } from "react";

export function CursorGlow() {
  const [position, setPosition] = useState({ x: -1000, y: -1000 });
  const [isVisible, setIsVisible] = useState(false);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isVisible) setIsVisible(true);
      targetRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => setIsVisible(false);

    const tick = () => {
      setPosition({ ...targetRef.current });
      frameRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Large ambient orb */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(217,119,6,0.07), transparent 50%)`,
        }}
      />
      {/* Small sharp dot */}
      <div
        className="pointer-events-none fixed z-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: position.x,
          top: position.y,
          background: "rgba(217,119,6,0.22)",
          boxShadow: "0 0 14px 4px rgba(217,119,6,0.16)",
        }}
      />
    </>
  );
}
