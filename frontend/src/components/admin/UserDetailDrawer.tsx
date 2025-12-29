import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  User,
  Film,
  Shield,
  FileText,
  Activity,
  Ban,
  Key,
  Trash2,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  Crown,
  Star,
  Sparkles,
  Users,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';

interface UserDetailDrawerProps {
  userId: string | null;
  onClose: () => void;
}

const ROLE_CONFIG = {
  superadmin: { icon: Crown, color: 'text-red-500', bg: 'bg-red-500/20' },
  admin: { icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/20' },
  moderator: { icon: Users, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  lodge_officer: { icon: Star, color: 'text-purple-500', bg: 'bg-purple-500/20' },
  order_member: { icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-500/20' },
  partner: { icon: Briefcase, color: 'text-green-500', bg: 'bg-green-500/20' },
  filmmaker: { icon: Film, color: 'text-cyan-500', bg: 'bg-cyan-500/20' },
  premium: { icon: Crown, color: 'text-amber-500', bg: 'bg-amber-500/20' },
  free: { icon: User, color: 'text-muted-gray', bg: 'bg-muted-gray/20' },
};

export const UserDetailDrawer = ({ userId, onClose }: UserDetailDrawerProps) => {
  const queryClient = useQueryClient();
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user-details', userId],
    queryFn: () => api.getUserDetails(userId!),
    enabled: !!userId,
  });

  const banMutation = useMutation({
    mutationFn: () => api.banUser(userId!, !data?.profile.is_banned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-details', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
      toast.success(data?.profile.is_banned ? 'User unbanned' : 'User banned');
      setShowBanDialog(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update user status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteUser(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
      toast.success('User deleted');
      setShowDeleteDialog(false);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete user');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.resetUserPassword(userId!),
    onSuccess: (result) => {
      toast.success(result.message || 'Password reset email sent');
      setShowResetPasswordDialog(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send password reset');
    },
  });

  const profile = data?.profile;

  return (
    <>
      <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-xl bg-charcoal-black border-l border-muted-gray overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-primary-red">
              Failed to load user details
            </div>
          ) : profile ? (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 border-2 border-muted-gray">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="bg-muted-gray text-bone-white text-xl">
                      {profile.username?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-bone-white text-xl truncate">
                      {profile.full_name || profile.username || 'Unknown User'}
                    </SheetTitle>
                    <p className="text-muted-gray text-sm truncate">@{profile.username}</p>
                    <p className="text-muted-gray text-sm truncate">{profile.email}</p>
                    {profile.is_banned && (
                      <Badge variant="destructive" className="mt-2">
                        <Ban className="h-3 w-3 mr-1" />
                        Banned
                      </Badge>
                    )}
                  </div>
                </div>
              </SheetHeader>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetPasswordDialog(true)}
                  className="bg-charcoal-black border-muted-gray text-bone-white"
                >
                  <Key className="h-4 w-4 mr-1" />
                  Reset Password
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBanDialog(true)}
                  className={`bg-charcoal-black ${
                    profile.is_banned
                      ? 'border-green-500 text-green-500'
                      : 'border-primary-red text-primary-red'
                  }`}
                >
                  <Ban className="h-4 w-4 mr-1" />
                  {profile.is_banned ? 'Unban' : 'Ban'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="bg-charcoal-black border-primary-red text-primary-red"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>

              <Separator className="bg-muted-gray mb-6" />

              {/* Tabs */}
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-charcoal-black border border-muted-gray mb-4">
                  <TabsTrigger
                    value="profile"
                    className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black text-xs"
                  >
                    <User className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="roles"
                    className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black text-xs"
                  >
                    <Shield className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="filmmaker"
                    className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black text-xs"
                  >
                    <Film className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="submissions"
                    className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black text-xs"
                  >
                    <FileText className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black text-xs"
                  >
                    <Activity className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-gray">
                      <Mail className="h-4 w-4" />
                      <span className="text-bone-white">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-gray">
                      <Calendar className="h-4 w-4" />
                      <span className="text-bone-white">
                        Joined {format(new Date(profile.created_at), 'PPP')}
                      </span>
                    </div>
                    {profile.bio && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-gray uppercase mb-1">Bio</p>
                        <p className="text-bone-white text-sm">{profile.bio}</p>
                      </div>
                    )}
                    {profile.stripe_customer_id && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-gray uppercase mb-1">Stripe Customer</p>
                        <p className="text-bone-white text-sm font-mono">{profile.stripe_customer_id}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Roles Tab */}
                <TabsContent value="roles" className="space-y-3">
                  <p className="text-xs text-muted-gray uppercase mb-2">Active Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.roles.map((role: string) => {
                      const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.free;
                      const Icon = config.icon;
                      return (
                        <Badge
                          key={role}
                          variant="outline"
                          className={`${config.bg} ${config.color} border-current`}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {role.replace('_', ' ')}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Order Membership */}
                  {data?.order_membership && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                      <p className="text-xs text-blue-400 uppercase mb-2">Order Membership</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-bone-white">
                          <span className="text-muted-gray">Track:</span> {data.order_membership.primary_track}
                        </p>
                        <p className="text-bone-white">
                          <span className="text-muted-gray">Status:</span> {data.order_membership.status}
                        </p>
                        <p className="text-bone-white">
                          <span className="text-muted-gray">Dues:</span> {data.order_membership.dues_status}
                        </p>
                        {data.order_membership.city && (
                          <p className="text-bone-white">
                            <span className="text-muted-gray">Location:</span> {data.order_membership.city}, {data.order_membership.region}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Filmmaker Tab */}
                <TabsContent value="filmmaker" className="space-y-3">
                  {data?.filmmaker_profile ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {data.filmmaker_profile.department && (
                          <div>
                            <p className="text-xs text-muted-gray uppercase">Department</p>
                            <p className="text-bone-white">{data.filmmaker_profile.department}</p>
                          </div>
                        )}
                        {data.filmmaker_profile.experience_level && (
                          <div>
                            <p className="text-xs text-muted-gray uppercase">Experience</p>
                            <p className="text-bone-white">{data.filmmaker_profile.experience_level}</p>
                          </div>
                        )}
                        {data.filmmaker_profile.location && (
                          <div>
                            <p className="text-xs text-muted-gray uppercase">Location</p>
                            <p className="text-bone-white flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {data.filmmaker_profile.location}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-gray uppercase">Accepting Work</p>
                          <p className={data.filmmaker_profile.accepting_work ? 'text-green-500' : 'text-muted-gray'}>
                            {data.filmmaker_profile.accepting_work ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>
                      {data.filmmaker_profile.skills?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-gray uppercase mb-1">Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {data.filmmaker_profile.skills.map((skill: string) => (
                              <Badge key={skill} variant="outline" className="text-xs border-muted-gray text-bone-white">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.filmmaker_profile.portfolio_url && (
                        <div>
                          <p className="text-xs text-muted-gray uppercase mb-1">Portfolio</p>
                          <a
                            href={data.filmmaker_profile.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-yellow text-sm hover:underline"
                          >
                            {data.filmmaker_profile.portfolio_url}
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-gray">
                      <Film className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No filmmaker profile</p>
                    </div>
                  )}
                </TabsContent>

                {/* Submissions Tab */}
                <TabsContent value="submissions" className="space-y-3">
                  {data?.submissions && data.submissions.length > 0 ? (
                    <div className="space-y-2">
                      {data.submissions.map((sub: any) => (
                        <div
                          key={sub.id}
                          className="p-3 bg-muted-gray/10 border border-muted-gray/30 rounded"
                        >
                          <p className="text-bone-white font-medium truncate">{sub.project_title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                sub.status === 'approved'
                                  ? 'border-green-500 text-green-500'
                                  : sub.status === 'rejected'
                                  ? 'border-primary-red text-primary-red'
                                  : 'border-muted-gray text-muted-gray'
                              }`}
                            >
                              {sub.status}
                            </Badge>
                            <span className="text-xs text-muted-gray">
                              {format(new Date(sub.created_at), 'PP')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-gray">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No submissions</p>
                    </div>
                  )}

                  {/* Applications */}
                  {data?.applications && data.applications.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-gray uppercase mb-2">Applications</p>
                      {data.applications.map((app: any) => (
                        <div
                          key={app.id}
                          className="p-2 bg-muted-gray/10 border border-muted-gray/30 rounded mb-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-bone-white capitalize">{app.type} Application</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                app.status === 'approved'
                                  ? 'border-green-500 text-green-500'
                                  : app.status === 'rejected'
                                  ? 'border-primary-red text-primary-red'
                                  : 'border-accent-yellow text-accent-yellow'
                              }`}
                            >
                              {app.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-3">
                  {data?.recent_activity && data.recent_activity.length > 0 ? (
                    <div className="space-y-2">
                      {data.recent_activity.map((activity: any) => (
                        <div
                          key={activity.id}
                          className="p-2 border-l-2 border-accent-yellow/50 pl-3"
                        >
                          <p className="text-bone-white text-sm">{activity.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-gray">
                              by {activity.admin?.username || 'System'}
                            </span>
                            <span className="text-xs text-muted-gray">
                              {format(new Date(activity.created_at), 'PP p')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-gray">
                      <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No activity recorded</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Ban/Unban Dialog */}
      <AlertDialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">
              {profile?.is_banned ? 'Unban User?' : 'Ban User?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              {profile?.is_banned
                ? `This will restore access for ${profile?.username || profile?.email}.`
                : `This will prevent ${profile?.username || profile?.email} from accessing the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-charcoal-black border-muted-gray text-bone-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => banMutation.mutate()}
              disabled={banMutation.isPending}
              className={profile?.is_banned ? 'bg-green-600 hover:bg-green-700' : 'bg-primary-red hover:bg-red-700'}
            >
              {banMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : profile?.is_banned ? 'Unban' : 'Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Delete User?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              This will permanently delete {profile?.username || profile?.email} and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-charcoal-black border-muted-gray text-bone-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-primary-red hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Reset Password?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              This will send a password reset email to {profile?.email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-charcoal-black border-muted-gray text-bone-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-yellow-500"
            >
              {resetPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Email'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserDetailDrawer;
