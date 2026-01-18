import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Submission } from "@/types";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import SubmissionMessaging from "../shared/SubmissionMessaging";
import { api } from "@/lib/api";
import {
  Play,
  User,
  FileText,
  Clock,
  Building2,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Calendar,
  Film,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";

interface SubmissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
}

interface SubmitterProfile {
  profile: {
    id: string;
    full_name: string;
    username: string;
    email: string;
    avatar_url: string;
    bio: string;
    created_at: string;
    is_filmmaker: boolean;
    is_order_member: boolean;
    is_partner: boolean;
    is_premium: boolean;
  } | null;
  filmmaker_profile: {
    full_name: string;
    bio: string;
    skills: string[];
    experience_level: string;
    department: string;
    portfolio_url: string;
    reel_url: string;
    location: string;
    accepting_work: boolean;
  } | null;
  submissions: Array<{
    id: string;
    project_title: string;
    project_type: string;
    status: string;
    created_at: string;
    company_name: string;
    submitter_role: string;
    years_experience: number;
  }>;
  activity_history: Array<{
    id: string;
    activity_type: string;
    activity_details: any;
    created_at: string;
  }>;
  total_submissions: number;
  approved_submissions: number;
  is_orphaned: boolean;
  email?: string;
}

const statusColorClasses: Record<string, string> = {
  pending: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  'in review': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  considered: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  approved: 'bg-green-400/20 text-green-300 border-green-400/30',
  rejected: 'bg-red-400/20 text-red-300 border-red-400/30',
  archived: 'bg-gray-400/20 text-gray-500 border-gray-400/30',
  shortlisted: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
  flagged: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
};

function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }

    if (urlObj.hostname.includes('youtube.com')) {
      const vParam = urlObj.searchParams.get('v');
      if (vParam) return vParam;

      const pathMatch = urlObj.pathname.match(/\/(embed|v)\/([^/?]+)/);
      if (pathMatch) return pathMatch[2];
    }

    return null;
  } catch {
    return null;
  }
}

function formatActivityType(type: string): string {
  const mapping: Record<string, string> = {
    submission_created: "Created submission",
    submission_updated: "Updated submission",
    login: "Logged in",
    profile_updated: "Updated profile",
  };
  return mapping[type] || type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const SubmissionDetailsModal = ({ isOpen, onClose, submission }: SubmissionDetailsModalProps) => {
  const [activeTab, setActiveTab] = useState("details");
  const [submitterProfile, setSubmitterProfile] = useState<SubmitterProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (isOpen && submission?.id) {
      loadSubmitterProfile(submission.id);
    }
  }, [isOpen, submission?.id]);

  const loadSubmitterProfile = async (submissionId: string) => {
    setLoadingProfile(true);
    try {
      const profile = await api.getSubmitterProfile(submissionId);
      setSubmitterProfile(profile);
    } catch (error) {
      console.error("Failed to load submitter profile:", error);
      setSubmitterProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  if (!submission) return null;

  const videoUrl = (submission as any).youtube_link || (submission as any).video_url;
  const videoId = extractYouTubeId(videoUrl);
  const title = (submission as any).project_title || (submission as any).title || 'Untitled';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-heading">{title}</DialogTitle>
          <DialogDescription>
            Submitted by {submission.profiles?.full_name || submission.profiles?.username || (submission as any).filmmaker?.full_name || 'Unknown'} on {new Date(submission.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 w-fit">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="submitter" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Submitter Profile
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden p-6 pt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="h-full m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                {/* Left Column - Details */}
                <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2">
                  <div>
                    <h3 className="font-semibold mb-2">Status</h3>
                    <Badge variant="outline" className={cn("capitalize", statusColorClasses[submission.status] || statusColorClasses.pending)}>
                      {submission.status}
                    </Badge>
                  </div>

                  {/* Video Preview */}
                  {videoId && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Video Preview
                      </h3>
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-muted-gray/30">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title="Video Preview"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    </div>
                  )}

                  {submission.email && (
                    <div>
                      <h3 className="font-semibold mb-2">Submitter Email</h3>
                      <a
                        href={`mailto:${submission.email}`}
                        className="text-sm text-accent-yellow hover:underline break-all"
                      >
                        {submission.email}
                      </a>
                    </div>
                  )}

                  {/* Professional Info */}
                  {((submission as any).company_name || (submission as any).submitter_role || (submission as any).years_experience) && (
                    <div className="border border-muted-gray/30 rounded-lg p-3 space-y-2">
                      <h3 className="font-semibold text-sm text-muted-gray uppercase">Professional Info</h3>
                      {(submission as any).company_name && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-gray" />
                          <span>{(submission as any).company_name}</span>
                        </div>
                      )}
                      {(submission as any).submitter_role && (
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="h-4 w-4 text-muted-gray" />
                          <span className="capitalize">{(submission as any).submitter_role}</span>
                        </div>
                      )}
                      {(submission as any).years_experience && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-gray" />
                          <span>{(submission as any).years_experience} years experience</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(submission as any).project_type && (
                    <div>
                      <h3 className="font-semibold mb-2">Project Type</h3>
                      <p className="text-sm text-muted-foreground">{(submission as any).project_type}</p>
                    </div>
                  )}

                  {(submission as any).logline && (
                    <div>
                      <h3 className="font-semibold mb-2">Logline</h3>
                      <p className="text-sm text-muted-foreground">{(submission as any).logline}</p>
                    </div>
                  )}

                  {submission.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.description}</p>
                    </div>
                  )}

                  {videoUrl && (
                    <div>
                      <h3 className="font-semibold mb-2">Video Link</h3>
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent-yellow hover:underline break-all"
                      >
                        {videoUrl}
                      </a>
                    </div>
                  )}
                </div>

                {/* Right Column - Messaging */}
                <div className="md:col-span-2 bg-charcoal-black/50 rounded-lg flex flex-col overflow-hidden border border-muted-gray/20">
                  <h3 className="font-semibold p-4 border-b border-muted-gray/20">Communication Center</h3>
                  {(submission.profiles?.id || (submission as any).filmmaker?.id) ? (
                    <SubmissionMessaging
                      submissionId={submission.id}
                      submissionUserId={submission.profiles?.id || (submission as any).filmmaker?.id}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-gray">
                      <p>No messaging available for this submission</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Submitter Profile Tab */}
            <TabsContent value="submitter" className="h-full m-0">
              {loadingProfile ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
                </div>
              ) : submitterProfile?.is_orphaned ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <AlertCircle className="h-16 w-16 text-muted-gray mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Orphaned Submission</h3>
                  <p className="text-muted-gray max-w-md">
                    This submission was made before the authentication requirement was implemented and is not linked to a user account.
                  </p>
                  {submitterProfile.email && (
                    <p className="mt-4 text-sm">
                      Contact email:{" "}
                      <a href={`mailto:${submitterProfile.email}`} className="text-accent-yellow hover:underline">
                        {submitterProfile.email}
                      </a>
                    </p>
                  )}
                </div>
              ) : submitterProfile?.profile ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                  {/* Profile Info Column */}
                  <div className="space-y-4 overflow-y-auto">
                    {/* Profile Card */}
                    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={submitterProfile.profile.avatar_url} />
                          <AvatarFallback className="bg-accent-yellow text-charcoal-black text-xl">
                            {submitterProfile.profile.full_name?.charAt(0) || submitterProfile.profile.username?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {submitterProfile.profile.full_name || submitterProfile.profile.username}
                          </h3>
                          {submitterProfile.profile.username && submitterProfile.profile.full_name && (
                            <p className="text-sm text-muted-gray">@{submitterProfile.profile.username}</p>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {submitterProfile.profile.is_filmmaker && (
                          <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                            Filmmaker
                          </Badge>
                        )}
                        {submitterProfile.profile.is_order_member && (
                          <Badge className="bg-purple-400/20 text-purple-300 border-purple-400/30">
                            Order Member
                          </Badge>
                        )}
                        {submitterProfile.profile.is_partner && (
                          <Badge className="bg-blue-400/20 text-blue-300 border-blue-400/30">
                            Partner
                          </Badge>
                        )}
                        {submitterProfile.profile.is_premium && (
                          <Badge className="bg-green-400/20 text-green-300 border-green-400/30">
                            Premium
                          </Badge>
                        )}
                      </div>

                      {/* Contact & Join Date */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-gray" />
                          <a href={`mailto:${submitterProfile.profile.email}`} className="text-accent-yellow hover:underline">
                            {submitterProfile.profile.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-gray" />
                          <span className="text-muted-gray">
                            Member since {new Date(submitterProfile.profile.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {submitterProfile.profile.bio && (
                        <div className="mt-4 pt-4 border-t border-muted-gray/20">
                          <p className="text-sm text-muted-gray">{submitterProfile.profile.bio}</p>
                        </div>
                      )}
                    </div>

                    {/* Submission Stats */}
                    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Submission Stats</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-charcoal-black rounded-lg">
                          <div className="text-2xl font-bold text-accent-yellow">
                            {submitterProfile.total_submissions}
                          </div>
                          <div className="text-xs text-muted-gray">Total</div>
                        </div>
                        <div className="text-center p-3 bg-charcoal-black rounded-lg">
                          <div className="text-2xl font-bold text-green-400">
                            {submitterProfile.approved_submissions}
                          </div>
                          <div className="text-xs text-muted-gray">Approved</div>
                        </div>
                      </div>
                    </div>

                    {/* Filmmaker Profile */}
                    {submitterProfile.filmmaker_profile && (
                      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Film className="h-4 w-4" />
                          Filmmaker Profile
                        </h4>
                        <div className="space-y-2 text-sm">
                          {submitterProfile.filmmaker_profile.department && (
                            <div>
                              <span className="text-muted-gray">Department: </span>
                              {submitterProfile.filmmaker_profile.department}
                            </div>
                          )}
                          {submitterProfile.filmmaker_profile.experience_level && (
                            <div>
                              <span className="text-muted-gray">Experience: </span>
                              {submitterProfile.filmmaker_profile.experience_level}
                            </div>
                          )}
                          {submitterProfile.filmmaker_profile.location && (
                            <div>
                              <span className="text-muted-gray">Location: </span>
                              {submitterProfile.filmmaker_profile.location}
                            </div>
                          )}
                          {submitterProfile.filmmaker_profile.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {submitterProfile.filmmaker_profile.skills.map((skill, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* All Submissions Column */}
                  <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg flex flex-col overflow-hidden">
                    <h4 className="font-semibold p-4 border-b border-muted-gray/20">
                      All Submissions ({submitterProfile.submissions.length})
                    </h4>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-3">
                        {submitterProfile.submissions.map((sub) => (
                          <div
                            key={sub.id}
                            className={cn(
                              "p-3 rounded-lg border",
                              sub.id === submission.id
                                ? "border-accent-yellow bg-accent-yellow/10"
                                : "border-muted-gray/20 bg-charcoal-black"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium truncate">{sub.project_title}</h5>
                                <p className="text-xs text-muted-gray">{sub.project_type}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn("text-xs capitalize shrink-0", statusColorClasses[sub.status])}
                              >
                                {sub.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-gray mt-1">
                              {new Date(sub.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                        {submitterProfile.submissions.length === 0 && (
                          <p className="text-center text-muted-gray text-sm py-8">
                            No submissions found
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Activity History Column */}
                  <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg flex flex-col overflow-hidden">
                    <h4 className="font-semibold p-4 border-b border-muted-gray/20">
                      Activity History
                    </h4>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-2">
                        {submitterProfile.activity_history.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-charcoal-black/50"
                          >
                            <div className="w-2 h-2 rounded-full bg-accent-yellow mt-2 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {formatActivityType(activity.activity_type)}
                              </p>
                              {activity.activity_details?.project_title && (
                                <p className="text-xs text-muted-gray truncate">
                                  {activity.activity_details.project_title}
                                </p>
                              )}
                              <p className="text-xs text-muted-gray">
                                {new Date(activity.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                        {submitterProfile.activity_history.length === 0 && (
                          <p className="text-center text-muted-gray text-sm py-8">
                            No activity history available
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <AlertCircle className="h-16 w-16 text-muted-gray mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Profile Not Found</h3>
                  <p className="text-muted-gray max-w-md">
                    Unable to load the submitter's profile information.
                  </p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionDetailsModal;
