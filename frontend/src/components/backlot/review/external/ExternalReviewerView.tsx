/**
 * ExternalReviewerView - Public review interface for external reviewers
 * Accessed via share links, no authentication required
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Lock,
  AlertCircle,
  Play,
  MessageSquare,
  Send,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import ReviewVideoPlayer from '../ReviewVideoPlayer';
import { ReviewAsset, ReviewVersion, ReviewNote } from '@/types/backlot';

// Session storage key
const SESSION_STORAGE_KEY = 'swn_review_session';

interface ExternalSession {
  token: string;
  sessionToken: string;
  displayName: string;
  expiresAt: string;
}

interface LinkInfo {
  valid: boolean;
  name: string;
  requires_password: boolean;
  scope: 'asset' | 'folder' | 'project';
  asset_name?: string;
  folder_name?: string;
  project_name?: string;
  can_comment: boolean;
  can_download: boolean;
  can_approve: boolean;
  expires_at: string | null;
}

export const ExternalReviewerView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [session, setSession] = useState<ExternalSession | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Note form state
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Load saved session
  useEffect(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as ExternalSession;
        if (parsed.token === token && new Date(parsed.expiresAt) > new Date()) {
          setSession(parsed);
        } else {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, [token]);

  // Validate link on mount
  useEffect(() => {
    const validateLink = async () => {
      if (!token) {
        setError('Invalid link');
        setIsLoading(false);
        return;
      }

      try {
        const info = await api.validateExternalReviewLink(token);
        if (!info.valid) {
          setError('This link is no longer valid');
        } else {
          setLinkInfo(info);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to validate link');
      } finally {
        setIsLoading(false);
      }
    };

    validateLink();
  }, [token]);

  // Load content when session is established
  useEffect(() => {
    const loadContent = async () => {
      if (!token || !session) return;

      setIsLoadingContent(true);
      try {
        const content = await api.getExternalReviewContent(token, session.sessionToken);
        setAssets(content.assets);

        // Auto-select first asset
        if (content.assets.length > 0) {
          const first = content.assets[0];
          setSelectedAsset(first);
          if (first.versions && first.versions.length > 0) {
            const activeVersion = first.versions.find((v: any) => v.id === first.active_version_id) || first.versions[0];
            setSelectedVersion(activeVersion);
            setNotes(activeVersion.notes || []);
          }
        }
      } catch (err: any) {
        if (err.message?.includes('401') || err.message?.includes('session')) {
          // Session expired
          setSession(null);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } else {
          setError(err.message || 'Failed to load content');
        }
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [token, session]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !displayName.trim()) return;

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const result = await api.startExternalReviewSession(token, {
        display_name: displayName.trim(),
        email: email.trim() || undefined,
        password: linkInfo?.requires_password ? password : undefined,
      });

      const newSession: ExternalSession = {
        token,
        sessionToken: result.session_token,
        displayName: displayName.trim(),
        expiresAt: result.expires_at,
      };

      setSession(newSession);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch (err: any) {
      setLoginError(err.message || 'Failed to start session');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSelectAsset = (asset: any) => {
    setSelectedAsset(asset);
    if (asset.versions && asset.versions.length > 0) {
      const activeVersion = asset.versions.find((v: any) => v.id === asset.active_version_id) || asset.versions[0];
      setSelectedVersion(activeVersion);
      setNotes(activeVersion.notes || []);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleAddNote = async () => {
    if (!token || !session || !selectedVersion || !noteContent.trim()) return;

    setIsSubmittingNote(true);
    try {
      const result = await api.createExternalReviewNote(token, session.sessionToken, {
        version_id: selectedVersion.id,
        timecode_seconds: currentTime,
        content: noteContent.trim(),
      });

      // Add note to local state
      setNotes((prev) => [...prev, result.note]);
      setNoteContent('');
    } catch (err: any) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleNoteClick = (note: ReviewNote) => {
    if (note.timecode_seconds !== null) {
      setCurrentTime(note.timecode_seconds);
    }
  };

  // Navigation between assets
  const currentAssetIndex = assets.findIndex((a) => a.id === selectedAsset?.id);
  const hasPrevious = currentAssetIndex > 0;
  const hasNext = currentAssetIndex < assets.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) {
      handleSelectAsset(assets[currentAssetIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      handleSelectAsset(assets[currentAssetIndex + 1]);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-accent-yellow" />
      </div>
    );
  }

  // Error state
  if (error || !linkInfo) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold text-white">Link Not Available</h1>
          <p className="text-white/60">{error || 'This review link is no longer valid or has expired.'}</p>
        </div>
      </div>
    );
  }

  // Login form (no session yet)
  if (!session) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-800 rounded-lg border border-white/10 p-6 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">{linkInfo.name}</h1>
            <p className="text-white/60">
              {linkInfo.scope === 'asset' && linkInfo.asset_name
                ? `Review: ${linkInfo.asset_name}`
                : linkInfo.scope === 'folder' && linkInfo.folder_name
                ? `Folder: ${linkInfo.folder_name}`
                : linkInfo.project_name || 'Project Review'}
            </p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Your Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                required
                className="bg-surface-700 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-surface-700 border-white/10"
              />
            </div>

            {linkInfo.requires_password && (
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="bg-surface-700 border-white/10"
                />
              </div>
            )}

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {loginError}
              </div>
            )}

            <Button
              type="submit"
              disabled={!displayName.trim() || isLoggingIn}
              className="w-full bg-accent-yellow text-black hover:bg-accent-yellow/90"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Session...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Review
                </>
              )}
            </Button>
          </form>

          {/* Permissions info */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <p className="text-xs text-white/40 text-center">You will be able to:</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary" className="bg-surface-700">
                <Play className="w-3 h-3 mr-1" />
                View
              </Badge>
              {linkInfo.can_comment && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Comment
                </Badge>
              )}
              {linkInfo.can_approve && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  Approve
                </Badge>
              )}
            </div>
          </div>

          {linkInfo.expires_at && (
            <p className="text-xs text-white/40 text-center flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Link expires {new Date(linkInfo.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Loading content
  if (isLoadingContent) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-accent-yellow mx-auto" />
          <p className="text-white/60">Loading review content...</p>
        </div>
      </div>
    );
  }

  // Main review interface
  return (
    <div className="min-h-screen bg-charcoal-black flex flex-col">
      {/* Header */}
      <header className="bg-surface-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">{linkInfo.name}</h1>
            {assets.length > 1 && (
              <span className="text-sm text-white/60">
                {currentAssetIndex + 1} of {assets.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <User className="w-4 h-4" />
              {session.displayName}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Asset list sidebar (if multiple assets) */}
        {assets.length > 1 && (
          <aside className="w-64 bg-surface-900 border-r border-white/10 overflow-y-auto">
            <div className="p-3">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Assets to Review
              </h2>
              <div className="space-y-1">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg transition-colors',
                      asset.id === selectedAsset?.id
                        ? 'bg-accent-yellow/20 text-accent-yellow'
                        : 'text-white/80 hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{asset.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Video and notes area */}
        <main className="flex-1 flex flex-col lg:flex-row">
          {/* Video player */}
          <div className="flex-1 p-4 min-h-0">
            {selectedAsset && selectedVersion ? (
              <div className="h-full flex flex-col">
                {/* Asset navigation */}
                {assets.length > 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToPrevious}
                      disabled={!hasPrevious}
                      className="text-white/60"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <h2 className="text-lg font-medium text-white">{selectedAsset.name}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToNext}
                      disabled={!hasNext}
                      className="text-white/60"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Video */}
                <div className="flex-1 min-h-0">
                  <ReviewVideoPlayer
                    asset={selectedAsset as ReviewAsset}
                    version={selectedVersion as ReviewVersion}
                    notes={notes}
                    onTimeUpdate={handleTimeUpdate}
                    onNoteClick={handleNoteClick}
                    canEdit={linkInfo.can_comment}
                    className="h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-white/60">
                <p>Select an asset to review</p>
              </div>
            )}
          </div>

          {/* Notes panel */}
          <aside className="w-full lg:w-96 bg-surface-900 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Notes & Feedback
              </h3>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No notes yet</p>
                  {linkInfo.can_comment && (
                    <p className="text-sm">Add a note below to leave feedback</p>
                  )}
                </div>
              ) : (
                notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => handleNoteClick(note)}
                    className="w-full text-left bg-surface-800 rounded-lg p-3 hover:bg-surface-700 transition-colors"
                  >
                    {note.timecode_seconds !== null && (
                      <Badge variant="secondary" className="bg-accent-yellow/20 text-accent-yellow mb-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimecode(note.timecode_seconds)}
                      </Badge>
                    )}
                    <p className="text-white text-sm">{note.content}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
                      <User className="w-3 h-3" />
                      {note.external_author_name || note.created_by_user?.display_name || 'Anonymous'}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Add note form */}
            {linkInfo.can_comment && (
              <div className="p-4 border-t border-white/10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <Clock className="w-3 h-3" />
                    Note at {formatTimecode(currentTime)}
                  </div>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Add your feedback..."
                    className="bg-surface-800 border-white/10 resize-none"
                    rows={3}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!noteContent.trim() || isSubmittingNote}
                    className="w-full bg-accent-yellow text-black hover:bg-accent-yellow/90"
                  >
                    {isSubmittingNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Add Note
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
};

// Helper function
function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default ExternalReviewerView;
