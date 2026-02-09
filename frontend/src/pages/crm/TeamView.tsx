import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, Mail, MessageSquare, Monitor } from 'lucide-react';
import { useCRMReps } from '@/hooks/crm';

const TeamView = () => {
  const { data, isLoading } = useCRMReps();
  const reps = data?.reps || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-heading text-bone-white">Sales Team</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading text-bone-white">Sales Team</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reps.map((rep: any) => (
          <Card key={rep.id} className="bg-charcoal-black border-muted-gray/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {rep.avatar_url ? (
                  <img src={rep.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent-yellow" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-bone-white text-base">{rep.full_name}</CardTitle>
                  <div className="text-xs text-muted-gray">{rep.email}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="p-2 rounded bg-muted-gray/10">
                  <div className="text-lg font-semibold text-bone-white">{rep.contact_count || 0}</div>
                  <div className="text-xs text-muted-gray">Contacts</div>
                </div>
                <div className="p-2 rounded bg-muted-gray/10">
                  <div className="text-lg font-semibold text-bone-white">{rep.activities_today || 0}</div>
                  <div className="text-xs text-muted-gray">Today</div>
                </div>
                <div className="p-2 rounded bg-muted-gray/10">
                  <div className="text-lg font-semibold text-bone-white">{rep.activities_30d || 0}</div>
                  <div className="text-xs text-muted-gray">30d</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-gray">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {rep.today_calls || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {rep.today_emails || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {rep.today_texts || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> {rep.today_demos || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reps.length === 0 && (
        <div className="text-center py-12 text-muted-gray">
          No sales agents found. Assign the sales_agent role to team members.
        </div>
      )}
    </div>
  );
};

export default TeamView;
