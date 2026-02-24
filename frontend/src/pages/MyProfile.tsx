/**
 * MyProfile Page
 * Role-aware profile page for the currently logged-in user.
 * Shows different experiences for free, premium, filmmaker, partner, and Order/Lodge users.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useMyProfileData, type CreditDB } from '@/hooks/useMyProfileData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BadgeDisplay } from '@/components/UserBadge';
import {
  Loader2,
  User,
  Edit,
  MapPin,
  Globe,
  ExternalLink,
  Crown,
  ArrowRight,
  Sparkles,
  Film,
  Briefcase,
  Users,
  Mail,
  CheckCircle,
  XCircle,
  Video,
  Award,
  Wrench,
  Calendar,
  MessageSquare,
  Bell,
  Landmark,
  Eye,
  EyeOff,
  Star,
  Link as LinkIcon,
  Building,
} from 'lucide-react';
import { type BadgeConfig, getBadgeConfig } from '@/lib/badges';
import { OrderSection, OrderJoinCTA } from '@/components/profile/OrderSection';
import { PendingDocumentsSection } from '@/components/profile/PendingDocumentsSection';

// Profile Header Component
interface ProfileHeaderProps {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  locationVisible?: boolean;
  primaryBadge: BadgeConfig;
  secondaryBadges: BadgeConfig[];
  roleSummary: string;
  editButtonLabel: string;
  editRoute: string;
  viewMode?: 'self' | 'public';
  onToggleViewMode?: () => void;
  hasFilmmakerProfile?: boolean;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  displayName,
  email,
  avatarUrl,
  bio,
  location,
  locationVisible,
  primaryBadge,
  secondaryBadges,
  roleSummary,
  editButtonLabel,
  editRoute,
  viewMode = 'self',
  onToggleViewMode,
  hasFilmmakerProfile = false,
}) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-2 border-accent-yellow">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} />
              <AvatarFallback className="bg-muted-gray text-bone-white text-2xl">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                {/* Name and Primary Badge */}
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-heading font-bold text-bone-white">
                    {displayName}
                  </h1>
                  <BadgeDisplay badge={primaryBadge} size="md" />
                </div>

                {/* Secondary Badges */}
                {secondaryBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {secondaryBadges.map((badge) => (
                      <BadgeDisplay key={badge.role} badge={badge} size="sm" rotate={false} />
                    ))}
                  </div>
                )}

                {/* Role Summary */}
                <p className="text-muted-gray text-sm">{roleSummary}</p>

                {/* Location */}
                {location && locationVisible !== false && (
                  <div className="flex items-center gap-2 text-bone-white/80">
                    <MapPin className="h-4 w-4 text-muted-gray" />
                    <span>{location}</span>
                  </div>
                )}

                {/* Bio */}
                {bio && (
                  <p className="text-bone-white/80 text-sm mt-2 max-w-xl">{bio}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                {hasFilmmakerProfile && onToggleViewMode && (
                  <Button
                    variant="outline"
                    onClick={onToggleViewMode}
                    className="border-muted-gray text-bone-white hover:bg-muted-gray/50"
                  >
                    {viewMode === 'self' ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        View as Public
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Exit Preview
                      </>
                    )}
                  </Button>
                )}
                <Button asChild variant="outline" className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black">
                  <Link to={editRoute}>
                    <Edit className="h-4 w-4 mr-2" />
                    {editButtonLabel}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Filmmaker Profile Section - Enhanced with all fields
interface FilmmakerSectionProps {
  filmmakerProfile: NonNullable<ReturnType<typeof useMyProfileData>['filmmakerProfile']>;
  credits: CreditDB[];
}

const FilmmakerSection: React.FC<FilmmakerSectionProps> = ({ filmmakerProfile, credits }) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-accent-yellow" />
            <CardTitle className="text-xl text-bone-white">Filmmaker Profile</CardTitle>
          </div>
          <Button asChild variant="outline" size="sm" className="border-muted-gray text-bone-white hover:bg-muted-gray/50">
            <Link to="/account">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Grid: Location, Department, Experience */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Location */}
          {filmmakerProfile.location && (
            <div className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg">
              <MapPin className="h-5 w-5 text-accent-yellow mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-muted-gray uppercase">Location</h4>
                <p className="text-bone-white">{filmmakerProfile.location}</p>
              </div>
            </div>
          )}

          {/* Department */}
          {filmmakerProfile.department && (
            <div className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg">
              <Wrench className="h-5 w-5 text-accent-yellow mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-muted-gray uppercase">Department</h4>
                <p className="text-bone-white">{filmmakerProfile.department}</p>
              </div>
            </div>
          )}

          {/* Experience Level */}
          {filmmakerProfile.experience_level && (
            <div className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg">
              <Award className="h-5 w-5 text-accent-yellow mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-muted-gray uppercase">Experience</h4>
                <p className="text-bone-white">{filmmakerProfile.experience_level}</p>
              </div>
            </div>
          )}
        </div>

        {/* Availability Status */}
        <div className="flex items-center gap-4 p-4 bg-muted-gray/10 rounded-lg">
          {filmmakerProfile.accepting_work ? (
            <>
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-green-400 font-semibold">Accepting New Work</p>
                <p className="text-muted-gray text-sm">Open to new projects and collaborations</p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-muted-gray" />
              <div>
                <p className="text-muted-gray font-semibold">Not Currently Accepting Work</p>
                <p className="text-muted-gray/70 text-sm">Not available for new projects at this time</p>
              </div>
            </>
          )}
        </div>

        {/* Skills */}
        {filmmakerProfile.skills && filmmakerProfile.skills.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Skills
            </h4>
            <div className="flex flex-wrap gap-2">
              {filmmakerProfile.skills.map((skill, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-muted-gray/30 text-bone-white text-sm rounded-lg">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Available For */}
        {filmmakerProfile.available_for && filmmakerProfile.available_for.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Available For
            </h4>
            <div className="flex flex-wrap gap-2">
              {filmmakerProfile.available_for.map((item, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-accent-yellow/20 text-accent-yellow text-sm rounded-lg">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preferred Locations */}
        {filmmakerProfile.preferred_locations && filmmakerProfile.preferred_locations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Preferred Work Locations
            </h4>
            <div className="flex flex-wrap gap-2">
              {filmmakerProfile.preferred_locations.map((loc, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-blue-500/20 text-blue-300 text-sm rounded-lg">
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filmmakerProfile.contact_method && (
            <div className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg">
              <MessageSquare className="h-5 w-5 text-accent-yellow mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-muted-gray uppercase">Preferred Contact</h4>
                <p className="text-bone-white">{filmmakerProfile.contact_method}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg">
            <Mail className="h-5 w-5 text-accent-yellow mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-muted-gray uppercase">Email on Profile</h4>
              <p className="text-bone-white">{filmmakerProfile.show_email ? 'Visible' : 'Hidden'}</p>
            </div>
          </div>
        </div>

        {/* Portfolio & Links */}
        {(filmmakerProfile.portfolio_website || (filmmakerProfile.reel_links && filmmakerProfile.reel_links.length > 0)) && (
          <div className="pt-4 border-t border-muted-gray/30">
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Portfolio & Links
            </h4>
            <div className="space-y-2">
              {filmmakerProfile.portfolio_website && (
                <a
                  href={filmmakerProfile.portfolio_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-accent-yellow hover:underline p-2 bg-muted-gray/10 rounded-lg"
                >
                  <Globe className="h-4 w-4" />
                  <span className="truncate">{filmmakerProfile.portfolio_website}</span>
                  <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0" />
                </a>
              )}
              {filmmakerProfile.reel_links && filmmakerProfile.reel_links.length > 0 && (
                <div className="space-y-2">
                  {filmmakerProfile.reel_links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-accent-yellow hover:underline p-2 bg-muted-gray/10 rounded-lg"
                    >
                      <Video className="h-4 w-4" />
                      <span className="truncate">{link}</span>
                      <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credits */}
        {credits && credits.length > 0 && (
          <div className="pt-4 border-t border-muted-gray/30">
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-3 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Credits ({credits.length})
            </h4>
            <div className="space-y-3">
              {credits.slice(0, 5).map((credit) => (
                <div key={credit.id} className="p-3 bg-muted-gray/10 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-bone-white">{credit.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-gray">
                        {credit.role && <span>{credit.role}</span>}
                        {credit.role && credit.year && <span>•</span>}
                        {credit.year && <span>{credit.year}</span>}
                        {(credit.role || credit.year) && credit.project_type && <span>•</span>}
                        {credit.project_type && <span className="capitalize">{credit.project_type}</span>}
                      </div>
                    </div>
                    {credit.link && (
                      <a
                        href={credit.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-yellow hover:underline flex-shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {credit.description && (
                    <p className="text-sm text-muted-gray mt-2">{credit.description}</p>
                  )}
                </div>
              ))}
              {credits.length > 5 && (
                <p className="text-muted-gray text-sm text-center">
                  And {credits.length - 5} more credits...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// No Filmmaker Profile CTA
const NoFilmmakerProfileCTA: React.FC<{ isFilmmaker: boolean }> = ({ isFilmmaker }) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray border-dashed">
      <CardContent className="p-6 text-center">
        <Film className="h-12 w-12 text-muted-gray mx-auto mb-4" />
        {isFilmmaker ? (
          <>
            <h3 className="text-lg font-semibold text-bone-white mb-2">Complete Your Filmmaker Profile</h3>
            <p className="text-muted-gray mb-4">
              You have filmmaker access but haven't set up your public profile yet.
            </p>
            <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              <Link to="/filmmaker-onboarding">
                Create Filmmaker Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-bone-white mb-2">Become a Filmmaker</h3>
            <p className="text-muted-gray mb-4">
              Are you a filmmaker? Apply to unlock full profile features and community access.
            </p>
            <Button asChild variant="outline" className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black">
              <Link to="/apply/filmmaker">
                Apply as Filmmaker
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Partner Profile Section
interface PartnerSectionProps {
  partnerProfile: NonNullable<ReturnType<typeof useMyProfileData>['partnerProfile']>;
}

const PartnerSection: React.FC<PartnerSectionProps> = ({ partnerProfile }) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-xl text-bone-white">Partner Profile</CardTitle>
          </div>
          <Button asChild variant="outline" size="sm" className="border-muted-gray text-bone-white hover:bg-muted-gray/50">
            <Link to="/partner/profile/edit">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Organization Logo & Name */}
        <div className="flex items-center gap-4">
          {partnerProfile.logo_url && (
            <img
              src={partnerProfile.logo_url}
              alt={partnerProfile.organization_name || 'Organization'}
              className="h-16 w-16 object-contain rounded"
            />
          )}
          <div>
            {partnerProfile.organization_name && (
              <h3 className="text-lg font-semibold text-bone-white">{partnerProfile.organization_name}</h3>
            )}
            {partnerProfile.organization_type && (
              <p className="text-muted-gray text-sm capitalize">{partnerProfile.organization_type}</p>
            )}
          </div>
        </div>

        {/* Location */}
        {(partnerProfile.city || partnerProfile.region) && (
          <div className="flex items-center gap-2 text-bone-white/80">
            <MapPin className="h-4 w-4 text-muted-gray" />
            <span>{[partnerProfile.city, partnerProfile.region].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {/* Description */}
        {partnerProfile.description && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">About</h4>
            <p className="text-bone-white/80">{partnerProfile.description}</p>
          </div>
        )}

        {/* Website */}
        {partnerProfile.website_url && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Website</h4>
            <a
              href={partnerProfile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-yellow hover:underline flex items-center gap-1"
            >
              <Globe className="h-4 w-4" />
              {partnerProfile.website_url}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Contact Email */}
        {partnerProfile.contact_email && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Contact</h4>
            <p className="text-bone-white">{partnerProfile.contact_email}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// No Partner Profile CTA
const NoPartnerProfileCTA: React.FC<{ isPartner: boolean }> = ({ isPartner }) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray border-dashed">
      <CardContent className="p-6 text-center">
        <Briefcase className="h-12 w-12 text-muted-gray mx-auto mb-4" />
        {isPartner ? (
          <>
            <h3 className="text-lg font-semibold text-bone-white mb-2">Complete Your Partner Profile</h3>
            <p className="text-muted-gray mb-4">
              Set up your organization's profile to connect with filmmakers.
            </p>
            <Button asChild className="bg-blue-500 text-white hover:bg-blue-600">
              <Link to="/partner/profile/edit">
                Create Partner Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-bone-white mb-2">Partner with Us</h3>
            <p className="text-muted-gray mb-4">
              Have a church, brand, or organization? Apply to become a partner.
            </p>
            <Button asChild variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white">
              <Link to="/partners/apply">
                Apply as Partner
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Premium/Free Profile Section
const BasicProfileSection: React.FC<{
  isPremium: boolean;
  profile: ReturnType<typeof useMyProfileData>['profile'];
}> = ({ isPremium, profile }) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPremium ? (
              <Sparkles className="h-5 w-5 text-purple-400" />
            ) : (
              <User className="h-5 w-5 text-muted-gray" />
            )}
            <CardTitle className="text-xl text-bone-white">
              {isPremium ? 'Premium Profile' : 'Profile'}
            </CardTitle>
          </div>
          <Button asChild variant="outline" size="sm" className="border-muted-gray text-bone-white hover:bg-muted-gray/50">
            <Link to="/account">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile?.full_name && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Name</h4>
            <p className="text-bone-white">{profile.full_name}</p>
          </div>
        )}

        {(profile as any)?.display_name && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Display Name</h4>
            <p className="text-bone-white">{(profile as any).display_name}</p>
          </div>
        )}

        {(profile as any)?.bio && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Bio</h4>
            <p className="text-bone-white/80">{(profile as any).bio}</p>
          </div>
        )}

        {isPremium && (
          <div className="pt-4 border-t border-muted-gray">
            <h4 className="text-sm font-semibold text-purple-400 uppercase mb-2">Premium Benefits</h4>
            <ul className="text-sm text-bone-white/70 space-y-1">
              <li>• Enhanced profile visibility</li>
              <li>• Green Room voting access</li>
              <li>• Priority community features</li>
              <li>• Exclusive content access</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Admin Profile Section
const AdminSection: React.FC<{
  isSuperadmin: boolean;
  isAdmin: boolean;
  profile: ReturnType<typeof useMyProfileData>['profile'];
}> = ({ isSuperadmin, isAdmin, profile }) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuperadmin ? (
              <Crown className="h-5 w-5 text-red-500" />
            ) : (
              <Crown className="h-5 w-5 text-accent-yellow" />
            )}
            <CardTitle className="text-xl text-bone-white">
              {isSuperadmin ? 'Superadmin Profile' : 'Admin Profile'}
            </CardTitle>
          </div>
          <Button asChild variant="outline" size="sm" className="border-muted-gray text-bone-white hover:bg-muted-gray/50">
            <Link to="/account">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile?.full_name && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Name</h4>
            <p className="text-bone-white">{profile.full_name}</p>
          </div>
        )}

        {(profile as any)?.display_name && (
          <div>
            <h4 className="text-sm font-semibold text-muted-gray uppercase mb-1">Display Name</h4>
            <p className="text-bone-white">{(profile as any).display_name}</p>
          </div>
        )}

        {/* Admin Quick Access Panel */}
        <div className="pt-4 border-t border-muted-gray">
          <h4 className={`text-sm font-semibold uppercase mb-3 ${isSuperadmin ? 'text-red-400' : 'text-accent-yellow'}`}>
            Admin Tools
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="w-full justify-start border-muted-gray text-bone-white hover:bg-muted-gray/50">
              <Link to="/admin">
                <Crown className="h-4 w-4 mr-2" />
                Admin Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start border-muted-gray text-bone-white hover:bg-muted-gray/50">
              <Link to="/admin/users">
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start border-muted-gray text-bone-white hover:bg-muted-gray/50">
              <Link to="/admin/content">
                <Film className="h-4 w-4 mr-2" />
                Content Moderation
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start border-muted-gray text-bone-white hover:bg-muted-gray/50">
              <Link to="/admin/reports">
                <MessageSquare className="h-4 w-4 mr-2" />
                Reports
              </Link>
            </Button>
          </div>
        </div>

        {isSuperadmin && (
          <div className="pt-4 border-t border-muted-gray">
            <h4 className="text-sm font-semibold text-red-400 uppercase mb-3">Superadmin Tools</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="w-full justify-start border-red-600/50 text-red-300 hover:bg-red-600/20">
                <Link to="/admin/system">
                  <Wrench className="h-4 w-4 mr-2" />
                  System Settings
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start border-red-600/50 text-red-300 hover:bg-red-600/20">
                <Link to="/admin/roles">
                  <Award className="h-4 w-4 mr-2" />
                  Role Management
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Roles & Upgrades Panel
const RolesUpgradesPanel: React.FC<{
  isFilmmaker: boolean;
  isPartner: boolean;
  isPremium: boolean;
  isOrderMember: boolean;
}> = ({ isFilmmaker, isPartner, isPremium, isOrderMember }) => {
  const upgrades = [];

  if (!isFilmmaker) {
    upgrades.push({
      title: 'Filmmaker',
      description: 'Submit projects, build your portfolio, and connect with the community.',
      cta: 'Apply',
      route: '/apply/filmmaker',
      icon: Film,
      color: 'accent-yellow',
    });
  }

  if (!isPartner) {
    upgrades.push({
      title: 'Partner',
      description: 'Churches, brands, and organizations can sponsor and hire filmmakers.',
      cta: 'Apply',
      route: '/partners/apply',
      icon: Briefcase,
      color: 'blue-400',
    });
  }

  if (!isPremium && !isFilmmaker) {
    upgrades.push({
      title: 'Premium',
      description: 'Unlock enhanced features, Green Room voting, and exclusive content.',
      cta: 'Upgrade',
      route: '/subscriptions',
      icon: Sparkles,
      color: 'purple-400',
    });
  }

  if (!isOrderMember) {
    upgrades.push({
      title: 'The Order',
      description: 'Join an elite network of Christian filmmakers. By invitation or application.',
      cta: 'Learn More',
      route: '/order',
      icon: Landmark,
      color: 'emerald-400',
    });
  }

  if (upgrades.length === 0) {
    return null;
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-bone-white flex items-center gap-2">
          <Users className="h-5 w-5 text-accent-yellow" />
          Roles & Upgrades
        </CardTitle>
        <CardDescription className="text-muted-gray">
          Unlock more features and community access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {upgrades.map((upgrade) => (
          <div
            key={upgrade.title}
            className="flex items-center justify-between gap-3 p-3 bg-muted-gray/10 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <upgrade.icon className={`h-5 w-5 text-${upgrade.color}`} />
              <div>
                <p className="font-medium text-bone-white text-sm">{upgrade.title}</p>
                <p className="text-xs text-muted-gray line-clamp-1">{upgrade.description}</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-accent-yellow hover:bg-accent-yellow/10 flex-shrink-0">
              <Link to={upgrade.route}>
                {upgrade.cta}
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// Public Profile Preview Component - Shows how others see your profile
interface PublicProfilePreviewProps {
  profile: ReturnType<typeof useMyProfileData>['profile'];
  filmmakerProfile: ReturnType<typeof useMyProfileData>['filmmakerProfile'];
  credits: CreditDB[];
  username?: string;
}

const PublicProfilePreview: React.FC<PublicProfilePreviewProps> = ({
  profile,
  filmmakerProfile,
  credits,
  username,
}) => {
  if (!filmmakerProfile) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-muted-gray mb-4" />
          <p className="text-bone-white">No public filmmaker profile to preview.</p>
          <p className="text-muted-gray text-sm mt-2">
            Complete your filmmaker profile to see how others will view it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayUsername = username || profile?.username || 'user';

  return (
    <div className="space-y-6">
      {/* Preview Banner */}
      <div className="bg-accent-yellow/20 border border-accent-yellow/50 rounded-lg p-4 flex items-center gap-3">
        <Eye className="h-5 w-5 text-accent-yellow" />
        <div className="flex-1">
          <p className="text-bone-white font-medium">Public Profile Preview</p>
          <p className="text-muted-gray text-sm">This is how others see your profile at /filmmaker/{displayUsername}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Avatar className="w-32 h-32 mb-4 border-4 border-muted-gray">
                <AvatarImage src={filmmakerProfile.profile_image_url || profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted-gray"><User className="w-16 h-16 text-bone-white" /></AvatarFallback>
              </Avatar>
              <h1 className="text-2xl font-bold font-heading">{filmmakerProfile.full_name || profile?.full_name}</h1>
              {(profile as any)?.display_name && (
                <p className="text-lg text-accent-yellow -mt-1">{(profile as any).display_name}</p>
              )}
              <p className="text-muted-gray">@{displayUsername}</p>
              {filmmakerProfile.accepting_work && (
                <Badge variant="secondary" className="mt-2 bg-green-500/20 text-green-300 border-green-500/50">
                  Accepting Work
                </Badge>
              )}
              <div className="w-full mt-4">
                <Button variant="outline" className="w-full" disabled>
                  <Mail className="mr-2 h-4 w-4" /> Connect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader><CardTitle className="text-lg font-heading">Contact & Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {filmmakerProfile.show_email && profile?.email && (
                <Button variant="outline" className="w-full" disabled>
                  <Mail className="mr-2 h-4 w-4" /> Contact via Email
                </Button>
              )}
              {!filmmakerProfile.show_email && (
                <p className="text-muted-gray text-sm text-center">Email hidden from public</p>
              )}
              {filmmakerProfile.portfolio_website && (
                <Button variant="outline" className="w-full" disabled>
                  <LinkIcon className="mr-2 h-4 w-4" /> Portfolio
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader><CardTitle className="text-lg font-heading">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {filmmakerProfile.location && (
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-gray" /> {filmmakerProfile.location}</p>
              )}
              {filmmakerProfile.department && (
                <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-gray" /> {filmmakerProfile.department}</p>
              )}
              {filmmakerProfile.experience_level && (
                <p className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-gray" /> {filmmakerProfile.experience_level}</p>
              )}
              {filmmakerProfile.contact_method && (
                <p className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-gray" /> Prefers: {filmmakerProfile.contact_method}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="updates">Updates</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6 space-y-8">
              {filmmakerProfile.bio && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">About Me</CardTitle></CardHeader>
                  <CardContent className="prose prose-invert prose-sm max-w-none"><p>{filmmakerProfile.bio}</p></CardContent>
                </Card>
              )}
              {filmmakerProfile.skills && filmmakerProfile.skills.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Skills</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {filmmakerProfile.skills.map((skill: string) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                  </CardContent>
                </Card>
              )}
              {filmmakerProfile.reel_links && filmmakerProfile.reel_links.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Reels</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {filmmakerProfile.reel_links.map((link: string, index: number) => (
                      <p key={index} className="flex items-center gap-2 text-accent-yellow text-sm">
                        <Film className="h-4 w-4" /> {link}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}
              {credits && credits.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Credits</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {credits.slice(0, 5).map((credit) => (
                        <li key={credit.id}>
                          <p className="font-semibold">{credit.role}</p>
                          <p className="text-sm text-muted-gray flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {credit.title}
                            {credit.year && ` (${credit.year})`}
                          </p>
                        </li>
                      ))}
                      {credits.length > 5 && (
                        <p className="text-muted-gray text-sm">And {credits.length - 5} more...</p>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="updates" className="mt-6">
              <Card className="bg-charcoal-black/50 border-muted-gray/20">
                <CardContent className="p-8 text-center text-muted-gray">
                  Status updates will appear here
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="projects" className="mt-6">
              <Card className="bg-charcoal-black/50 border-muted-gray/20">
                <CardContent className="p-8 text-center text-muted-gray">
                  Featured projects will appear here
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="availability" className="mt-6">
              <Card className="bg-charcoal-black/50 border-muted-gray/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    {filmmakerProfile.accepting_work ? (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        <div>
                          <p className="text-green-400 font-semibold">Accepting New Work</p>
                          <p className="text-muted-gray text-sm">Open to new projects and collaborations</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-6 w-6 text-muted-gray" />
                        <div>
                          <p className="text-muted-gray font-semibold">Not Currently Accepting Work</p>
                          <p className="text-muted-gray/70 text-sm">Not available for new projects at this time</p>
                        </div>
                      </>
                    )}
                  </div>
                  {filmmakerProfile.available_for && filmmakerProfile.available_for.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-muted-gray uppercase mb-2">Available For</p>
                      <div className="flex flex-wrap gap-2">
                        {filmmakerProfile.available_for.map((item: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="bg-accent-yellow/20 text-accent-yellow">{item}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {filmmakerProfile.preferred_locations && filmmakerProfile.preferred_locations.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-muted-gray uppercase mb-2">Preferred Locations</p>
                      <div className="flex flex-wrap gap-2">
                        {filmmakerProfile.preferred_locations.map((loc: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-blue-300 border-blue-500/50">{loc}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

// Main MyProfile Page Component
const MyProfile: React.FC = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'self' | 'public'>('self');

  // Use enriched profile for badges (consistent with nav bar)
  const enrichedProfile = useEnrichedProfile();

  // Use profile data hook for detailed profile content
  const profileData = useMyProfileData();

  const {
    profile,
    filmmakerProfile,
    partnerProfile,
    orderMemberProfile,
    lodgeMemberships,
    orderProfileSettings,
    credits,
    primaryRoleMode,
    hasFilmmakerProfile,
    hasPartnerProfile,
    hasOrderProfile,
    isLoading: profileDataLoading,
    isError,
  } = profileData;

  // Get badge info from enriched profile (same source as nav bar)
  const {
    primaryBadge,
    allBadges,
    isSuperadmin,
    isAdmin,
    isFilmmaker,
    isPartner,
    isPremium,
    isOrderMember,
    isLodgeOfficer,
    isLoading: enrichedLoading,
  } = enrichedProfile;

  const isLoading = profileDataLoading || enrichedLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-bone-white">Could not load profile data. Please try again.</p>
        <Button asChild className="mt-4">
          <Link to="/login">Log In</Link>
        </Button>
      </div>
    );
  }

  // Compute header values
  const displayName = profile?.full_name || profile?.username || user.email?.split('@')[0] || 'User';
  const email = user.email || '';
  // Prefer profile table (updated on upload), fall back to auth metadata, then filmmaker profile
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || filmmakerProfile?.profile_image_url as string | null | undefined;
  const bio = filmmakerProfile?.bio || (profile as any)?.bio as string | null | undefined;
  const location = filmmakerProfile?.location || (profile as any)?.location as string | null | undefined;
  const locationVisible = (profile as any)?.location_visible;

  // Secondary badges (all except primary)
  const secondaryBadges = allBadges.filter(b => b.role !== primaryBadge.role);

  // Role summary text
  const roleSummaryParts: string[] = [];
  if (isSuperadmin) roleSummaryParts.push('Superadmin');
  else if (isAdmin) roleSummaryParts.push('Admin');
  if (isFilmmaker) roleSummaryParts.push('Filmmaker');
  if (isPartner) roleSummaryParts.push('Partner');
  if (isOrderMember) roleSummaryParts.push('Order Member');
  if (isLodgeOfficer) roleSummaryParts.push('Lodge Officer');
  if (isPremium && !isFilmmaker && !isPartner) roleSummaryParts.push('Premium');
  if (roleSummaryParts.length === 0) roleSummaryParts.push('Free Member');
  const roleSummary = roleSummaryParts.join(' • ');

  // Determine edit button and route
  let editButtonLabel = 'Edit Profile';
  let editRoute = '/account';

  return (
    <div className="container mx-auto px-4 max-w-6xl py-8 md:py-12">
      {/* Page Title */}
      <h1 className="text-3xl md:text-5xl font-heading tracking-tighter mb-8 -rotate-1">
        My <span className="font-spray text-accent-yellow">Profile</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns on desktop */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header */}
          <ProfileHeader
            displayName={displayName}
            email={email}
            avatarUrl={avatarUrl}
            bio={bio}
            location={location}
            locationVisible={locationVisible}
            primaryBadge={primaryBadge}
            secondaryBadges={secondaryBadges}
            roleSummary={roleSummary}
            editButtonLabel={editButtonLabel}
            editRoute={editRoute}
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode(viewMode === 'self' ? 'public' : 'self')}
            hasFilmmakerProfile={hasFilmmakerProfile}
          />

          {/* Public Profile Preview */}
          {viewMode === 'public' ? (
            <PublicProfilePreview
              profile={profile}
              filmmakerProfile={filmmakerProfile}
              credits={credits}
              username={profile?.username}
            />
          ) : (
            <>
          {/* Order Section */}
          {hasOrderProfile ? (
            <OrderSection
              orderProfile={orderMemberProfile}
              lodgeMembership={lodgeMemberships.find(m => m.status === 'active') || null}
              settings={orderProfileSettings}
              orderBadge={getBadgeConfig('order_member')}
              lodgeOfficerBadge={isLodgeOfficer ? getBadgeConfig('lodge_officer') : undefined}
              isOwner={true}
              viewerIsOrderMember={true}
              isLodgeOfficer={isLodgeOfficer}
            />
          ) : (
            <OrderJoinCTA />
          )}

          {/* Primary Role-Specific Section */}
          {(primaryRoleMode === 'superadmin' || primaryRoleMode === 'admin') && (
            <AdminSection isSuperadmin={isSuperadmin} isAdmin={isAdmin} profile={profile} />
          )}

          {primaryRoleMode === 'filmmaker' && (
            hasFilmmakerProfile && filmmakerProfile ? (
              <FilmmakerSection filmmakerProfile={filmmakerProfile} credits={credits} />
            ) : (
              <NoFilmmakerProfileCTA isFilmmaker={isFilmmaker} />
            )
          )}

          {primaryRoleMode === 'partner' && (
            hasPartnerProfile && partnerProfile ? (
              <PartnerSection partnerProfile={partnerProfile} />
            ) : (
              <NoPartnerProfileCTA isPartner={isPartner} />
            )
          )}

          {(primaryRoleMode === 'premium' || primaryRoleMode === 'free') && (
            <BasicProfileSection isPremium={isPremium} profile={profile} />
          )}

          {/* Secondary Role Sections (non-primary) */}
          {primaryRoleMode !== 'filmmaker' && isFilmmaker && (
            hasFilmmakerProfile && filmmakerProfile ? (
              <FilmmakerSection filmmakerProfile={filmmakerProfile} credits={credits} />
            ) : (
              <NoFilmmakerProfileCTA isFilmmaker={isFilmmaker} />
            )
          )}

          {primaryRoleMode !== 'partner' && isPartner && (
            hasPartnerProfile && partnerProfile ? (
              <PartnerSection partnerProfile={partnerProfile} />
            ) : (
              <NoPartnerProfileCTA isPartner={isPartner} />
            )
          )}
            </>
          )}
        </div>

        {/* Sidebar - 1 column on desktop */}
        <div className="space-y-6">
          {/* Pending Documents (Signing Portal) */}
          <PendingDocumentsSection />

          {/* Roles & Upgrades Panel */}
          <RolesUpgradesPanel
            isFilmmaker={isFilmmaker}
            isPartner={isPartner}
            isPremium={isPremium}
            isOrderMember={isOrderMember}
          />

          {/* Quick Links */}
          <Card className="bg-charcoal-black/50 border-muted-gray">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-bone-white">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="ghost" className="w-full justify-start text-bone-white hover:bg-muted-gray/50">
                <Link to="/account">
                  <Edit className="h-4 w-4 mr-2" />
                  Account Settings
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start text-bone-white hover:bg-muted-gray/50">
                <Link to="/account/subscription-settings">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Subscription & Billing
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start text-bone-white hover:bg-muted-gray/50">
                <Link to="/notifications">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start text-bone-white hover:bg-muted-gray/50">
                <Link to="/messages">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
