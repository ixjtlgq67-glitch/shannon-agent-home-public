import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-36 w-full rounded-xl border border-line bg-card px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus-visible:ring-2 focus-visible:ring-seal",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
