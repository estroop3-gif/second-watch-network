/**
 * ApplicantMainContent - Main scrollable content area for applicant details
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollabApplication, SelectableCredit } from '@/types/applications';
import { CommunityCollab, CustomQuestion } from '@/types/community';
import { ApplicantCredit, ApplicantFullProfile } from '@/hooks/backlot/useApplicantProfile';
import { CreditsSection } from './CreditsSection';
import { ResumePDFViewer } from './ResumePDFViewer';
import {
  MessageSquare,
  FileText,
  Play,
  Video,
  Camera,
  Sparkles,
  Calendar,
  DollarSign,
  HelpCircle,
  ImageIcon,
  ExternalLink,
  Download,
  Star,
  Briefcase,
  Users,
  Film,
} from 'lucide-react';
import { ScoreBreakdown } from '@/types/applications';
import { format } from 'date-fns';

interface ApplicantMainContentProps {
  application: CollabApplication;
  collab: CommunityCollab | undefined;
  profile: ApplicantFullProfile | undefined;
  profileCredits: ApplicantCredit[];
}

export function ApplicantMainContent({
  application,
  collab,
  profile,
  profileCredits,
}: ApplicantMainContentProps) {
  const hasApplicationSummary =
    application.elevator_pitch ||
    application.cover_note ||
    application.availability_notes ||
    application.rate_expectation;

  const hasSkills =
    (application.special_skills && application.special_skills.length > 0) ||
    (profile?.skills && profile.skills.length > 0);

  const hasMatchScore = application.match_score !== null && application.match_score !== undefined;

  const hasCustomQuestions =
    application.custom_question_responses &&
    Object.keys(application.custom_question_responses).length > 0;

  // Helper to get score tier color
  const getScoreTierColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-muted-gray';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-muted-gray';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Match Score Section */}
      {hasMatchScore && application.score_breakdown && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-accent-yellow" />
              Match Score
            </CardTitle>
            <p className="text-sm text-muted-gray">
              How well this applicant matches the role requirements
            </p>
          </CardHeader>
          <CardContent>
            {/* Overall Score */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-muted-gray/10 rounded-lg">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreTierColor(application.match_score!)}`}>
                  {application.match_score}%
                </div>
                <div className="text-xs text-muted-gray mt-1">Overall Match</div>
              </div>
              <div className="flex-1 space-y-2">
                {/* Role Credits */}
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-accent-yellow" />
                  <span className="text-xs text-muted-gray w-20">Role Exp</span>
                  <div className="flex-1 bg-muted-gray/20 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBarColor(application.score_breakdown.role_credits.score)}`}
                      style={{ width: `${application.score_breakdown.role_credits.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-bone-white w-8 text-right">
                    {application.score_breakdown.role_credits.score}
                  </span>
                </div>
                {/* Experience */}
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-muted-gray w-20">Experience</span>
                  <div className="flex-1 bg-muted-gray/20 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBarColor(application.score_breakdown.experience.score)}`}
                      style={{ width: `${application.score_breakdown.experience.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-bone-white w-8 text-right">
                    {application.score_breakdown.experience.score}
                  </span>
                </div>
                {/* Network */}
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-muted-gray w-20">Network</span>
                  <div className="flex-1 bg-muted-gray/20 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBarColor(application.score_breakdown.network.score)}`}
                      style={{ width: `${application.score_breakdown.network.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-bone-white w-8 text-right">
                    {application.score_breakdown.network.score}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Role Experience Details */}
              <div className="p-3 bg-muted-gray/5 rounded-lg">
                <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-1">
                  <Film className="w-4 h-4 text-accent-yellow" />
                  Role Experience
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-green-400">Exact matches:</span>
                    <span className="text-bone-white">{application.score_breakdown.role_credits.exact_matches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-400">Dept matches:</span>
                    <span className="text-bone-white">{application.score_breakdown.role_credits.department_matches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-400">Transferable:</span>
                    <span className="text-bone-white">{application.score_breakdown.role_credits.transferable_matches}</span>
                  </div>
                </div>
              </div>

              {/* Experience Details */}
              <div className="p-3 bg-muted-gray/5 rounded-lg">
                <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-1">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  Total Experience
                </h4>
                <div className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Total credits:</span>
                    <span className="text-bone-white">{application.score_breakdown.experience.total_credits}</span>
                  </div>
                </div>
              </div>

              {/* Network Details */}
              <div className="p-3 bg-muted-gray/5 rounded-lg">
                <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4 text-purple-400" />
                  Network
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Connections:</span>
                    <span className="text-bone-white">{application.score_breakdown.network.direct_connections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Shared projects:</span>
                    <span className="text-bone-white">{application.score_breakdown.network.shared_projects}</span>
                  </div>
                  {application.score_breakdown.network.connected_to && application.score_breakdown.network.connected_to.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-muted-gray/20">
                      <span className="text-muted-gray">Connected to:</span>
                      <div className="text-bone-white mt-1">
                        {application.score_breakdown.network.connected_to.slice(0, 3).join(', ')}
                        {application.score_breakdown.network.connected_to.length > 3 && (
                          <span className="text-muted-gray"> +{application.score_breakdown.network.connected_to.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Summary */}
      {hasApplicationSummary && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Application Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Elevator Pitch */}
            {application.elevator_pitch && (
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">
                  Elevator Pitch
                </h4>
                <p className="text-bone-white whitespace-pre-wrap">
                  {application.elevator_pitch}
                </p>
              </div>
            )}

            {/* Cover Letter */}
            {application.cover_note && (
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">Cover Letter</h4>
                <p className="text-bone-white whitespace-pre-wrap">
                  {application.cover_note}
                </p>
              </div>
            )}

            {/* Availability & Rate */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-muted-gray/20">
              {application.availability_notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-gray mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Availability
                  </h4>
                  <p className="text-bone-white">{application.availability_notes}</p>
                </div>
              )}
              {application.rate_expectation && (
                <div>
                  <h4 className="text-sm font-medium text-muted-gray mb-2 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Rate Expectation
                  </h4>
                  <p className="text-bone-white">{application.rate_expectation}</p>
                </div>
              )}
            </div>

            {/* Local Hire Confirmed */}
            {application.local_hire_confirmed && (
              <div className="pt-2">
                <Badge variant="secondary">Local Hire Confirmed</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Self-Tape */}
      {application.self_tape_url && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Self-Tape
            </CardTitle>
            <p className="text-sm text-muted-gray">
              Audition tape submitted for this role
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-muted-gray/30"
              onClick={() => window.open(application.self_tape_url!, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Self-Tape
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Demo Reel - check both reel_url and demo_reel_url */}
      {(application.reel_url || application.demo_reel_url) && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="w-5 h-5" />
              Demo Reel
            </CardTitle>
            <p className="text-sm text-muted-gray">
              Applicant's demo reel
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-muted-gray/30"
              onClick={() => window.open(application.reel_url || application.demo_reel_url!, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Demo Reel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile Reels */}
      {profile?.reel_links && profile.reel_links.length > 0 && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="w-5 h-5" />
              Additional Reels
            </CardTitle>
            <p className="text-sm text-muted-gray">
              Other reels from their profile
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.reel_links.map((reelUrl, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="border-muted-gray/30"
                  onClick={() => window.open(reelUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Reel {index + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credits */}
      <CreditsSection
        highlightedCreditIds={application.selected_credit_ids || []}
        applicationCredits={application.selected_credits || []}
        profileCredits={profileCredits}
      />

      {/* Skills */}
      {hasSkills && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Special Skills from Application */}
            {application.special_skills && application.special_skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">
                  Special Skills (for this application)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {application.special_skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Skills */}
            {profile?.skills && profile.skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">
                  Skills from Profile
                </h4>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <Badge key={index} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resume */}
      {application.resume_url ? (
        <ResumePDFViewer fileUrl={application.resume_url} fileName="Applicant Resume" />
      ) : (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Resume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-gray text-sm">No resume was uploaded with this application.</p>
          </CardContent>
        </Card>
      )}

      {/* Custom Question Responses */}
      {hasCustomQuestions && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Screening Question Responses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {collab?.custom_questions?.map((question: CustomQuestion) => {
              const response =
                application.custom_question_responses?.[question.id];
              if (!response) return null;

              return (
                <div key={question.id} className="pb-4 border-b border-muted-gray/20 last:border-0 last:pb-0">
                  <h4 className="text-sm font-medium text-bone-white mb-2">
                    {question.question}
                    {question.required && (
                      <span className="text-primary-red ml-1">*</span>
                    )}
                  </h4>
                  <p className="text-muted-gray whitespace-pre-wrap">{response}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Headshot */}
      {application.headshot_url && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Headshot
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="border-muted-gray/30"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = application.headshot_url!;
                  link.download = 'headshot.jpg';
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-w-lg mx-auto">
              <img
                src={application.headshot_url}
                alt="Applicant headshot"
                className="w-full rounded-lg shadow-lg"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Metadata */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-muted-gray">
            <span>
              Applied {format(new Date(application.created_at), 'MMMM d, yyyy h:mm a')}
            </span>
            {application.is_promoted && (
              <Badge className="bg-accent-yellow text-charcoal-black">
                Promoted Application
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
