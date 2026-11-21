import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus-visible:ring-2 focus-visible:ring-seal",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
