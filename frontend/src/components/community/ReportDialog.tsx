import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from '@/components/ui/button';
import { Loader2, Flag } from 'lucide-react';

const reportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'copyright', 'other']),
  details: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: 'thread' | 'reply';
  contentId: string;
  contentPreview?: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam', description: 'Unwanted promotional content or repetitive posts' },
  { value: 'harassment', label: 'Harassment or Bullying', description: 'Threatening, abusive, or discriminatory content' },
  { value: 'inappropriate', label: 'Inappropriate Content', description: 'Offensive, explicit, or unsuitable material' },
  { value: 'copyright', label: 'Copyright Violation', description: 'Content that infringes intellectual property rights' },
  { value: 'other', label: 'Other', description: 'Something else that violates community guidelines' },
];

const ReportDialog: React.FC<ReportDialogProps> = ({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentPreview,
}) => {
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: undefined,
      details: '',
    },
  });

  const reportMutation = useMutation({
    mutationFn: (data: ReportFormValues) => api.submitContentReport({
      content_type: contentType,
      content_id: contentId,
      reason: data.reason,
      details: data.details,
    }),
    onSuccess: () => {
      toast.success('Report submitted. Thank you for helping keep our community safe.');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('already reported')) {
        toast.error("You've already reported this content.");
      } else {
        toast.error(error.message || 'Failed to submit report');
      }
    },
  });

  const onSubmit = (values: ReportFormValues) => {
    reportMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report {contentType === 'thread' ? 'Thread' : 'Comment'}
          </DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with this content. Reports are reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        {contentPreview && (
          <div className="p-3 bg-zinc-800/50 rounded-md text-sm text-zinc-400 line-clamp-3 border border-zinc-700">
            "{contentPreview}"
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Why are you reporting this?</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REPORT_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          <div className="flex flex-col">
                            <span>{reason.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Details (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide any additional context that might help us understand the issue..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={reportMutation.isPending || !form.watch('reason')}
              >
                {reportMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Submit Report
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
