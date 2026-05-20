import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { User } from "@/types";

interface EmployeeCardProps {
  employee: User;
  onClick?: () => void;
}

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  return (
    <Card className="cursor-pointer hover:border-primary-300 transition-colors" onClick={onClick}>
      <CardContent className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
          {employee.firstname[0]}{employee.lastname[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {employee.firstname} {employee.lastname}
          </p>
          <p className="truncate text-xs text-slate-500">{employee.email}</p>
        </div>
        <Badge variant={employee.role === "EMPLOYEE" ? "default" : "success"}>
          {employee.role}
        </Badge>
      </CardContent>
    </Card>
  );
}
