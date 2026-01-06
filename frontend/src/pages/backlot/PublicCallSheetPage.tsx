/**
 * PublicCallSheetPage - Public view for shared call sheets (no auth required)
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  FileText,
  Calendar,
  Clock,
  MapPin,
  Mail,
  Phone,
  Users,
  Download,
  AlertTriangle,
  Heart,
  Car,
  Building,
  User,
  Loader2,
  Lock,
  Film,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { usePublicCallSheet } from '@/hooks/backlot';
import { formatDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PublicCallSheetPage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [password, setPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, error } = usePublicCallSheet(shareToken || null, submittedPassword);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedPassword(password);
  };

  const handleDownloadPdf = async () => {
    if (!shareToken) return;
    setIsDownloading(true);
    try {
      const url = new URL(`${API_BASE}/api/v1/backlot/public/call-sheet/${shareToken}/pdf`);
      if (submittedPassword) {
        url.searchParams.set('password', submittedPassword);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `call-sheet-${shareToken.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Password required
  if (error?.message?.includes('Password required') && !submittedPassword) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-deep-gray border-muted-gray/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-accent-yellow" />
            </div>
            <CardTitle className="text-bone-white">Password Protected</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label className="text-muted-gray">Enter password to view</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={!password}
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                View Call Sheet
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid password
  if (error?.message?.includes('Invalid password')) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-deep-gray border-muted-gray/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <CardTitle className="text-bone-white">Invalid Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label className="text-muted-gray">Try again</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={!password}
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                View Call Sheet
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-deep-gray border-muted-gray/20">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-bone-white mb-2">
              Unable to Access Call Sheet
            </h2>
            <p className="text-muted-gray">
              {error.message || 'This link may have expired or been revoked.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-charcoal-black p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const { call_sheet, people, scenes, locations, project, allowed_actions } = data;
  const canDownload = allowed_actions?.includes('download') || allowed_actions?.includes('view');

  // Group people
  const cast = people?.filter((p: any) => p.is_cast) || [];
  const crew = people?.filter((p: any) => !p.is_cast) || [];

  // Format date
  const shootDate = call_sheet.shoot_date
    ? formatDate(call_sheet.shoot_date, 'EEEE, MMMM d, yyyy')
    : 'TBD';

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="bg-deep-gray border-b border-muted-gray/20">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              {project?.title && (
                <div className="flex items-center gap-2 mb-2">
                  <Film className="w-4 h-4 text-accent-yellow" />
                  <span className="text-sm text-muted-gray">{project.title}</span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-bone-white">{call_sheet.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-gray">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {shootDate}
                </span>
                {call_sheet.day_number && (
                  <Badge variant="outline" className="border-accent-yellow/30 text-accent-yellow">
                    Day {call_sheet.day_number}
                  </Badge>
                )}
              </div>
            </div>
            {canDownload && (
              <Button
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Call Times */}
          <Card className="bg-deep-gray border-muted-gray/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-bone-white">
                <Clock className="w-5 h-5 text-accent-yellow" />
                Call Times
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {call_sheet.crew_call && (
                  <div>
                    <Label className="text-muted-gray text-sm">Crew Call</Label>
                    <p className="text-bone-white font-medium">{call_sheet.crew_call}</p>
                  </div>
                )}
                {call_sheet.talent_call && (
                  <div>
                    <Label className="text-muted-gray text-sm">Talent Call</Label>
                    <p className="text-bone-white font-medium">{call_sheet.talent_call}</p>
                  </div>
                )}
                {call_sheet.breakfast_time && (
                  <div>
                    <Label className="text-muted-gray text-sm">Breakfast</Label>
                    <p className="text-bone-white font-medium">{call_sheet.breakfast_time}</p>
                  </div>
                )}
                {call_sheet.lunch_time && (
                  <div>
                    <Label className="text-muted-gray text-sm">Lunch</Label>
                    <p className="text-bone-white font-medium">{call_sheet.lunch_time}</p>
                  </div>
                )}
                {call_sheet.wrap_time && (
                  <div>
                    <Label className="text-muted-gray text-sm">Est. Wrap</Label>
                    <p className="text-bone-white font-medium">{call_sheet.wrap_time}</p>
                  </div>
                )}
                {call_sheet.sunrise && (
                  <div className="flex items-center gap-2">
                    <Sunrise className="w-4 h-4 text-amber-400" />
                    <span className="text-muted-gray text-sm">Sunrise:</span>
                    <span className="text-bone-white">{call_sheet.sunrise}</span>
                  </div>
                )}
                {call_sheet.sunset && (
                  <div className="flex items-center gap-2">
                    <Sunset className="w-4 h-4 text-orange-400" />
                    <span className="text-muted-gray text-sm">Sunset:</span>
                    <span className="text-bone-white">{call_sheet.sunset}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Locations */}
          {locations && locations.length > 0 && (
            <Card className="bg-deep-gray border-muted-gray/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-bone-white">
                  <MapPin className="w-5 h-5 text-accent-yellow" />
                  Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locations.map((loc: any, idx: number) => (
                    <div key={loc.id || idx} className="p-3 rounded-lg bg-charcoal-black/50">
                      <div className="font-medium text-bone-white">{loc.name}</div>
                      {loc.address && (
                        <div className="text-sm text-muted-gray mt-1">{loc.address}</div>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        {loc.contact_name && (
                          <span className="flex items-center gap-1 text-muted-gray">
                            <User className="w-3 h-3" />
                            {loc.contact_name}
                          </span>
                        )}
                        {loc.contact_phone && (
                          <span className="flex items-center gap-1 text-muted-gray">
                            <Phone className="w-3 h-3" />
                            {loc.contact_phone}
                          </span>
                        )}
                        {loc.parking_info && (
                          <span className="flex items-center gap-1 text-muted-gray">
                            <Car className="w-3 h-3" />
                            {loc.parking_info}
                          </span>
                        )}
                      </div>
                      {loc.notes && (
                        <p className="text-sm text-muted-gray mt-2 italic">{loc.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <Card className="bg-deep-gray border-muted-gray/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-bone-white">
                  <Users className="w-5 h-5 text-accent-yellow" />
                  Cast ({cast.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-muted-gray/10">
                  {cast.map((person: any) => (
                    <div key={person.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-bone-white">{person.name}</div>
                        <div className="text-sm text-muted-gray">
                          {person.role_or_position}
                          {person.character_name && ` / "${person.character_name}"`}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {person.call_time && (
                          <div className="text-bone-white">{person.call_time}</div>
                        )}
                        {person.makeup_time && (
                          <div className="text-muted-gray">MU: {person.makeup_time}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Crew */}
          {crew.length > 0 && (
            <Card className="bg-deep-gray border-muted-gray/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-bone-white">
                  <Users className="w-5 h-5 text-accent-yellow" />
                  Crew ({crew.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-muted-gray/10">
                  {crew.map((person: any) => (
                    <div key={person.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-bone-white">{person.name}</div>
                        <div className="text-sm text-muted-gray">
                          {person.role_or_position}
                          {person.department && ` - ${person.department}`}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {person.call_time && (
                          <div className="text-bone-white">{person.call_time}</div>
                        )}
                        {person.phone && (
                          <div className="text-muted-gray">{person.phone}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scenes */}
          {scenes && scenes.length > 0 && (
            <Card className="bg-deep-gray border-muted-gray/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-bone-white">
                  <FileText className="w-5 h-5 text-accent-yellow" />
                  Scenes ({scenes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scenes.map((scene: any) => (
                    <div key={scene.id} className="p-3 rounded-lg bg-charcoal-black/50">
                      <div className="flex items-center gap-3 mb-1">
                        <Badge variant="outline" className="border-accent-yellow/30 text-accent-yellow">
                          Scene {scene.scene_number}
                        </Badge>
                        {scene.int_ext && (
                          <Badge variant="outline" className="border-muted-gray/30">
                            {scene.int_ext}
                          </Badge>
                        )}
                        {scene.day_night && (
                          <Badge variant="outline" className="border-muted-gray/30">
                            {scene.day_night}
                          </Badge>
                        )}
                      </div>
                      {scene.location && (
                        <div className="text-bone-white font-medium">{scene.location}</div>
                      )}
                      {scene.description && (
                        <p className="text-sm text-muted-gray mt-1">{scene.description}</p>
                      )}
                      {scene.page_count && (
                        <div className="text-xs text-muted-gray mt-2">
                          {scene.page_count} {scene.page_count === 1 ? 'page' : 'pages'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Safety Notes */}
          {call_sheet.safety_notes && (
            <Card className="bg-deep-gray border-muted-gray/20 border-red-400/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Safety Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-bone-white whitespace-pre-wrap">{call_sheet.safety_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* General Notes */}
          {call_sheet.notes && (
            <Card className="bg-deep-gray border-muted-gray/20">
              <CardHeader>
                <CardTitle className="text-lg text-bone-white">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-gray whitespace-pre-wrap">{call_sheet.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-deep-gray border-t border-muted-gray/20 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-gray">
          Shared via Second Watch Network Backlot
        </div>
      </div>
    </div>
  );
};

export default PublicCallSheetPage;
