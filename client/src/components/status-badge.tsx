import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  MinusCircle,
} from "lucide-react";

type Status = "pending" | "approved" | "rejected" | "escalated" | "withdrawn";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  escalated: {
    label: "Escalated",
    icon: ArrowUpCircle,
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: MinusCircle,
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        Unknown
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${className} gap-1.5 font-medium`}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}
