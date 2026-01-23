import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { FormSkeleton } from "@/components/loading-skeleton";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { format } from "date-fns";
import { CalendarIcon, Clock, ArrowLeft } from "lucide-react";
import type { Department } from "@shared/schema";

const formSchema = z
  .object({
    // departmentId: z.string().min(1, "Please select a department"), // Removed
    date: z.date({ required_error: "Please select a date" }),
    useTimeRange: z.boolean().default(false),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    totalHours: z.coerce.number().min(0.5).max(24),
    notes: z.string().optional(),
    files: z.array(z.instanceof(File)).optional(),
  })
  .refine(
    (data) => {
      if (data.useTimeRange) {
        return data.startTime && data.endTime;
      }
      return true;
    },
    {
      message: "Start and end time are required when using time range",
      path: ["startTime"],
    },
  );

type FormData = z.infer<typeof formSchema>;

function calculateHoursFromTimeRange(
  startTime: string,
  endTime: string,
): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const diff = endMinutes - startMinutes;

  // Calculate hours and round DOWN to nearest 0.5
  const exactHours = Math.max(0, diff / 60);
  // Example: 0.9 -> 0.5. 1.4 -> 1.0. 0.4 -> 0.
  return Math.floor(exactHours * 2) / 2;
}

export default function SubmitHours() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: departments, isLoading: departmentsLoading } = useQuery<
    Department[]
  >({
    queryKey: ["/api/departments"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // departmentId: "", // Removed
      useTimeRange: false,
      startTime: "09:00",
      endTime: "17:00",
      totalHours: 1,
      notes: "",
    },
  });

  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const totalHours = form.watch("totalHours");

  const calculatedHours =
    useTimeRange && startTime && endTime
      ? calculateHoursFromTimeRange(startTime, endTime)
      : totalHours;

  // const submitMutation = useMutation({
  //   mutationFn: async (data: FormData) => {
  //     const payload = {
  //       departmentId: data.departmentId,
  //       date: data.date.toISOString(),
  //       startTime: data.useTimeRange ? data.startTime : null,
  //       endTime: data.useTimeRange ? data.endTime : null,
  //       totalHours: data.useTimeRange
  //         ? calculateHoursFromTimeRange(data.startTime!, data.endTime!)
  //         : data.totalHours,
  //       notes: data.notes || null,
  //     };
  //     return apiRequest("POST", "/api/submissions", payload);
  //   },
  //   onSuccess: () => {
  //     toast({
  //       title: "Success",
  //       description: "Your hours submission has been sent for approval.",
  //     });
  //     queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
  //     queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  //     navigate("/records");
  //   },
  //   onError: (error: Error) => {
  //     if (isUnauthorizedError(error)) {
  //       toast({
  //         title: "Unauthorized",
  //         description: "Logging in again...",
  //         variant: "destructive",
  //       });
  //       setTimeout(() => {
  //         window.location.href = "/api/login";
  //       }, 500);
  //       return;
  //     }
  //     toast({
  //       title: "Error",
  //       description: "Failed to submit hours. Please try again.",
  //       variant: "destructive",
  //     });
  //   },
  // });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();

      // formData.append("departmentId", data.departmentId); // Removed
      formData.append("date", data.date.toISOString());
      formData.append(
        "totalHours",
        data.useTimeRange
          ? calculateHoursFromTimeRange(
              data.startTime!,
              data.endTime!,
            ).toString()
          : data.totalHours.toString(),
      );

      if (data.startTime) formData.append("startTime", data.startTime);
      if (data.endTime) formData.append("endTime", data.endTime);
      if (data.notes) formData.append("notes", data.notes);

      if (data.files && data.files.length > 0) {
        data.files.forEach((file) => {
          formData.append("files", file);
        });
      }

      const response = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("unauthorized");
        }
        throw new Error("submission_failed");
      }

      return response;
    },
    onSuccess: (response) => {
      if (response.status === 201) {
        toast({
          title: "Success",
          description: "Your hours submission has been sent for approval.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        navigate("/records");
      }
    },
    onError: (error: Error) => {
      if (error.message === "unauthorized" || isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit hours. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    submitMutation.mutate(data);
  };

  if (departmentsLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Submit Overtime Hours</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => navigate("/dashboard")}
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Submit Overtime Hours</CardTitle>
              <CardDescription>
                Enter your overtime or extra hours for approval. All submissions
                will be reviewed by your department approver.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Department Removed */}

                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date</FormLabel>
                          <Popover
                            open={isCalendarOpen}
                            onOpenChange={setIsCalendarOpen}
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                  data-testid="button-date-picker"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? format(field.value, "PPP")
                                    : "Pick a date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  field.onChange(date);
                                  setIsCalendarOpen(false);
                                }}
                                disabled={(date) => date > new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center space-x-3 py-2">
                    <Switch
                      id="time-range-toggle"
                      checked={useTimeRange}
                      onCheckedChange={(checked) => {
                        setUseTimeRange(checked);
                        form.setValue("useTimeRange", checked);
                      }}
                      data-testid="switch-time-range"
                    />
                    <Label
                      htmlFor="time-range-toggle"
                      className="cursor-pointer"
                    >
                      Use time range instead of total hours
                    </Label>
                  </div>

                  {useTimeRange ? (
                    <div className="grid gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                data-testid="input-start-time"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                data-testid="input-end-time"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="totalHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Hours</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              min="0.5"
                              max="24"
                              {...field}
                              data-testid="input-total-hours"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter the total overtime hours (0.5 - 24)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="files"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attachments (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              field.onChange(files);
                            }}
                            data-testid="input-files"
                          />
                        </FormControl>
                        <FormDescription>
                          Upload supporting documents (images, PDFs, etc.)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any additional details about this overtime submission..."
                            className="min-h-24 resize-none"
                            {...field}
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      data-testid="button-submit"
                    >
                      {submitMutation.isPending
                        ? "Submitting..."
                        : "Submit for Approval"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hours Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div
                  className="text-5xl font-bold font-mono text-primary"
                  data-testid="text-calculated-hours"
                >
                  {calculatedHours}
                </div>
                <div className="text-muted-foreground mt-2">
                  {calculatedHours === 1 ? "hour" : "hours"} to submit
                </div>
              </div>
              {useTimeRange && startTime && endTime && (
                <div className="text-sm text-muted-foreground text-center border-t pt-4 mt-4">
                  From {startTime} to {endTime}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
