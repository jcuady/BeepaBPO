import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  /** interlocking: brand corners; soft: rounded; blend: edge fade into page; none: raw */
  frame?: "interlocking" | "soft" | "blend" | "none";
};

export function ResponsiveImageFrame({
  src,
  alt,
  priority = false,
  className,
  imageClassName,
  sizes = "(max-width: 768px) 100vw, 55vw",
  frame = "interlocking",
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-mist",
        frame === "interlocking" &&
          "rounded-tl-[24px] rounded-br-[24px] rounded-tr-[8px] rounded-bl-[8px] ring-1 ring-line",
        frame === "soft" && "rounded-[16px] ring-1 ring-line",
        frame === "blend" && "hero-image-blend rounded-[28px] md:rounded-[36px]",
        className,
      )}
    >
      {frame === "interlocking" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px z-10 rounded-tl-[24px] rounded-br-[24px] rounded-tr-[8px] rounded-bl-[8px] ring-2 ring-lime/40 ring-offset-0"
        />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={priority ? 70 : 75}
        sizes={sizes}
        className={cn(
          "object-cover object-[70%_center] md:object-right",
          imageClassName,
        )}
      />
    </div>
  );
}
