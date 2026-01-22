/**
 * CreditsSection - Displays credits with highlighted/other separation
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SelectableCredit } from '@/types/applications';
import { ApplicantCredit } from '@/hooks/backlot/useApplicantProfile';
import { Star, Film, Tv, Video, Clapperboard } from 'lucide-react';

interface CreditsSectionProps {
  highlightedCreditIds: string[];
  applicationCredits: SelectableCredit[];
  profileCredits: ApplicantCredit[];
}

function CreditCard({
  credit,
  isHighlighted,
}: {
  credit: SelectableCredit | ApplicantCredit;
  isHighlighted?: boolean;
}) {
  // Determine icon based on production type or department
  const getIcon = () => {
    const type =
      'production_type' in credit
        ? credit.production_type
        : credit.department?.toLowerCase();

    if (type?.includes('film') || type?.includes('feature')) {
      return <Film className="w-4 h-4" />;
    }
    if (type?.includes('tv') || type?.includes('series') || type?.includes('episodic')) {
      return <Tv className="w-4 h-4" />;
    }
    if (type?.includes('commercial') || type?.includes('music')) {
      return <Video className="w-4 h-4" />;
    }
    return <Clapperboard className="w-4 h-4" />;
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        isHighlighted
          ? 'bg-accent-yellow/10 border-accent-yellow/30'
          : 'bg-charcoal-black/50 border-muted-gray/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-md ${
            isHighlighted ? 'bg-accent-yellow/20' : 'bg-muted-gray/10'
          }`}
        >
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-bone-white truncate">
              {credit.project_title}
            </h4>
            {isHighlighted && (
              <Star className="w-4 h-4 text-accent-yellow fill-accent-yellow shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-gray">{credit.role}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {credit.year && (
              <span className="text-xs text-muted-gray">{credit.year}</span>
            )}
            {credit.department && (
              <Badge variant="outline" className="text-xs capitalize">
                {credit.department}
              </Badge>
            )}
            {credit.role_type && (
              <Badge variant="secondary" className="text-xs capitalize">
                {credit.role_type.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreditsSection({
  highlightedCreditIds,
  applicationCredits,
  profileCredits,
}: CreditsSectionProps) {
  // Get highlighted credits (those selected for this application)
  const highlightedCredits = applicationCredits.filter((c) =>
    highlightedCreditIds.includes(c.id)
  );

  // Get other credits from profile that aren't highlighted
  const highlightedIdSet = new Set(highlightedCreditIds);
  const otherCredits = profileCredits.filter((c) => !highlightedIdSet.has(c.id));

  const hasHighlighted = highlightedCredits.length > 0;
  const hasOther = otherCredits.length > 0;

  if (!hasHighlighted && !hasOther) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Highlighted Credits */}
      {hasHighlighted && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-accent-yellow" />
              Highlighted for this Role
            </CardTitle>
            <p className="text-sm text-muted-gray">
              Credits the applicant selected as most relevant
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {highlightedCredits.map((credit) => (
                <CreditCard key={credit.id} credit={credit} isHighlighted />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Credits */}
      {hasOther && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Other Credits</CardTitle>
            <p className="text-sm text-muted-gray">
              Additional credits from their profile
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {otherCredits.map((credit) => (
                <CreditCard key={credit.id} credit={credit} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
