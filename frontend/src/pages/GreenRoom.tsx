/**
 * Green Room Hub Page
 * Main hub for the Green Room voting arena
 */
import { useState, useEffect, useCallback } from 'react';
import { greenroomAPI, Cycle, Project } from '@/lib/api/greenroom';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Hub Components
import { GreenRoomHero } from '@/components/greenroom/GreenRoomHero';
import { GreenRoomTimeline } from '@/components/greenroom/GreenRoomTimeline';
import { ProjectDiscoverSection } from '@/components/greenroom/ProjectDiscoverSection';
import { YourGreenRoomPanel } from '@/components/greenroom/YourGreenRoomPanel';
import { CommunityActivityStrip } from '@/components/greenroom/CommunityActivityStrip';
import { CycleStatsRow } from '@/components/greenroom/CycleStatsRow';

// How It Works Dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DollarSign, Vote, Trophy, Send, CheckCircle2 } from 'lucide-react';

export default function GreenRoom() {
  const { user } = useAuth();
  const { isFilmmaker } = useEnrichedProfile();

  const [loading, setLoading] = useState(true);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [allCycles, setAllCycles] = useState<Cycle[]>([]);
  const [availableTickets, setAvailableTickets] = useState(0);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    loadCycleData();
  }, []);

  // Load user tickets when authenticated and cycle is available
  useEffect(() => {
    if (user && currentCycle) {
      loadUserTickets();
    }
  }, [user, currentCycle]);

  const loadCycleData = async () => {
    try {
      setLoading(true);
      const [active, upcoming, closed] = await Promise.all([
        greenroomAPI.listCycles('active'),
        greenroomAPI.listCycles('upcoming'),
        greenroomAPI.listCycles('closed'),
      ]);

      // Combine all cycles for the dropdown
      const cycles = [...active, ...upcoming, ...closed];
      setAllCycles(cycles);

      // Set current cycle (active takes priority, then upcoming, then most recent closed)
      if (active.length > 0) {
        setCurrentCycle(active[0]);
      } else if (upcoming.length > 0) {
        setCurrentCycle(upcoming[0]);
      } else if (closed.length > 0) {
        setCurrentCycle(closed[0]);
      }
    } catch (error) {
      console.error('Failed to load cycles:', error);
      toast.error('Failed to load Green Room data');
    } finally {
      setLoading(false);
    }
  };

  const loadUserTickets = async () => {
    try {
      const tickets = await greenroomAPI.getMyTickets();
      setAvailableTickets(tickets?.tickets_available || 0);
    } catch (error) {
      console.error('Failed to load user tickets:', error);
    }
  };

  const handleVoteClick = useCallback((project: Project) => {
    // Navigate to the cycle page with the project highlighted for voting
    window.location.href = `/greenroom/cycles/${project.cycle_id}?vote=${project.id}`;
  }, []);

  const handleHowItWorksClick = useCallback(() => {
    setShowHowItWorks(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
          <p className="text-bone-white/70">Loading Green Room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto py-8 px-4 space-y-8">
        {/* Hero Section */}
        <GreenRoomHero
          currentCycle={currentCycle}
          isFilmmaker={isFilmmaker}
          onHowItWorksClick={handleHowItWorksClick}
        />

        {/* Timeline Strip */}
        <GreenRoomTimeline cycleStatus={currentCycle?.status} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Project Discovery (2/3 width on large screens) */}
          <div className="lg:col-span-2 space-y-8">
            <ProjectDiscoverSection
              currentCycle={currentCycle}
              cycles={allCycles}
              onVoteClick={handleVoteClick}
              availableTickets={availableTickets}
            />
          </div>

          {/* Right Column - User Panel & Activity (1/3 width on large screens) */}
          <div className="space-y-6">
            <YourGreenRoomPanel
              currentCycle={currentCycle}
              isFilmmaker={isFilmmaker}
              isAuthenticated={!!user}
            />
            <CommunityActivityStrip currentCycle={currentCycle} />
          </div>
        </div>

        {/* Stats Row */}
        <CycleStatsRow currentCycle={currentCycle} />
      </div>

      {/* How It Works Dialog */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-bone-white flex items-center gap-2">
              <Vote className="h-6 w-6 text-emerald-400" />
              How The Green Room Works
            </DialogTitle>
            <DialogDescription className="text-bone-white/70">
              Your guide to participating in the Green Room voting process
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-bone-white flex items-center gap-2 mb-1">
                  <Send className="h-4 w-4 text-blue-400" />
                  Submit Your Project (Filmmakers)
                </h3>
                <p className="text-sm text-bone-white/70">
                  Verified filmmakers can submit their project pitches during the submission window.
                  Include a compelling description, trailer, and budget breakdown.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-bone-white flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-accent-yellow" />
                  Purchase Voting Tickets
                </h3>
                <p className="text-sm text-bone-white/70">
                  Buy voting tickets (${currentCycle?.ticket_price || 1} each) to vote for your favorite projects.
                  Maximum {currentCycle?.max_tickets_per_user || 100} tickets per user per cycle.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-bone-white flex items-center gap-2 mb-1">
                  <Vote className="h-4 w-4 text-emerald-400" />
                  Allocate Your Votes
                </h3>
                <p className="text-sm text-bone-white/70">
                  Browse approved projects and allocate your tickets strategically.
                  You can split your tickets across multiple projects or go all-in on one!
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold text-bone-white flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Winners Get Greenlit
                </h3>
                <p className="text-sm text-bone-white/70">
                  When the cycle ends, top-voted projects earn a spot on the Second Watch slate.
                  They receive development support and production resources.
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="mt-6 p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-lg">
              <h4 className="font-semibold text-emerald-400 mb-2">Why Participate?</h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-bone-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  Direct influence on what content gets made
                </li>
                <li className="flex items-start gap-2 text-sm text-bone-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  Support independent filmmakers you believe in
                </li>
                <li className="flex items-start gap-2 text-sm text-bone-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  Ticket funds go directly toward production
                </li>
                <li className="flex items-start gap-2 text-sm text-bone-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  Early access to behind-the-scenes content
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
