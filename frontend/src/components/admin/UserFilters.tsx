import { useState, useEffect } from 'react';
import { Search, X, Filter, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface UserFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  search: string;
  roles: string[];
  status: string;
  dateFrom: string;
  dateTo: string;
}

const AVAILABLE_ROLES = [
  { id: 'superadmin', label: 'Superadmin', color: 'bg-red-500' },
  { id: 'admin', label: 'Admin', color: 'bg-orange-500' },
  { id: 'moderator', label: 'Moderator', color: 'bg-yellow-500' },
  { id: 'lodge_officer', label: 'Lodge Officer', color: 'bg-purple-500' },
  { id: 'order_member', label: 'Order Member', color: 'bg-blue-500' },
  { id: 'partner', label: 'Partner', color: 'bg-green-500' },
  { id: 'filmmaker', label: 'Filmmaker', color: 'bg-cyan-500' },
  { id: 'premium', label: 'Premium', color: 'bg-amber-500' },
];

export const UserFilters = ({ onFiltersChange, initialFilters }: UserFiltersProps) => {
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialFilters?.roles || []);
  const [status, setStatus] = useState(initialFilters?.status || 'all');
  const [dateFrom, setDateFrom] = useState(initialFilters?.dateFrom || '');
  const [dateTo, setDateTo] = useState(initialFilters?.dateTo || '');
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchDebounce) clearTimeout(searchDebounce);

    const timeout = setTimeout(() => {
      onFiltersChange({
        search,
        roles: selectedRoles,
        status,
        dateFrom,
        dateTo,
      });
    }, 300);

    setSearchDebounce(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [search]);

  // Immediate filter updates (non-search)
  useEffect(() => {
    onFiltersChange({
      search,
      roles: selectedRoles,
      status,
      dateFrom,
      dateTo,
    });
  }, [selectedRoles, status, dateFrom, dateTo]);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev, roleId]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedRoles([]);
    setStatus('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || selectedRoles.length > 0 || status !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Search and Status Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-charcoal-black border-muted-gray text-bone-white placeholder:text-muted-gray"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray hover:text-bone-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray text-bone-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray">
            <SelectItem value="all" className="text-bone-white">All Status</SelectItem>
            <SelectItem value="active" className="text-bone-white">Active</SelectItem>
            <SelectItem value="banned" className="text-bone-white text-primary-red">Banned</SelectItem>
          </SelectContent>
        </Select>

        {/* Role Filter Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`bg-charcoal-black border-muted-gray text-bone-white ${
                selectedRoles.length > 0 ? 'border-accent-yellow' : ''
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Roles
              {selectedRoles.length > 0 && (
                <Badge className="ml-2 bg-accent-yellow text-charcoal-black">
                  {selectedRoles.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-charcoal-black border-muted-gray p-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-bone-white">Filter by Role</p>
              {AVAILABLE_ROLES.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={role.id}
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                    className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                  />
                  <label
                    htmlFor={role.id}
                    className="text-sm text-bone-white cursor-pointer flex items-center gap-2"
                  >
                    <span className={`w-2 h-2 rounded-full ${role.color}`} />
                    {role.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Filter Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`bg-charcoal-black border-muted-gray text-bone-white ${
                dateFrom || dateTo ? 'border-accent-yellow' : ''
              }`}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Date
              {(dateFrom || dateTo) && (
                <Badge className="ml-2 bg-accent-yellow text-charcoal-black">!</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 bg-charcoal-black border-muted-gray p-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-bone-white">Filter by Join Date</p>
              <div className="space-y-2">
                <label className="text-xs text-muted-gray">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-charcoal-black border-muted-gray text-bone-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-gray">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-charcoal-black border-muted-gray text-bone-white"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="text-muted-gray hover:text-bone-white"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDateFrom(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setDateTo('');
          }}
          className={`bg-charcoal-black border-muted-gray text-bone-white text-xs ${
            dateFrom && !dateTo ? 'border-accent-yellow' : ''
          }`}
        >
          New This Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedRoles(['filmmaker'])}
          className={`bg-charcoal-black border-muted-gray text-bone-white text-xs ${
            selectedRoles.length === 1 && selectedRoles[0] === 'filmmaker' ? 'border-accent-yellow' : ''
          }`}
        >
          Filmmakers
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedRoles(['order_member'])}
          className={`bg-charcoal-black border-muted-gray text-bone-white text-xs ${
            selectedRoles.length === 1 && selectedRoles[0] === 'order_member' ? 'border-accent-yellow' : ''
          }`}
        >
          Order Members
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedRoles(['premium'])}
          className={`bg-charcoal-black border-muted-gray text-bone-white text-xs ${
            selectedRoles.length === 1 && selectedRoles[0] === 'premium' ? 'border-accent-yellow' : ''
          }`}
        >
          Premium
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatus('banned')}
          className={`bg-charcoal-black border-muted-gray text-primary-red text-xs ${
            status === 'banned' ? 'border-primary-red' : ''
          }`}
        >
          Banned
        </Button>
      </div>

      {/* Active Filters Display */}
      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRoles.map((roleId) => {
            const role = AVAILABLE_ROLES.find((r) => r.id === roleId);
            return (
              <Badge
                key={roleId}
                variant="outline"
                className="border-accent-yellow text-accent-yellow cursor-pointer"
                onClick={() => toggleRole(roleId)}
              >
                {role?.label}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserFilters;
