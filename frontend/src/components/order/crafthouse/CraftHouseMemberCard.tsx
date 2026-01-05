/**
 * CraftHouseMemberCard - Enhanced member card with DM and profile actions
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import type { CraftHouseMember, CraftHouseRole } from '@/lib/api/order';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Crown,
  MapPin,
  MessageCircle,
  User,
  MoreVertical,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CraftHouseMemberCardProps {
  member: CraftHouseMember;
  isSteward: boolean;
  isCurrentUser: boolean;
  craftHouseId: number;
  onRoleChange?: (userId: string, newRole: CraftHouseRole) => void;
  variant?: 'default' | 'steward';
  getTrackLabel: (track?: string) => string;
}

const ROLE_ORDER: CraftHouseRole[] = ['apprentice', 'associate', 'member', 'steward'];

export default function CraftHouseMemberCard({
  member,
  isSteward,
  isCurrentUser,
  craftHouseId,
  onRoleChange,
  variant = 'default',
  getTrackLabel,
}: CraftHouseMemberCardProps) {
  const navigate = useNavigate();
  const [isDMing, setIsDMing] = useState(false);

  // Create DM conversation
  const handleDM = async () => {
    if (isCurrentUser) return;
    try {
      setIsDMing(true);
      const conversation = await api.messages.createPrivateConversation(member.user_id);
      navigate(`/messages?open=${conversation.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start conversation');
    } finally {
      setIsDMing(false);
    }
  };

  const getRoleBadge = (role: CraftHouseRole) => {
    switch (role) {
      case 'steward':
        return (
          <Badge className="bg-accent-yellow text-charcoal-black">
            <Crown className="h-3 w-3 mr-1" />
            Steward
          </Badge>
        );
      case 'member':
        return <Badge variant="secondary">Member</Badge>;
      case 'associate':
        return <Badge variant="outline">Associate</Badge>;
      case 'apprentice':
        return <Badge variant="outline" className="border-dashed">Apprentice</Badge>;
      default:
        return null;
    }
  };

  const canPromote = isSteward && !isCurrentUser && member.role !== 'steward';
  const canDemote = isSteward && !isCurrentUser && member.role !== 'apprentice';
  const currentRoleIndex = ROLE_ORDER.indexOf(member.role);

  const handlePromote = () => {
    if (!canPromote || !onRoleChange) return;
    const newRoleIndex = Math.min(currentRoleIndex + 1, ROLE_ORDER.length - 1);
    onRoleChange(member.user_id, ROLE_ORDER[newRoleIndex]);
  };

  const handleDemote = () => {
    if (!canDemote || !onRoleChange) return;
    const newRoleIndex = Math.max(currentRoleIndex - 1, 0);
    onRoleChange(member.user_id, ROLE_ORDER[newRoleIndex]);
  };

  const isStewardVariant = variant === 'steward';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
        isStewardVariant
          ? 'border-accent-yellow/30 bg-accent-yellow/5 hover:bg-accent-yellow/10'
          : 'border-muted-gray hover:border-accent-yellow/30'
      }`}
    >
      <Avatar className={`h-12 w-12 ${isStewardVariant ? 'border-2 border-accent-yellow' : ''}`}>
        <AvatarFallback className={isStewardVariant ? 'bg-accent-yellow text-charcoal-black' : 'bg-muted-gray/30 text-bone-white'}>
          {member.user_name?.charAt(0) || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0" onClick={() => navigate(`/order/members/${member.user_id}`)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-heading text-bone-white truncate">{member.user_name || 'Unknown'}</span>
          {getRoleBadge(member.role)}
          {isCurrentUser && (
            <Badge variant="outline" className="border-accent-yellow text-accent-yellow text-xs">
              You
            </Badge>
          )}
        </div>
        {member.primary_track && (
          <p className="text-sm text-muted-gray">
            {getTrackLabel(member.primary_track)}
          </p>
        )}
        {member.city && (
          <p className="text-xs text-muted-gray flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {member.city}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {/* DM Button */}
        {!isCurrentUser && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDM}
            disabled={isDMing}
            className="text-muted-gray hover:text-accent-yellow"
            title="Send message"
          >
            {isDMing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Profile Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/order/members/${member.user_id}`)}
          className="text-muted-gray hover:text-accent-yellow"
          title="View profile"
        >
          <User className="h-4 w-4" />
        </Button>

        {/* Steward Actions Dropdown */}
        {isSteward && !isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-gray hover:text-accent-yellow"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-charcoal-black border-muted-gray">
              {canPromote && (
                <DropdownMenuItem
                  onClick={handlePromote}
                  className="text-bone-white hover:bg-muted-gray/20 cursor-pointer"
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2 text-green-500" />
                  Promote to {ROLE_ORDER[currentRoleIndex + 1]}
                </DropdownMenuItem>
              )}
              {canDemote && (
                <DropdownMenuItem
                  onClick={handleDemote}
                  className="text-bone-white hover:bg-muted-gray/20 cursor-pointer"
                >
                  <ArrowDownCircle className="h-4 w-4 mr-2 text-amber-500" />
                  Demote to {ROLE_ORDER[currentRoleIndex - 1]}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-muted-gray" />
              <DropdownMenuItem
                onClick={() => navigate(`/order/members/${member.user_id}`)}
                className="text-bone-white hover:bg-muted-gray/20 cursor-pointer"
              >
                <User className="h-4 w-4 mr-2" />
                View Full Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </motion.div>
  );
}
