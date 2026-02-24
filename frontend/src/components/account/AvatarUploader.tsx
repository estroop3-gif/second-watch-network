import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, UploadCloud, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface AvatarUploaderProps {
  avatarUrl: string | null | undefined;
  onUploadSuccess?: (newAvatarUrl: string) => void;
}

/**
 * Preload an image to verify it's actually accessible at the given URL.
 * Returns true if the image loads, false on error/timeout.
 */
function verifyImageLoads(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(false);
    }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ avatarUrl, onUploadSuccess }) => {
  const { session } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  // Local state to show the new avatar immediately after upload
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  // Track whether we have a confirmed upload so stale props can't override it
  const confirmedUploadRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Once the prop catches up to the confirmed upload, clear local override
  useEffect(() => {
    if (confirmedUploadRef.current && avatarUrl && localAvatarUrl && avatarUrl === localAvatarUrl) {
      confirmedUploadRef.current = false;
      setLocalAvatarUrl(null);
    }
  }, [avatarUrl, localAvatarUrl]);

  const displayUrl = localAvatarUrl || avatarUrl;

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !session) return;

    const file = event.target.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be less than 10MB');
      return;
    }

    // Show immediate preview from local file
    const localPreview = URL.createObjectURL(file);
    setLocalAvatarUrl(localPreview);
    setIsUploading(true);

    try {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated — please log in again');

      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/v1/profiles/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail || `Server error (${response.status})`);
      }

      const result = await response.json();

      // Validate the server returned a usable avatar URL
      if (!result.avatar_url) {
        throw new Error('Server did not return an image URL — upload may have failed');
      }

      // Verify the image is actually accessible at the returned URL
      const imageOk = await verifyImageLoads(result.avatar_url);
      if (!imageOk) {
        // Image uploaded but not yet accessible — still call onUploadSuccess
        // since the DB was updated, but warn the user
        console.warn('[AvatarUploader] Image not immediately accessible at:', result.avatar_url);
      }

      // Update local preview to the actual S3 URL and mark as confirmed
      // so stale prop data from cache can't override it
      setLocalAvatarUrl(result.avatar_url);
      confirmedUploadRef.current = true;

      // Revoke the blob URL
      URL.revokeObjectURL(localPreview);

      setIsUploading(false);
      toast.success('Profile picture updated!');

      // Notify parent with the new URL
      if (onUploadSuccess) {
        onUploadSuccess(result.avatar_url);
      }
    } catch (error) {
      setIsUploading(false);
      // Revert preview on error
      setLocalAvatarUrl(null);
      URL.revokeObjectURL(localPreview);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Upload failed: ${msg}`);
      console.error('[AvatarUploader] Upload error:', error);
    }

    // Reset file input so the same file can be re-selected
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="w-32 h-32 border-4 border-muted-gray">
        <AvatarImage src={displayUrl || undefined} />
        <AvatarFallback className="bg-muted-gray">
          <User className="w-16 h-16 text-bone-white" />
        </AvatarFallback>
      </Avatar>
      <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
      <Button type="button" onClick={() => avatarInputRef.current?.click()} disabled={isUploading} className="w-full bg-charcoal-black border-2 border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black">
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        {isUploading ? 'Uploading...' : 'Change Photo'}
      </Button>
    </div>
  );
};
