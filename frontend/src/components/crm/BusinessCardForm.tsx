import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Save, Send, Upload, Loader2, Globe, Instagram, Linkedin, Twitter,
  User, Building2, Briefcase, Mail, Phone,
} from 'lucide-react';
import {
  useMyBusinessCard,
  useSaveBusinessCard,
  useUploadBusinessCardLogo,
  useSubmitBusinessCard,
} from '@/hooks/crm/useBusinessCards';
import { useEmailAccount } from '@/hooks/crm/useEmail';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useToast } from '@/hooks/use-toast';

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: 'bg-muted-gray/30 text-bone-white border-muted-gray/50',
  submitted: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/50',
  approved: 'bg-green-500/20 text-green-400 border-green-500/50',
  printed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  rejected: 'bg-primary-red/20 text-primary-red border-primary-red/50',
};

const BusinessCardForm = () => {
  const { profile } = useEnrichedProfile();
  const { data: card, isLoading: cardLoading } = useMyBusinessCard();
  const { data: emailAccount } = useEmailAccount();
  const saveDraft = useSaveBusinessCard();
  const uploadLogo = useUploadBusinessCardLogo();
  const submitCard = useSubmitBusinessCard();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SWN side form state (editable fields)
  const [swnTitle, setSwnTitle] = useState('Sales Representative');
  const [swnPhone, setSwnPhone] = useState('');

  // Personal side form state
  const [personalName, setPersonalName] = useState('');
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [personalWebsite, setPersonalWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');

  // Logo preview
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Populate form from existing card data
  useEffect(() => {
    if (card) {
      setSwnTitle(card.swn_title || 'Sales Representative');
      setSwnPhone(card.swn_phone || '');
      setPersonalName(card.personal_name || '');
      setPersonalTitle(card.personal_title || '');
      setPersonalEmail(card.personal_email || '');
      setPersonalPhone(card.personal_phone || '');
      setPersonalWebsite(card.personal_website || '');
      setInstagram(card.instagram || '');
      setLinkedin(card.linkedin || '');
      setTwitter(card.twitter || '');
      if (card.logo_url) {
        setLogoPreview(card.logo_url);
      }
    }
  }, [card]);

  // Auto-fill SWN phone from profile if not yet set
  useEffect(() => {
    if (!swnPhone && profile?.phone) {
      setSwnPhone(profile.phone);
    }
  }, [profile]);

  const swnName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : '';
  const swnEmail = emailAccount?.email_address || '';
  const swnDisplayName = emailAccount?.display_name || swnName;
  const currentStatus = card?.status || 'draft';
  const isLocked = currentStatus === 'submitted' || currentStatus === 'approved' || currentStatus === 'printed';

  const handleLogoClick = () => {
    if (isLocked) return;
    fileInputRef.current?.click();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    uploadLogo.mutate(file, {
      onSuccess: () => {
        toast({ title: 'Logo uploaded', description: 'Your logo has been saved.' });
      },
      onError: () => {
        toast({ title: 'Upload failed', description: 'Could not upload logo. Try again.', variant: 'destructive' });
      },
    });
  };

  const handleSaveDraft = () => {
    saveDraft.mutate(
      {
        swn_title: swnTitle,
        swn_phone: swnPhone,
        personal_name: personalName,
        personal_title: personalTitle,
        personal_email: personalEmail,
        personal_phone: personalPhone,
        personal_website: personalWebsite,
        instagram,
        linkedin,
        twitter,
      },
      {
        onSuccess: () => {
          toast({ title: 'Draft saved', description: 'Your business card draft has been saved.' });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to save draft.', variant: 'destructive' });
        },
      },
    );
  };

  const handleSubmit = () => {
    submitCard.mutate(undefined, {
      onSuccess: () => {
        toast({ title: 'Submitted for review', description: 'Your business card has been submitted for admin approval.' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to submit. Make sure you have saved a draft first.', variant: 'destructive' });
      },
    });
  };

  if (cardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-accent-yellow" />
      </div>
    );
  }

  // ---- Card Preview Components ----

  const SWNCardPreview = () => (
    <div className="bg-[#1a1a1a] rounded-xl p-6 border border-muted-gray/20 aspect-[1.75/1] flex flex-col justify-between relative overflow-hidden">
      {/* Subtle accent bar at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-accent-yellow" />

      <div className="space-y-1 pt-2">
        <p className="text-accent-yellow font-heading text-xs tracking-[0.3em] uppercase font-bold">
          Second Watch Network
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-bone-white font-heading text-lg font-bold leading-tight">
            {swnDisplayName || 'Your Name'}
          </p>
          <p className="text-accent-yellow text-xs font-medium mt-0.5">
            {swnTitle || 'Sales Representative'}
          </p>
        </div>

        <div className="space-y-1">
          {swnEmail && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3 text-muted-gray flex-shrink-0" />
              <span className="text-bone-white/80 text-[11px]">{swnEmail}</span>
            </div>
          )}
          {swnPhone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-muted-gray flex-shrink-0" />
              <span className="text-bone-white/80 text-[11px]">{swnPhone}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const PersonalCardPreview = () => (
    <div className="bg-[#1a1a1a] rounded-xl p-6 border border-muted-gray/20 aspect-[1.75/1] flex flex-col justify-between relative overflow-hidden">
      {/* Logo in top-right corner */}
      {logoPreview && (
        <div className="absolute top-4 right-4 w-12 h-12 rounded-full overflow-hidden border border-muted-gray/30">
          <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-bone-white font-heading text-lg font-bold leading-tight">
          {personalName || 'Your Name'}
        </p>
        <p className="text-accent-yellow text-xs font-medium">
          {personalTitle || 'Your Title'}
        </p>
      </div>

      <div className="space-y-1">
        {personalEmail && (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-gray flex-shrink-0" />
            <span className="text-bone-white/80 text-[11px]">{personalEmail}</span>
          </div>
        )}
        {personalPhone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-gray flex-shrink-0" />
            <span className="text-bone-white/80 text-[11px]">{personalPhone}</span>
          </div>
        )}
        {personalWebsite && (
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 text-muted-gray flex-shrink-0" />
            <span className="text-bone-white/80 text-[11px]">{personalWebsite}</span>
          </div>
        )}

        {/* Social links row */}
        {(instagram || linkedin || twitter) && (
          <div className="flex items-center gap-3 pt-1">
            {instagram && (
              <div className="flex items-center gap-1">
                <Instagram className="h-3 w-3 text-muted-gray" />
                <span className="text-bone-white/60 text-[10px]">@{instagram.replace(/^@/, '')}</span>
              </div>
            )}
            {linkedin && (
              <div className="flex items-center gap-1">
                <Linkedin className="h-3 w-3 text-muted-gray" />
                <span className="text-bone-white/60 text-[10px]">{linkedin}</span>
              </div>
            )}
            {twitter && (
              <div className="flex items-center gap-1">
                <Twitter className="h-3 w-3 text-muted-gray" />
                <span className="text-bone-white/60 text-[10px]">@{twitter.replace(/^@/, '')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bone-white font-heading">Business Card</h1>
          <p className="text-muted-gray text-sm mt-1">
            Customize your SWN business card for print
          </p>
        </div>
        <Badge
          variant="outline"
          className={STATUS_BADGE_STYLES[currentStatus] || STATUS_BADGE_STYLES.draft}
        >
          {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        </Badge>
      </div>

      {/* Rejected Notes */}
      {currentStatus === 'rejected' && card?.admin_notes && (
        <div className="rounded-lg border border-primary-red/30 bg-primary-red/10 p-4">
          <p className="text-sm font-medium text-primary-red mb-1">Rejection Reason</p>
          <p className="text-sm text-bone-white/80">{card.admin_notes}</p>
        </div>
      )}

      {/* Submitted notice */}
      {isLocked && (
        <div className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-4">
          <p className="text-sm text-accent-yellow">
            Your card has been {currentStatus}. Editing is disabled until it is reviewed or returned.
          </p>
        </div>
      )}

      {/* Two Column Layout: Preview (left) + Form (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Column: Card Previews */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-gray mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent-yellow" />
              SWN Side Preview
            </h3>
            <SWNCardPreview />
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-gray mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-accent-yellow" />
              Personal Side Preview
            </h3>
            <PersonalCardPreview />
          </div>
        </div>

        {/* Right Column: Form Fields */}
        <div className="space-y-6">
          {/* SWN Section */}
          <Card className="bg-[#2a2a2a] border-muted-gray/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-bone-white text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent-yellow" />
                SWN Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-gray">
                Name and email are auto-filled from your account. Title and phone can be customized.
              </p>

              <div>
                <Label className="text-muted-gray text-xs">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    value={swnName}
                    disabled
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white/60 pl-10 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Title</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    value={swnTitle}
                    onChange={(e) => setSwnTitle(e.target.value)}
                    placeholder="Sales Representative"
                    disabled={isLocked}
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    value={swnEmail}
                    disabled
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white/60 pl-10 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Work Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    value={swnPhone}
                    onChange={(e) => setSwnPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    disabled={isLocked}
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Section */}
          <Card className="bg-[#2a2a2a] border-muted-gray/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-bone-white text-base flex items-center gap-2">
                <User className="h-5 w-5 text-accent-yellow" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-gray">
                Customize this side with your personal contact info and branding.
              </p>

              {/* Logo Upload */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleLogoClick}
                  disabled={isLocked}
                  className="w-20 h-20 rounded-full border-2 border-dashed border-muted-gray/50 flex items-center justify-center overflow-hidden hover:border-accent-yellow/50 transition-colors cursor-pointer flex-shrink-0 bg-muted-gray/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-muted-gray/50"
                  title="Click to upload logo"
                >
                  {uploadLogo.isPending ? (
                    <Loader2 className="h-6 w-6 text-accent-yellow animate-spin" />
                  ) : logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-gray" />
                  )}
                </button>
                <div className="text-xs text-muted-gray">
                  <p className="font-medium text-bone-white/80">Logo / Headshot</p>
                  <p>Click the circle to upload. PNG or JPG recommended.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Name</Label>
                <Input
                  value={personalName}
                  onChange={(e) => setPersonalName(e.target.value)}
                  placeholder="Your name as it appears on the card"
                  disabled={isLocked}
                  className="bg-charcoal-black border-muted-gray/30 text-bone-white disabled:text-bone-white/60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Title</Label>
                <Input
                  value={personalTitle}
                  onChange={(e) => setPersonalTitle(e.target.value)}
                  placeholder="e.g. Director of Photography"
                  disabled={isLocked}
                  className="bg-charcoal-black border-muted-gray/30 text-bone-white disabled:text-bone-white/60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={isLocked}
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    value={personalPhone}
                    onChange={(e) => setPersonalPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    disabled={isLocked}
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-gray text-xs">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    value={personalWebsite}
                    onChange={(e) => setPersonalWebsite(e.target.value)}
                    placeholder="https://yoursite.com"
                    disabled={isLocked}
                    className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div>
                <Label className="text-muted-gray text-xs mb-2 block">Social Links</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                    <Input
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="@handle"
                      disabled={isLocked}
                      className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                    <Input
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="linkedin.com/in/yourname"
                      disabled={isLocked}
                      className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="relative">
                    <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                    <Input
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="@handle"
                      disabled={isLocked}
                      className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10 disabled:text-bone-white/60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saveDraft.isPending || isLocked}
          className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
        >
          {saveDraft.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saveDraft.isPending ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitCard.isPending || isLocked}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          {submitCard.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {submitCard.isPending ? 'Submitting...' : 'Submit for Approval'}
        </Button>
      </div>
    </div>
  );
};

export default BusinessCardForm;
