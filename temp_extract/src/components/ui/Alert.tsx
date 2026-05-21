import { cn } from "@/utils/cn";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "error" | "warning";
}

export function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const variants = {
    info: "bg-primary-50 text-primary-800 border-primary-200",
    success: "bg-success-50 text-success-800 border-success-200",
    error: "bg-danger-50 text-danger-800 border-danger-200",
    warning: "bg-warning-50 text-warning-800 border-warning-200",
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variants[variant],
        className
      )}
      role="alert"
      {...props}
    >
      {children}
    </div>
  );
}
