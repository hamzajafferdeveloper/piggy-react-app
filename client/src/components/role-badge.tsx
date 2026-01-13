import { Badge } from "@/components/ui/badge";
import { User, Shield, Settings } from "lucide-react";

type Role = "employee" | "approver" | "admin";

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const roleConfig = {
  employee: {
    label: "Employee",
    icon: User,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  approver: {
    label: "Approver",
    icon: Shield,
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  admin: {
    label: "Admin",
    icon: Settings,
    className: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  },
};

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${className} gap-1.5 font-medium`}
      data-testid={`badge-role-${role}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}
