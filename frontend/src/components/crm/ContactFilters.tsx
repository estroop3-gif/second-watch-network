import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface ContactFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  temperature: string;
  onTemperatureChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
}

const ContactFilters = ({
  search, onSearchChange,
  temperature, onTemperatureChange,
  status, onStatusChange,
  sortBy, onSortByChange,
}: ContactFiltersProps) => {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 bg-charcoal-black border-muted-gray"
        />
      </div>

      <Select value={temperature} onValueChange={onTemperatureChange}>
        <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray">
          <SelectValue placeholder="Temperature" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Temps</SelectItem>
          <SelectItem value="cold">Cold</SelectItem>
          <SelectItem value="warm">Warm</SelectItem>
          <SelectItem value="hot">Hot</SelectItem>
          <SelectItem value="missed_opportunity">Missed Opportunity</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="do_not_contact">DNC</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">Newest</SelectItem>
          <SelectItem value="last_name">Last Name</SelectItem>
          <SelectItem value="company">Company</SelectItem>
          <SelectItem value="temperature">Temperature</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default ContactFilters;
