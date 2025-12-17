/**
 * CheckInView - QR-based crew check-in system
 * Admin: Create/manage check-in sessions, view QR codes, see who's checked in
 * Crew: Check in to active sessions
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  QrCode,
  Plus,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCheckinSessions,
  useCreateCheckinSession,
  useActivateCheckinSession,
  useDeactivateCheckinSession,
  useCheckinSession,
  useSessionCheckins,
  usePerformCheckin,
  useSessionByToken,
  CheckinSession,
  CheckinRecord,
} from '@/hooks/backlot';
import { useProductionDays } from '@/hooks/backlot';
import { useAuth } from '@/context/AuthContext';

interface CheckInViewProps {
  projectId: string;
  canManage: boolean; // Admin/1st AD can manage sessions
}

// QR Code generator using an API (or could use a library like qrcode.react)
const QRCodeDisplay: React.FC<{ value: string; size?: number }> = ({ value, size = 200 }) => {
  // Using a simple QR code API - in production you might use qrcode.react
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;

  return (
    <div className="bg-white p-4 rounded-lg inline-block">
      <img src={qrUrl} alt="QR Code" width={size} height={size} />
    </div>
  );
};

const CheckInView: React.FC<CheckInViewProps> = ({ projectId, canManage }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'manage' | 'my-checkins'>(canManage ? 'manage' : 'my-checkins');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Queries
  const { data: sessions, isLoading: sessionsLoading } = useCheckinSessions(projectId);
  const { data: productionDays } = useProductionDays(projectId);
  const { data: sessionDetails, isLoading: detailsLoading } = useCheckinSession(
    projectId,
    selectedSessionId
  );
  const { data: sessionCheckins } = useSessionCheckins(projectId, selectedSessionId);

  // Mutations
  const createSession = useCreateCheckinSession(projectId);
  const activateSession = useActivateCheckinSession(projectId);
  const deactivateSession = useDeactivateCheckinSession(projectId);
  const performCheckin = usePerformCheckin();

  // Form state
  const [formData, setFormData] = useState({
    production_day_id: '',
    session_type: 'call',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      production_day_id: '',
      session_type: 'call',
      notes: '',
    });
  };

  const handleCreateSession = async () => {
    await createSession.mutateAsync({
      project_id: projectId,
      production_day_id: formData.production_day_id || null,
      session_type: formData.session_type,
      notes: formData.notes || null,
    });
    setShowCreateModal(false);
    resetForm();
  };

  const handleToggleSession = async (session: CheckinSession) => {
    if (session.is_active) {
      await deactivateSession.mutateAsync(session.id);
    } else {
      await activateSession.mutateAsync(session.id);
    }
  };

  const handleCheckin = async (sessionId: string) => {
    await performCheckin.mutateAsync({
      sessionId,
      checkInTime: new Date().toISOString(),
    });
  };

  const getCheckinUrl = (token: string) => {
    return `${window.location.origin}/checkin/${token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Group sessions by status
  const activeSessions = sessions?.filter((s) => s.is_active) || [];
  const inactiveSessions = sessions?.filter((s) => !s.is_active) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Crew Check-In</h2>
          <p className="text-muted-gray text-sm">
            {canManage
              ? 'Manage check-in sessions and track attendance'
              : 'Check in to active sessions and view your history'}
          </p>
        </div>
      </div>

      {/* Tabs for admin vs crew view */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-soft-black border border-muted-gray/20 p-1">
          {canManage && (
            <TabsTrigger
              value="manage"
              className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Manage Sessions
            </TabsTrigger>
          )}
          <TabsTrigger
            value="my-checkins"
            className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            My Check-ins
          </TabsTrigger>
        </TabsList>

        {/* Admin Session Management */}
        {canManage && (
          <TabsContent value="manage" className="mt-6 space-y-6">
            {/* Active Sessions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-bone-white">Active Sessions</h3>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Session
                </Button>
              </div>

              {activeSessions.length === 0 ? (
                <Card className="bg-soft-black border-muted-gray/20">
                  <CardContent className="py-8 text-center">
                    <QrCode className="w-10 h-10 mx-auto text-muted-gray mb-3" />
                    <p className="text-muted-gray">No active check-in sessions</p>
                    <Button
                      variant="link"
                      className="text-accent-yellow mt-2"
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create your first session
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSessions.map((session) => {
                    const day = productionDays?.find((d) => d.id === session.production_day_id);
                    return (
                      <Card
                        key={session.id}
                        className="bg-soft-black border-green-500/30 hover:border-green-500/50 transition-colors"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                  Active
                                </Badge>
                                <span className="capitalize">{session.session_type}</span>
                              </CardTitle>
                              {day && (
                                <p className="text-sm text-muted-gray mt-1">
                                  Day {day.day_number} -{' '}
                                  {new Date(day.date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleToggleSession(session)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              End
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-muted-gray">
                              <Users className="w-4 h-4" />
                              <span>{session.check_in_count || 0} checked in</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowQRModal(session.id)}
                              >
                                <QrCode className="w-4 h-4 mr-1" />
                                Show QR
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSessionId(session.id)}
                              >
                                <Users className="w-4 h-4 mr-1" />
                                Details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Sessions */}
            {inactiveSessions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-bone-white mb-4">Past Sessions</h3>
                <Card className="bg-soft-black border-muted-gray/20 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-muted-gray/20">
                        <TableHead>Type</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Check-ins</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveSessions.map((session) => {
                        const day = productionDays?.find(
                          (d) => d.id === session.production_day_id
                        );
                        return (
                          <TableRow key={session.id} className="border-muted-gray/20">
                            <TableCell className="capitalize">{session.session_type}</TableCell>
                            <TableCell>
                              {day ? `Day ${day.day_number}` : '-'}
                            </TableCell>
                            <TableCell>{session.check_in_count || 0}</TableCell>
                            <TableCell className="text-muted-gray">
                              {new Date(session.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleSession(session)}
                                >
                                  Reactivate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedSessionId(session.id)}
                                >
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}
          </TabsContent>
        )}

        {/* Crew Check-in View */}
        <TabsContent value="my-checkins" className="mt-6 space-y-6">
          {/* Available Sessions to Check Into */}
          <div>
            <h3 className="text-lg font-medium text-bone-white mb-4">Available Check-ins</h3>
            {activeSessions.length === 0 ? (
              <Card className="bg-soft-black border-muted-gray/20">
                <CardContent className="py-8 text-center">
                  <Clock className="w-10 h-10 mx-auto text-muted-gray mb-3" />
                  <p className="text-muted-gray">No active check-in sessions right now</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeSessions.map((session) => {
                  const day = productionDays?.find((d) => d.id === session.production_day_id);
                  // For now, we'll skip the alreadyCheckedIn check since we don't have a my-checkins API
                  // In production, this would filter sessionCheckins by user
                  const alreadyCheckedIn = false;
                  return (
                    <Card
                      key={session.id}
                      className={cn(
                        'bg-soft-black border-muted-gray/20',
                        alreadyCheckedIn && 'border-green-500/30'
                      )}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-bone-white capitalize">
                              {session.session_type} Check-in
                            </div>
                            {day && (
                              <div className="text-sm text-muted-gray">
                                Day {day.day_number} -{' '}
                                {new Date(day.date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          {alreadyCheckedIn ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Checked In
                            </Badge>
                          ) : (
                            <Button
                              onClick={() => handleCheckin(session.id)}
                              disabled={performCheckin.isPending}
                              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Check In
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Check-in History */}
          <div>
            <h3 className="text-lg font-medium text-bone-white mb-4">My Check-in History</h3>
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="py-8 text-center">
                <Calendar className="w-10 h-10 mx-auto text-muted-gray mb-3" />
                <p className="text-muted-gray">Check-in history coming soon</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Session Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Create Check-in Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Session Type</Label>
              <Select
                value={formData.session_type}
                onValueChange={(v) => setFormData({ ...formData, session_type: v })}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call Time</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="wrap">Wrap</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Production Day (Optional)</Label>
              <Select
                value={formData.production_day_id}
                onValueChange={(v) => setFormData({ ...formData, production_day_id: v })}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific day</SelectItem>
                  {productionDays?.map((day) => (
                    <SelectItem key={day.id} value={day.id}>
                      Day {day.day_number} - {new Date(day.date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this session..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={createSession.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!showQRModal} onOpenChange={() => setShowQRModal(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Check-in QR Code</DialogTitle>
          </DialogHeader>
          {showQRModal && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <QRCodeDisplay
                  value={getCheckinUrl(
                    sessions?.find((s) => s.id === showQRModal)?.qr_token || ''
                  )}
                  size={250}
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-gray mb-2">
                  Crew can scan this code to check in
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        getCheckinUrl(
                          sessions?.find((s) => s.id === showQRModal)?.qr_token || ''
                        )
                      )
                    }
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        getCheckinUrl(
                          sessions?.find((s) => s.id === showQRModal)?.qr_token || ''
                        ),
                        '_blank'
                      )
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open Link
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Session Details Modal */}
      <Dialog open={!!selectedSessionId} onOpenChange={() => setSelectedSessionId(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <Skeleton className="h-48" />
          ) : sessionDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-gray">Type</Label>
                  <div className="text-bone-white capitalize">{sessionDetails.session_type}</div>
                </div>
                <div>
                  <Label className="text-muted-gray">Status</Label>
                  <Badge
                    className={
                      sessionDetails.is_active
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-muted-gray/20 text-muted-gray border-muted-gray/30'
                    }
                  >
                    {sessionDetails.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-gray">Total Check-ins</Label>
                  <div className="text-bone-white">{sessionDetails.check_in_count || 0}</div>
                </div>
                <div>
                  <Label className="text-muted-gray">Created</Label>
                  <div className="text-bone-white">
                    {new Date(sessionDetails.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {sessionDetails.checkins && sessionDetails.checkins.length > 0 && (
                <div>
                  <Label className="text-muted-gray mb-2 block">Check-ins</Label>
                  <Card className="bg-charcoal-black border-muted-gray/20 overflow-hidden max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-muted-gray/20">
                          <TableHead>Name</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionDetails.checkins.map((checkin: CheckinRecord) => (
                          <TableRow key={checkin.id} className="border-muted-gray/20">
                            <TableCell className="text-bone-white">
                              {checkin.user_name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {new Date(checkin.check_in_time).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell>
                              {checkin.check_out_time
                                ? new Date(checkin.check_out_time).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-gray">Session not found</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckInView;
