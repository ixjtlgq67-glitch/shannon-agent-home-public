import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase", {
  variants: {
    variant: {
      default: "border-line bg-paper-2 text-ink-soft",
      seal: "border-transparent bg-seal text-seal-ink",
      moss: "border-transparent bg-moss text-seal-ink",
      brass: "border-transparent bg-brass text-seal-ink",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
