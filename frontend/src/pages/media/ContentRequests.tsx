import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, ChevronLeft, ChevronRight, Loader2, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useContentRequests } from '@/hooks/media';
import { usePermissions } from '@/hooks/usePermissions';
import RequestStatusBadge from '@/components/media/RequestStatusBadge';
import RequestPriorityBadge from '@/components/media/RequestPriorityBadge';
import { formatDate } from '@/lib/dateUtils';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'in_production', label: 'In Production' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'posted', label: 'Posted' },
];

const ContentRequests = () => {
  const { hasAnyRole } = usePermissions();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);
  const [searchParams, setSearchParams] = useSearchParams();

  const scopeParam = searchParams.get('scope');
  const defaultScope = isTeam ? (scopeParam || 'all') : 'mine';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  // Reset offset on filter change
  useEffect(() => {
    setOffset(0);
  }, [search, statusFilter, priorityFilter]);

  const { data, isLoading } = useContentRequests({
    scope: defaultScope,
    search: search || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit,
    offset,
  });

  const requests = data?.requests || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-heading text-bone-white">
          {defaultScope === 'all' ? 'All Requests' : 'My Requests'}
        </h1>
        <Link to="/media/requests/new">
          <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
            <Plus className="h-4 w-4 mr-2" /> New Request
          </Button>
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray/30 text-bone-white">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray/30">
            <SelectItem value="all" className="text-bone-white">All Priorities</SelectItem>
            <SelectItem value="low" className="text-bone-white">Low</SelectItem>
            <SelectItem value="normal" className="text-bone-white">Normal</SelectItem>
            <SelectItem value="high" className="text-bone-white">High</SelectItem>
            <SelectItem value="urgent" className="text-bone-white">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-accent-yellow text-charcoal-black'
                : 'text-muted-gray hover:text-bone-white hover:bg-muted-gray/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-gray mx-auto mb-3" />
          <p className="text-muted-gray">No requests found.</p>
          <Link to="/media/requests/new" className="text-accent-yellow text-sm hover:underline mt-2 inline-block">
            Create your first request
          </Link>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted-gray/30">
                  <th className="text-left py-3 px-3 text-muted-gray font-medium">Title</th>
                  <th className="text-left py-3 px-3 text-muted-gray font-medium hidden md:table-cell">Type</th>
                  <th className="text-left py-3 px-3 text-muted-gray font-medium">Status</th>
                  <th className="text-left py-3 px-3 text-muted-gray font-medium hidden sm:table-cell">Priority</th>
                  {defaultScope === 'all' && (
                    <th className="text-left py-3 px-3 text-muted-gray font-medium hidden lg:table-cell">Requester</th>
                  )}
                  <th className="text-left py-3 px-3 text-muted-gray font-medium hidden lg:table-cell">Assigned To</th>
                  <th className="text-left py-3 px-3 text-muted-gray font-medium hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req: any) => (
                  <tr
                    key={req.id}
                    className="border-b border-muted-gray/10 hover:bg-muted-gray/10 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <Link
                        to={`/media/requests/${req.id}`}
                        className="text-bone-white hover:text-accent-yellow font-medium truncate block max-w-[240px]"
                      >
                        {req.title}
                      </Link>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <span className="text-muted-gray capitalize">
                        {req.content_type?.replace(/_/g, ' ') || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <RequestPriorityBadge priority={req.priority} />
                    </td>
                    {defaultScope === 'all' && (
                      <td className="py-3 px-3 hidden lg:table-cell">
                        <span className="text-muted-gray text-xs">
                          {req.requester_name || '-'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3 hidden lg:table-cell">
                      <span className="text-muted-gray text-xs">
                        {req.assigned_to_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <span className="text-muted-gray text-xs">
                        {formatDate(req.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-gray">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-gray">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                  className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ContentRequests;
