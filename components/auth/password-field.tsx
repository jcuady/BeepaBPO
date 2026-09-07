"use client";

import { useState } from "react";
import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  autoComplete?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function PasswordField({
  id,
  name,
  autoComplete = "current-password",
  className,
  placeholder,
  value,
  defaultValue,
  onChange,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate">
        <IconLock stroke={1.5} className="size-5" />
      </div>
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn("pl-10 pr-12", className)}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        {...props}
      />
      <button
        type="button"
        className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-[8px] text-slate hover:text-navy"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <IconEyeOff stroke={1.5} className="size-5" />
        ) : (
          <IconEye stroke={1.5} className="size-5" />
        )}
      </button>
    </div>
  );
}
