import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";

const ITEMS_PER_PAGE = 10;

interface Submission {
  id: string;
  type: "submission" | "withdrawal";
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  status: "pending" | "approved" | "rejected" | "escalated";
  description: string;
  department: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

const fetchSubmissions = async (page = 1, search = "") => {
  try {
    const res = await fetch(
      `/api/submissions/all?page=${page}&limit=${ITEMS_PER_PAGE}&search=${encodeURIComponent(search)}`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      },
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("API Error Response:", data);
      throw new Error(
        data.message ||
          `Failed to fetch submissions: ${res.status} ${res.statusText}`,
      );
    }

    console.log("API Response:", data);
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch submissions. Please try again later.",
    );
  }
};

const AllApprovals = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Submission> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: { submissions = [], total = 0 } = { submissions: [], total: 0 },
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/submissions/all", currentPage, searchTerm],
    queryFn: () => fetchSubmissions(currentPage, searchTerm),
    keepPreviousData: true,
    refetchInterval: 30000,
  });

  const updateSubmission = useMutation({
    mutationFn: async ({
      id,
      type,
      data,
    }: {
      id: string;
      type: "submission" | "withdrawal";
      data: Partial<Submission>;
    }) => {
      const endpoint =
        type === "submission"
          ? `/api/submissions/${id}`
          : `/api/withdrawals/${id}`;
      return apiRequest("PATCH", endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Submission updated successfully",
      });
      setEditingId(null);
      setEditData(null);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSubmission = useMutation({
    mutationFn: async ({
      id,
      type,
    }: {
      id: string;
      type: "submission" | "withdrawal";
    }) => {
      const endpoint =
        type === "submission"
          ? `/api/submissions/${id}`
          : `/api/withdrawals/${id}`;
      return apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Submission deleted successfully",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (submission: Submission) => {
    setEditingId(submission.id);
    setEditData({
      totalHours: submission.totalHours,
      startTime: submission.startTime,
      endTime: submission.endTime,
      description: submission.description,
      status: submission.status,
    });
  };

  const handleSave = (id: string, type: "submission" | "withdrawal") => {
    if (editData) {
      updateSubmission.mutate({ id, type, data: editData });
    }
  };

  const handleStatusChange = (status: Submission["status"]) => {
    setEditData((prev) => ({
      ...prev,
      status,
    }));
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 p-4 rounded-lg bg-red-50">
        Failed to load approvals: {(error as Error).message}
      </div>
    );
  }

  console.log(submissions);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Approval History</h1>
          <p className="text-muted-foreground">
            Review and manage all hour submissions and withdrawals
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Input
            type="search"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Time Range</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission: Submission) => (
              <TableRow key={submission.id}>
                <TableCell className="font-medium">
                  {format(new Date(submission.date), "MMM dd, yyyy")}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      submission.type === "withdrawal" ? "outline" : "default"
                    }
                  >
                    {submission.type === "submission"
                      ? "Submission"
                      : "Withdrawal"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {submission.user?.first_name || "N/A"}{" "}
                    {submission.user?.last_name || ""}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {submission.user?.email || "N/A"}
                  </div>
                </TableCell>
                <TableCell>{submission.department?.name || "N/A"}</TableCell>
                <TableCell>
                  {editingId === submission.id ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        type="time"
                        value={editData?.startTime || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData!,
                            startTime: e.target.value,
                          })
                        }
                        className="h-8 text-xs py-1"
                      />
                      <Input
                        type="time"
                        value={editData?.endTime || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData!,
                            endTime: e.target.value,
                          })
                        }
                        className="h-8 text-xs py-1"
                      />
                    </div>
                  ) : submission.startTime && submission.endTime ? (
                    `${submission.startTime} - ${submission.endTime}`
                  ) : (
                    `${submission.type === "withdrawal" ? "-" : ""}${submission.totalHours}h`
                  )}
                </TableCell>
                <TableCell>
                  {editingId === submission.id ? (
                    <Input
                      value={editData?.description || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData!,
                          description: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <div className="max-w-xs truncate">
                      {submission.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === submission.id ? (
                    <select
                      value={editData?.status}
                      onChange={(e) =>
                        handleStatusChange(
                          e.target.value as Submission["status"],
                        )
                      }
                      className="border rounded p-1 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  ) : (
                    <StatusBadge status={submission.status} />
                  )}
                </TableCell>
                <TableCell>
                  {editingId === submission.id ? (
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleSave(submission.id, submission.type)
                        }
                        disabled={updateSubmission.isLoading}
                      >
                        {updateSubmission.isLoading ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditData(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEdit(submission)}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (
                              window.confirm(
                                `Are you sure you want to delete this ${submission.type}?`,
                              )
                            ) {
                              deleteSubmission.mutate({
                                id: submission.id,
                                type: submission.type,
                              });
                            }
                          }}
                          className="cursor-pointer text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                        {submission.status === "pending" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                handleEdit(submission);
                                // We wait for state update or just use the local var
                                updateSubmission.mutate({
                                  id: submission.id,
                                  type: submission.type,
                                  data: { status: "approved" },
                                });
                              }}
                              className="cursor-pointer text-green-600"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>Approve</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                handleEdit(submission);
                                updateSubmission.mutate({
                                  id: submission.id,
                                  type: submission.type,
                                  data: { status: "rejected" },
                                });
                              }}
                              className="cursor-pointer text-red-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              <span>Reject</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {submissions.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No submissions found
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Calculate page numbers to show (current page in the middle when possible)
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllApprovals;
