"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={handleChange}
        className={cn(
          "h-4 w-4 rounded border-[var(--color-hairline)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer accent-[var(--color-primary)]",
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };