"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Image from "next/image";
import { useEffect, useState, type PointerEvent } from "react";

type HeroLayerEntrance = "fade-rise" | "fade-up" | "rise" | "pop";

type HeroImageLayer = {
  type: "image";
  name: string;
  src: string;
  movement: number;
  direction: number;
  depth: number;
  delay: number;
  entrance: HeroLayerEntrance;
};

type HeroTextLayer = {
  type: "text";
  name: string;
  content: string;
  movement: number;
  direction: number;
  depth: number;
  delay: number;
  entrance: HeroLayerEntrance;
};

type HeroLayer = HeroImageLayer | HeroTextLayer;

const HERO_IMAGE_OVERSCAN = 1.03;
const HERO_POINTER_INPUT_RANGE = [0, 0.36, 0.5, 0.64, 1];

const HERO_LAYERS: HeroLayer[] = [
  {
    type: "image",
    name: "base",
    src: "/assets/landing/base.png",
    movement: 0,
    direction: 0,
    depth: 0,
    delay: 0,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "bookcase-3",
    src: "/assets/landing/bookcase_3.png",
    movement: 3,
    direction: 1,
    depth: 1,
    delay: 0.05,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "bookcase-2",
    src: "/assets/landing/bookcase_2.png",
    movement: 7,
    direction: 1,
    depth: 2,
    delay: 0.15,
    entrance: "fade-rise",
  },
  {
    type: "text",
    name: "title",
    content: "CORA",
    movement: 9,
    direction: -0.35,
    depth: 3,
    delay: 0.28,
    entrance: "fade-up",
  },
  {
    type: "image",
    name: "bookcase-1",
    src: "/assets/landing/bookcase_1.png",
    movement: 11,
    direction: -1,
    depth: 4,
    delay: 0.36,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "table",
    src: "/assets/landing/table.png",
    movement: 10,
    direction: -0.8,
    depth: 5,
    delay: 0.48,
    entrance: "rise",
  },
  {
    type: "image",
    name: "drawer",
    src: "/assets/landing/drawer.png",
    movement: 16,
    direction: -1,
    depth: 6,
    delay: 0.58,
    entrance: "rise",
  },
  {
    type: "image",
    name: "objects",
    src: "/assets/landing/objects.png",
    movement: 14,
    direction: -1,
    depth: 7,
    delay: 0.7,
    entrance: "pop",
  },
];

const layerInitialByEntrance: Record<
  HeroLayerEntrance,
  { opacity: number; y?: number; scale?: number }
> = {
  "fade-rise": { opacity: 0, y: 22 },
  "fade-up": { opacity: 0, y: 18, scale: 0.96 },
  rise: { opacity: 0, y: 56 },
  pop: { opacity: 0, y: 8, scale: 0.96 },
};

function isImageLayer(layer: HeroLayer): layer is HeroImageLayer {
  return layer.type === "image";
}

function useResponsiveMotionScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const syncScale = () => setScale(mediaQuery.matches ? 0 : 1);

    syncScale();
    mediaQuery.addEventListener("change", syncScale);

    return () => mediaQuery.removeEventListener("change", syncScale);
  }, []);

  return scale;
}

function HeroLayerView({
  layer,
  pointerX,
  pointerY,
  motionScale,
  shouldReduceMotion,
  ready,
}: {
  layer: HeroLayer;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  motionScale: number;
  shouldReduceMotion: boolean;
  ready: boolean;
}) {
  const movement = shouldReduceMotion ? 0 : layer.movement * motionScale;
  const directedMovement = movement * layer.direction;
  const x = useTransform(pointerX, HERO_POINTER_INPUT_RANGE, [
    -directedMovement * 1.08,
    -directedMovement * 0.34,
    0,
    directedMovement * 0.34,
    directedMovement * 1.08,
  ]);
  const y = useTransform(pointerY, HERO_POINTER_INPUT_RANGE, [
    -directedMovement * 0.38,
    -directedMovement * 0.14,
    0,
    directedMovement * 0.14,
    directedMovement * 0.38,
  ]);
  const initialState = shouldReduceMotion
    ? { opacity: 0 }
    : layerInitialByEntrance[layer.entrance];
  const animateState = ready ? { opacity: 1, y: 0, scale: 1 } : initialState;
  const transition = shouldReduceMotion
    ? { duration: 0.25, delay: 0 }
    : layer.entrance === "rise"
      ? {
          type: "spring" as const,
          damping: 24,
          stiffness: 92,
          mass: 0.9,
          delay: layer.delay,
        }
      : layer.entrance === "pop"
        ? {
            type: "spring" as const,
            damping: 18,
            stiffness: 120,
            mass: 0.7,
            delay: layer.delay,
          }
        : {
            duration: 0.9,
            delay: layer.delay,
            ease: [0.16, 1, 0.3, 1] as const,
          };

  return (
    <motion.div
      initial={false}
      animate={animateState}
      transition={transition}
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{
        x,
        y,
        zIndex: layer.depth,
        willChange: "transform, opacity",
      }}
    >
      {layer.type === "image" ? (
        <Image
          src={layer.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          fill
          priority
          sizes="100vw"
          className="pointer-events-none select-none object-contain"
          style={{
            objectPosition: "center center",
            transform: `scale(${HERO_IMAGE_OVERSCAN})`,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="font-caprasimo absolute left-1/2 top-[39%] w-full -translate-x-1/2 -translate-y-1/2 select-none text-center text-[clamp(5.2rem,12vw,11.5rem)] leading-none tracking-[0.06em] text-[#fff3d0]"
          style={{
            textShadow:
              "0 14px 30px rgba(0,0,0,0.52), 0 0 30px rgba(248,214,148,0.18)",
          }}
        >
          {layer.content}
        </div>
      )}
    </motion.div>
  );
}

export function Hero() {
  const [ready, setReady] = useState(false);
  const motionScale = useResponsiveMotionScale();
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = !!prefersReducedMotion;
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const baseLayer = HERO_LAYERS.find(
    (layer): layer is HeroImageLayer => layer.name === "base" && isImageLayer(layer)
  );
  const interactiveLayers = HERO_LAYERS.filter((layer) => layer.name !== "base");
  const pointerX = useSpring(rawX, {
    damping: 34,
    stiffness: 104,
    mass: 0.76,
  });
  const pointerY = useSpring(rawY, {
    damping: 34,
    stiffness: 104,
    mass: 0.76,
  });

  useEffect(() => {
    const activateTimer = window.setTimeout(() => {
      setReady(true);
    }, 24);

    return () => {
      window.clearTimeout(activateTimer);
    };
  }, []);

  function handlePointerMove({
    currentTarget,
    clientX,
    clientY,
  }: PointerEvent<HTMLElement>) {
    if (shouldReduceMotion || motionScale === 0) {
      return;
    }

    const { left, top, width, height } = currentTarget.getBoundingClientRect();

    rawX.set(Math.min(Math.max((clientX - left) / width, 0), 1));
    rawY.set(Math.min(Math.max((clientY - top) / height, 0), 1));
  }

  function handlePointerLeave() {
    rawX.set(0.5);
    rawY.set(0.5);
  }

  return (
    <section
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative isolate overflow-hidden bg-[#090f0d]"
    >
      <div className="relative left-1/2 mx-auto aspect-[4096/2589] w-screen -translate-x-1/2 overflow-visible">
        {baseLayer && (
          <motion.div
            initial={false}
            animate={ready ? { opacity: 1, y: 0, scale: 1 } : layerInitialByEntrance[baseLayer.entrance]}
            transition={
              shouldReduceMotion
                ? { duration: 0.25, delay: 0 }
                : {
                    duration: 0.9,
                    delay: baseLayer.delay,
                    ease: [0.16, 1, 0.3, 1] as const,
                  }
            }
            className="pointer-events-none absolute inset-0 overflow-visible"
            style={{ zIndex: baseLayer.depth, willChange: "opacity" }}
          >
            <Image
              src={baseLayer.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              fill
              priority
              sizes="100vw"
              className="pointer-events-none select-none object-contain"
              style={{
                objectPosition: "center center",
                transform: `scale(${HERO_IMAGE_OVERSCAN})`,
              }}
            />
          </motion.div>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 2,
            background:
              "radial-gradient(58% 48% at 50% 28%, rgba(246,214,149,0.2) 0%, rgba(246,214,149,0.12) 24%, rgba(246,214,149,0.05) 42%, rgba(246,214,149,0) 72%)",
            mixBlendMode: "screen",
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 8,
            background:
              "linear-gradient(180deg, rgba(2,5,4,0.16) 0%, rgba(2,5,4,0.02) 26%, rgba(2,5,4,0) 42%, rgba(2,5,4,0.12) 68%, rgba(2,5,4,0.34) 100%), radial-gradient(84% 76% at 50% 54%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.16) 100%)",
          }}
        />

        {interactiveLayers.map((layer) => (
          <HeroLayerView
            key={layer.name}
            layer={layer}
            pointerX={pointerX}
            pointerY={pointerY}
            motionScale={motionScale}
            shouldReduceMotion={shouldReduceMotion}
            ready={ready}
          />
        ))}
      </div>
    </section>
  );
}
