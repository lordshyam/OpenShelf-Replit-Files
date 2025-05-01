import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Define the schema for report form
const reportSchema = z.object({
  reportedUserId: z.number(),
  reportType: z.enum([
    "inappropriate_message", 
    "book_damage", 
    "not_returned", 
    "not_marking_returned", 
    "other"
  ]),
  description: z.string().min(10, "Please provide a detailed description").max(500, "Description is too long"),
  bookId: z.number().optional(),
  chatId: z.number().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

interface UserReportDialogProps {
  reportedUserId: number;
  reportedUsername: string;
  bookId?: number;
  bookTitle?: string;
  chatId?: number;
}

export function UserReportDialog({ reportedUserId, reportedUsername, bookId, bookTitle, chatId }: UserReportDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportedUserId,
      reportType: "inappropriate_message",
      description: "",
      bookId,
      chatId,
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: ReportFormValues) => {
      const response = await apiRequest("POST", "/api/user-reports", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you for your report. Our moderation team will review it.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: ReportFormValues) {
    reportMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Flag className="h-4 w-4 mr-1" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report User</DialogTitle>
          <DialogDescription>
            Report an issue with {reportedUsername}. Our moderation team will review your report.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reportType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a report type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="inappropriate_message">Inappropriate messages</SelectItem>
                      <SelectItem value="book_damage">Book damage</SelectItem>
                      <SelectItem value="not_returned">Book not returned</SelectItem>
                      <SelectItem value="not_marking_returned">Not marking book as returned</SelectItem>
                      <SelectItem value="other">Other issue</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the type of issue you're reporting
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide details about the issue"
                      {...field}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    Be specific and include relevant details
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {bookTitle && (
              <div className="p-2 bg-muted rounded-md text-sm">
                <p className="font-semibold">Related Book:</p>
                <p>{bookTitle}</p>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={reportMutation.isPending}
              >
                {reportMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Report
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}