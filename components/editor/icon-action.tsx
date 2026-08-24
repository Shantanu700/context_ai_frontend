"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * An icon-only control that says what it is on hover.
 *
 * The span between the trigger and the button is load-bearing: the button sets
 * `disabled:pointer-events-none`, which would kill the tooltip exactly when it is most
 * useful — when the control is off and the operator wants to know why.
 */
export function IconAction({
  label,
  keys,
  side = "top",
  children,
  variant = "ghost",
  size = "icon",
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
  /** Shortcut hint, shown dimmed after the label. */
  keys?: string;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button variant={variant} size={size} aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {keys && <span className="text-background/55">{keys}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
