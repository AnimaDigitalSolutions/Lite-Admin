import * as React from "react";

import { cn } from "@/lib/utils";

// Tighter padding on phones by default. When the caller sets its own padding,
// fall back to the original fixed default so its overrides behave as before
// (a responsive `sm:` default would otherwise win on wider screens).
const hasPadding = (className?: string) =>
  /(^|\s)p[xytrbl]?-/.test(className ?? "");

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5",
      hasPadding(className) ? "p-6" : "p-4 sm:p-6",
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  // Responsive default size, skipped when the caller sets its own text size
  // (an `sm:` default would otherwise override e.g. `text-sm` on wider screens)
  const hasSize = /(^|\s)text-(xs|sm|base|lg|[2-9]?xl)(\s|$)/.test(
    className ?? "",
  );
  return (
    <h3
      ref={ref}
      className={cn(
        "font-semibold leading-none tracking-tight",
        !hasSize && "text-lg leading-tight sm:text-2xl sm:leading-none",
        className,
      )}
      {...props}
    />
  );
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      hasPadding(className) ? "p-6 pt-0" : "p-4 pt-0 sm:p-6 sm:pt-0",
      className,
    )}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center",
      hasPadding(className) ? "p-6 pt-0" : "p-4 pt-0 sm:p-6 sm:pt-0",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
