import { Loader2Icon } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils.ts";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>): React.ReactElement {
  return (
    <Loader2Icon
      aria-label="正在加载"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
