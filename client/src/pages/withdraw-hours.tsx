import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarIcon, Loader2, MinusCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

const formSchema = z
  .object({
    amount: z.coerce
      .number()
      .min(0.5, "Minimum withdrawal is 0.5 hours")
      .refine((val) => val % 0.5 === 0, "Amount must be in 0.5 increments"),
    date: z.date({ required_error: "Please select a date" }),
    reason: z.string().optional(),
    useTimeRange: z.boolean().default(false),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
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

export default function WithdrawHours() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: balanceData } = useQuery<{ currentBalance: number }>({
    queryKey: ["/api/user/balance"],
  });

  const availableBalance = balanceData?.currentBalance || 0;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0.5,
      date: new Date(),
      reason: "",
      useTimeRange: false,
      startTime: "09:00",
      endTime: "17:00",
    },
  });

  const useTimeRange = form.watch("useTimeRange");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");

  // Calculate hours when time range changes
  if (useTimeRange && startTime && endTime) {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const diff = endMinutes - startMinutes;
    const exactHours = Math.max(0, diff / 60);
    const calculatedAmount = Math.floor(exactHours * 2) / 2;

    if (calculatedAmount !== form.getValues("amount")) {
      form.setValue("amount", calculatedAmount);
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/withdrawals", {
        ...data,
        date: data.date.toISOString(),
        startTime: data.useTimeRange ? data.startTime : null,
        endTime: data.useTimeRange ? data.endTime : null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hours withdrawn successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: FormData) {
    if (data.amount > availableBalance) {
      form.setError("amount", {
        type: "manual",
        message: `Cannot withdraw more than available balance (${availableBalance} hours)`,
      });
      return;
    }
    mutation.mutate(data);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Withdraw Hours</h1>
        <p className="text-muted-foreground mt-2">
          Use your accumulated time bank hours for leave or other approved
          activities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Withdrawal</CardTitle>
          <CardDescription>
            Available Balance:{" "}
            <span className="font-bold text-primary">
              {availableBalance} hours
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center space-x-3 pb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useTimeRange"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={form.watch("useTimeRange")}
                    onChange={(e) =>
                      form.setValue("useTimeRange", e.target.checked)
                    }
                  />
                  <label
                    htmlFor="useTimeRange"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Use time range to calculate hours
                  </label>
                </div>
              </div>

              {useTimeRange ? (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
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
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours to Withdraw</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max={availableBalance > 0 ? availableBalance : 0.5}
                        placeholder="0.0"
                        {...field}
                        readOnly={useTimeRange}
                        className={useTimeRange ? "bg-muted" : ""}
                      />
                    </FormControl>
                    <FormDescription>
                      {useTimeRange
                        ? "Calculated from time range."
                        : "Increments of 0.5 hours."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date used</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Doctor's appointment, Personal leave..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <MinusCircle className="mr-2 h-4 w-4" />
                      Withdraw Hours
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
