import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FilmmakerApplication } from '@/types';
import { Badge } from '../ui/badge';

interface ViewApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: FilmmakerApplication;
}

const ViewApplicationModal = ({ isOpen, onClose, application }: ViewApplicationModalProps) => {
  if (!application) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-charcoal-black text-bone-white border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-2xl text-accent-yellow">Filmmaker Application</DialogTitle>
          <DialogDescription>
            Full details for {application.full_name}'s application.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><p className="font-semibold">Full Name:</p><p>{application.full_name}</p></div>
            <div><p className="font-semibold">Display Name:</p><p>{application.display_name}</p></div>
            <div><p className="font-semibold">Email:</p><p>{application.email}</p></div>
            <div><p className="font-semibold">Location:</p><p>{application.location}</p></div>
          </div>
          <div><p className="font-semibold">Portfolio Link:</p><a href={application.portfolio_link} target="_blank" rel="noreferrer" className="text-accent-yellow hover:underline">{application.portfolio_link}</a></div>
          {application.professional_profile_link && <div><p className="font-semibold">Professional Profile:</p><a href={application.professional_profile_link} target="_blank" rel="noreferrer" className="text-accent-yellow hover:underline">{application.professional_profile_link}</a></div>}
          <div><p className="font-semibold">Experience:</p><p>{application.years_of_experience}</p></div>
          <div>
            <p className="font-semibold">Primary Roles:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {application.primary_roles?.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
            </div>
          </div>
          <div>
            <p className="font-semibold">Top Projects:</p>
            <div className="space-y-4 mt-2">
              {application.top_projects?.map((proj, index) => (
                <div key={index} className="p-3 border border-muted-gray rounded-md">
                  <p className="font-bold">{proj.title} - <span className="font-normal italic">{proj.role}</span></p>
                  {proj.link && <a href={proj.link} target="_blank" rel="noreferrer" className="text-sm text-accent-yellow hover:underline">{proj.link}</a>}
                  <p className="text-sm mt-1">{proj.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold">Reason for Joining:</p>
            <p className="mt-1 p-3 bg-gray-800/50 rounded-md whitespace-pre-wrap">{application.join_reason}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewApplicationModal;