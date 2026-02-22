import { Mail } from 'lucide-react';

const MediaEmail = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center">
        <Mail className="h-8 w-8 text-accent-yellow" />
      </div>
      <div className="text-center max-w-md space-y-2">
        <h2 className="text-xl font-heading text-bone-white">Media Hub Email</h2>
        <p className="text-sm text-muted-gray">
          Email integration coming soon. Media team members will be able to send and receive
          emails directly from the Media Hub using shared and individual email accounts.
        </p>
      </div>
    </div>
  );
};

export default MediaEmail;
