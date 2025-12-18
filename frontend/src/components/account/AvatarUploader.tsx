import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, UploadCloud, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface AvatarUploaderProps {
  avatarUrl: string | null | undefined;
  onUploadSuccess?: () => void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ avatarUrl, onUploadSuccess }) => {
  const { session } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !session) return;

    const file = event.target.files[0];
    setIsUploading(true);

    try {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

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
        throw new Error(error.detail);
      }

      const result = await response.json();

      setIsUploading(false);
      toast.success('Profile picture updated!');

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setIsUploading(false);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="w-32 h-32 border-4 border-muted-gray">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-muted-gray">
          <User className="w-16 h-16 text-bone-white" />
        </AvatarFallback>
      </Avatar>
      <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
      <Button onClick={() => avatarInputRef.current?.click()} disabled={isUploading} className="w-full bg-charcoal-black border-2 border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black">
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        {isUploading ? 'Uploading...' : 'Change Photo'}
      </Button>
    </div>
  );
};
