import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  /**
   * Square brand: every frame variant resolves to the same squared outline, so
   * `frame` now only selects the lime inner accent (interlocking) or nothing.
   * The variant names are kept so existing call sites keep compiling; collapse
   * to a boolean once this component has a caller again (it currently has none).
   */
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
        "relative overflow-hidden rounded-none bg-mist ring-1 ring-line",
        frame === "none" && "ring-0",
        className,
      )}
    >
      {frame === "interlocking" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px z-10 rounded-none ring-2 ring-lime/40 ring-offset-0"
        />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={priority ? 82 : 78}
        sizes={sizes}
        className={cn(
          "object-cover object-[70%_center] md:object-right",
          imageClassName,
        )}
      />
    </div>
  );
}
