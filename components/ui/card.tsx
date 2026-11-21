import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-card text-ink shadow-[0_1px_0_rgba(30,26,22,0.04)]", className)} {...props} />;
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("font-serif text-xl leading-snug", className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-ink-soft", className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
