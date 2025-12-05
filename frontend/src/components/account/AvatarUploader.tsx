import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, UploadCloud, Loader2 } from 'lucide-react';

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
    const fileExt = file.name.split('.').pop();
    const filePath = `${session.user.id}/${Math.random()}.${fileExt}`;

    setIsUploading(true);

    // It's good practice to remove the old avatar to save space
    if (session.user.user_metadata.avatar_url) {
        const oldAvatarPath = session.user.user_metadata.avatar_url.split('/avatars/').pop();
        if (oldAvatarPath) {
            await supabase.storage.from('avatars').remove([oldAvatarPath]);
        }
    }

    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

    if (uploadError) {
      toast.error(`Upload failed: ${uploadError.message}`);
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    const { error: updateUserError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });

    if (updateUserError) {
      toast.error(`Failed to update auth profile: ${updateUserError.message}`);
      setIsUploading(false);
      return;
    }
    
    // Also update the public profiles table to keep it in sync
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', session.user.id);

    // And the filmmaker profile, if it exists
    await supabase
      .from('filmmaker_profiles')
      .update({ profile_image_url: publicUrl })
      .eq('user_id', session.user.id);

    setIsUploading(false);
    toast.success("Profile picture updated!");
    await supabase.auth.refreshSession();
    if (onUploadSuccess) {
        onUploadSuccess();
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