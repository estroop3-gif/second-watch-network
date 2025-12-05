import React from 'react';
import { Search } from 'lucide-react';

type Props = {
  title: string;
  description?: string;
};

const EmptyState: React.FC<Props> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4 border border-dashed border-muted-gray/40 rounded-lg bg-charcoal-black/40">
      <div className="p-3 rounded-full bg-charcoal-black/70 border border-muted-gray/30 mb-4">
        <Search className="h-6 w-6 text-muted-gray" />
      </div>
      <h3 className="text-xl font-semibold mb-1">{title}</h3>
      {description && <p className="text-muted-gray max-w-md">{description}</p>}
    </div>
  );
};

export default EmptyState;