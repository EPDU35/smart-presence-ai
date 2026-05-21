import { cn } from "@/utils/cn";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  variant?: "default" | "success" | "danger" | "warning" | "primary";
}

const variantStyles = {
  default:  { icon: "bg-slate-100",      iconColor: "text-slate-600"     },
  primary:  { icon: "bg-primary-50",     iconColor: "text-primary-600"   },
  success:  { icon: "bg-success-50",     iconColor: "text-success-600"   },
  danger:   { icon: "bg-danger-50",      iconColor: "text-danger-600"    },
  warning:  { icon: "bg-warning-50",     iconColor: "text-warning-600"   },
};

const valueColors = {
  default: "text-slate-900",
  primary: "text-primary-600",
  success: "text-success-600",
  danger:  "text-danger-600",
  warning: "text-warning-600",
};

export function StatCard({ label, value, icon: Icon, trend, trendUp, variant = "default" }: StatCardProps) {
  const style = variantStyles[variant];
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={cn("mt-1 text-3xl font-bold", valueColors[variant])}>{value}</p>
          {trend && (
            <p className={cn("mt-1 text-xs font-medium", trendUp ? "text-success-600" : "text-danger-600")}>
              {trend}
            </p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5", style.icon)}>
          <Icon className={cn("h-5 w-5", style.iconColor)} />
        </div>
      </div>
    </div>
  );
}
