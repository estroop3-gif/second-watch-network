import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

const NewlyAvailableFilmmakers = ({ filmmakers }: { filmmakers: any[] | undefined }) => {
  if (!filmmakers || filmmakers.length === 0) {
    return (
        <div className="mt-16 p-8 border-2 border-dashed border-muted-gray transform -rotate-1 text-center">
            <h2 className="text-2xl font-heading mb-2">No New Availability</h2>
            <p className="text-muted-gray">No filmmakers have updated their availability in the last 48 hours.</p>
        </div>
    );
  }

  return (
    <div className="mt-16">
        <Card className="transform -rotate-1">
        <CardHeader>
            <CardTitle className="text-2xl font-heading">Newly Available Filmmakers</CardTitle>
            <p className="text-muted-gray">Updated in the last 48 hours.</p>
        </CardHeader>
        <CardContent>
            <ul className="space-y-4">
            {filmmakers.map(avail => (
                <li key={avail.id} className="flex items-center gap-4 p-3 bg-charcoal-black rounded-md border border-muted-gray/20">
                <Avatar>
                    <AvatarImage src={avail.profiles?.avatar_url} />
                    <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                    <Link to={`/profile/${avail.profiles.username}`} className="font-bold hover:underline">{avail.profiles.full_name}</Link>
                    <p className="text-sm text-muted-gray">{avail.profiles.filmmaker_profiles[0]?.department || 'Filmmaker'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="font-semibold">{format(new Date(avail.start_date), 'MMM d')} - {format(new Date(avail.end_date), 'MMM d, yyyy')}</p>
                    <p className="text-xs text-muted-gray">Added {format(new Date(avail.created_at), 'MMM d')}</p>
                </div>
                </li>
            ))}
            </ul>
        </CardContent>
        </Card>
    </div>
  );
};

export default NewlyAvailableFilmmakers;