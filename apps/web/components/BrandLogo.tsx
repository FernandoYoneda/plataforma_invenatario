"use client";

import Image from "next/image";
import { useState } from "react";

type BrandLogoProps = {
  variant?: "horizontal" | "circle";
  tone?: "light" | "dark";
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

const SOURCES = {
  horizontal: {
    light: "/branding/LOGO-CASABELLA-ESCRITA.png",
    dark: "/branding/LOGO-CASABELLA-ESCRITA-ESCURO.png",
  },
  circle: {
    light: "/branding/LOGO-CASABELLA-CIRCULO.png",
    dark: "/branding/LOGO-CASABELLA-CIRCULO-ESCURO.png",
  },
} as const;

const DIMENSIONS = {
  horizontal: { width: 672, height: 160 },
  circle: { width: 512, height: 512 },
} as const;

export default function BrandLogo({
  variant = "horizontal",
  tone = "light",
  className,
  imageClassName,
  priority = false,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = SOURCES[variant][tone];
  const dimensions = DIMENSIONS[variant];

  if (failed) {
    return (
      <span className={className}>
        <span className="brand-logo-fallback">Casabella</span>
      </span>
    );
  }

  return (
    <span className={className}>
      <Image
        src={src}
        alt="Casabella"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={imageClassName}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
