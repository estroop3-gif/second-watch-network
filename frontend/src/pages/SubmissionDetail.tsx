import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type Submission = {
  id: string;
  project_title: string;
  status: string;
  project_type: string | null;
  created_at: string;
  name: string;
  email: string;
  logline: string | null;
  description: string | null;
  youtube_link: string | null;
};

const statusBadgeVariant = (status?: string): "default" | "secondary" | "destructive" | "partner" => {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "partner"; // green
  if (s === "rejected") return "destructive";
  if (s === "pending" || s === "in review" || s === "considered") return "secondary";
  return "default";
};

export default function SubmissionDetail() {
  const { submissionId } = useParams();
  const [highlight, setHighlight] = useState(true);

  const { data, isLoading } = useQuery<Submission | null>({
    queryKey: ["submission", submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Submission | null;
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => setHighlight(false), 2000);
    return () => window.clearTimeout(t);
  }, []);

  const createdAt = useMemo(
    () => (data?.created_at ? format(new Date(data.created_at), "PPP p") : ""),
    [data?.created_at]
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-muted-gray/10 border-muted-gray/20">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="font-heading text-2xl md:text-3xl text-accent-yellow">
            {isLoading ? <Skeleton className="h-8 w-48" /> : data?.project_title || "Submission"}
          </CardTitle>
          <Button asChild variant="outline">
            <Link to="/my-submissions">Back to My Submissions</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : data ? (
            <>
              <div
                className={`inline-flex items-center gap-3 rounded-md px-3 py-2 transition ${highlight ? "ring-2 ring-accent-yellow" : ""}`}
                aria-live="polite"
              >
                <Badge variant={statusBadgeVariant(data.status)} className="capitalize">
                  {data.status}
                </Badge>
                <span className="text-sm text-muted-foreground">Created {createdAt}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{data.project_type || "—"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Submitter</p>
                  <p className="font-medium">{data.name} <span className="text-muted-foreground">({data.email})</span></p>
                </div>
              </div>

              {data.logline && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Logline</p>
                  <p className="font-medium">{data.logline}</p>
                </div>
              )}

              {data.description && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{data.description}</p>
                </div>
              )}

              {data.youtube_link && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">YouTube</p>
                  <a href={data.youtube_link} target="_blank" rel="noreferrer" className="text-accent-yellow underline break-all">
                    {data.youtube_link}
                  </a>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Submission not found or you don’t have access.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}