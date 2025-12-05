import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { FilmmakerProfileData } from '@/types';

interface ProfileStatusProps {
  profile: Pick<FilmmakerProfileData, 'accepting_work' | 'available_for' | 'preferred_locations' | 'contact_method'>;
}

const ProfileStatus = ({ profile }: ProfileStatusProps) => {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/20">
      <CardHeader>
        <CardTitle className="text-lg font-heading">Current Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 p-4 rounded-md bg-muted-gray/10">
          {profile.accepting_work ? (
            <CheckCircle className="h-8 w-8 text-green-400 flex-shrink-0" />
          ) : (
            <XCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-bone-white">
              {profile.accepting_work ? 'Currently Accepting Work' : 'Not Currently Available'}
            </p>
            <p className="text-sm text-muted-gray">
              {profile.accepting_work
                ? 'This filmmaker is open to new opportunities.'
                : 'This filmmaker is not looking for new projects at this time.'}
            </p>
          </div>
        </div>

        {profile.accepting_work && (
          <div className="space-y-4 pt-4 border-t border-muted-gray/20">
            {profile.available_for && profile.available_for.length > 0 && (
              <div>
                <h4 className="font-semibold text-bone-white mb-2">Available For</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.available_for.map(item => (
                    <Badge key={item} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.preferred_locations && profile.preferred_locations.length > 0 && (
               <div>
                <h4 className="font-semibold text-bone-white mb-2">Preferred Locations</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.preferred_locations.map(item => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  ))}
                </div>
              </div>
            )}
             {profile.contact_method && (
               <div>
                <h4 className="font-semibold text-bone-white mb-2">Preferred Contact Method</h4>
                <p className="text-muted-gray">{profile.contact_method}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileStatus;