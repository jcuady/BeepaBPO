"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  autoComplete?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

export function PasswordField({
  id,
  name,
  autoComplete = "current-password",
  className,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
      className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-[8px] text-slate hover:text-navy"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <IconEyeOff stroke={2} className="size-5" />
        ) : (
          <IconEye stroke={2} className="size-5" />
        )}
      </button>
    </div>
  );
}
