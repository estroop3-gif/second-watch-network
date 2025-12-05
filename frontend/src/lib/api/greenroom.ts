/**
 * Green Room API Client
 * Project Development & Voting Arena
 */

import { api } from '../api';

// ============ Types ============

export type CycleStatus = 'upcoming' | 'active' | 'closed';
export type ProjectStatus = 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Cycle {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_tickets_per_user: number;
  ticket_price: number;
  status: CycleStatus;
  created_at: string;
  updated_at: string;
  project_count?: number;
  total_votes?: number;
}

export interface Project {
  id: number;
  cycle_id: number;
  filmmaker_id: string;
  title: string;
  description: string;
  category?: string;
  video_url?: string;
  image_url?: string;
  status: ProjectStatus;
  vote_count: number;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  filmmaker_name?: string;
  user_vote_count?: number;
}

export interface VotingTicket {
  id: number;
  user_id: string;
  cycle_id: number;
  tickets_purchased: number;
  tickets_used: number;
  tickets_available: number;
  payment_status: PaymentStatus;
  created_at: string;
}

export interface Vote {
  id: number;
  user_id: string;
  project_id: number;
  cycle_id: number;
  tickets_allocated: number;
  created_at: string;
  project_title?: string;
}

export interface CycleResults {
  cycle_id: number;
  cycle_name: string;
  status: CycleStatus;
  total_projects: number;
  total_votes: number;
  total_voters: number;
  projects: ProjectResult[];
}

export interface ProjectResult {
  project_id: number;
  title: string;
  filmmaker_id: string;
  filmmaker_name?: string;
  vote_count: number;
  rank: number;
}

export interface UserStats {
  total_tickets_purchased: number;
  total_tickets_used: number;
  total_votes_cast: number;
  projects_submitted: number;
  projects_approved: number;
}

export interface CycleStats {
  cycle_id: number;
  total_projects: number;
  approved_projects: number;
  pending_projects: number;
  rejected_projects: number;
  total_tickets_sold: number;
  total_votes_cast: number;
  unique_voters: number;
  revenue: number;
}

// ============ Request Types ============

export interface CycleCreateRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_tickets_per_user?: number;
  ticket_price?: number;
}

export interface CycleUpdateRequest {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  max_tickets_per_user?: number;
  ticket_price?: number;
  status?: CycleStatus;
}

export interface ProjectSubmitRequest {
  cycle_id: number;
  title: string;
  description: string;
  category?: string;
  video_url?: string;
  image_url?: string;
}

export interface ProjectUpdateRequest {
  title?: string;
  description?: string;
  category?: string;
  video_url?: string;
  image_url?: string;
}

export interface TicketPurchaseRequest {
  cycle_id: number;
  ticket_count: number;
}

export interface TicketPurchaseResponse {
  checkout_session_id: string;
  checkout_url: string;
  amount: number;
  ticket_count: number;
}

export interface VoteCastRequest {
  project_id: number;
  tickets_allocated: number;
}

// ============ API Client ============

export class GreenRoomAPI {
  private baseURL = '/api/v1/greenroom';

  // ============ Public Endpoints ============

  /**
   * List all cycles
   */
  async listCycles(status?: CycleStatus): Promise<Cycle[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    return api.get(`${this.baseURL}/cycles?${params}`);
  }

  /**
   * Get cycle details
   */
  async getCycle(id: number): Promise<Cycle> {
    return api.get(`${this.baseURL}/cycles/${id}`);
  }

  /**
   * List projects in a cycle
   */
  async listProjects(
    cycleId: number,
    options?: {
      status?: ProjectStatus;
      sort_by?: 'votes' | 'recent' | 'title';
      skip?: number;
      limit?: number;
    }
  ): Promise<Project[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.sort_by) params.append('sort_by', options.sort_by);
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());

    return api.get(`${this.baseURL}/cycles/${cycleId}/projects?${params}`);
  }

  /**
   * Get project details
   */
  async getProject(id: number): Promise<Project> {
    return api.get(`${this.baseURL}/projects/${id}`);
  }

  /**
   * Get cycle results
   */
  async getCycleResults(cycleId: number): Promise<CycleResults> {
    return api.get(`${this.baseURL}/cycles/${cycleId}/results`);
  }

  // ============ User Endpoints ============

  /**
   * Get user's voting tickets
   */
  async getMyTickets(): Promise<VotingTicket[]> {
    return api.get(`${this.baseURL}/tickets/my-tickets`);
  }

  /**
   * Purchase voting tickets
   */
  async purchaseTickets(request: TicketPurchaseRequest): Promise<TicketPurchaseResponse> {
    return api.post(`${this.baseURL}/tickets/purchase`, request);
  }

  /**
   * Cast vote on a project (final, cannot be changed)
   */
  async castVote(vote: VoteCastRequest): Promise<Vote> {
    return api.post(`${this.baseURL}/votes/cast`, vote);
  }

  /**
   * Get user's votes
   */
  async getMyVotes(cycleId?: number): Promise<Vote[]> {
    const params = new URLSearchParams();
    if (cycleId) params.append('cycle_id', cycleId.toString());

    return api.get(`${this.baseURL}/votes/my-votes?${params}`);
  }

  /**
   * Get user statistics
   */
  async getMyStats(): Promise<UserStats> {
    return api.get(`${this.baseURL}/stats/my-stats`);
  }

  // ============ Filmmaker Endpoints ============

  /**
   * Submit a project
   */
  async submitProject(project: ProjectSubmitRequest): Promise<Project> {
    return api.post(`${this.baseURL}/projects/submit`, project);
  }

  /**
   * Get filmmaker's projects
   */
  async getMyProjects(): Promise<Project[]> {
    return api.get(`${this.baseURL}/projects/my-projects`);
  }

  /**
   * Update project (only if pending)
   */
  async updateProject(id: number, update: ProjectUpdateRequest): Promise<Project> {
    return api.put(`${this.baseURL}/projects/${id}`, update);
  }

  /**
   * Delete project (only if pending)
   */
  async deleteProject(id: number): Promise<void> {
    return api.delete(`${this.baseURL}/projects/${id}`);
  }

  // ============ Admin Endpoints ============

  /**
   * Create new cycle (admin only)
   */
  async createCycle(cycle: CycleCreateRequest): Promise<Cycle> {
    return api.post(`${this.baseURL}/cycles`, cycle);
  }

  /**
   * Update cycle (admin only)
   */
  async updateCycle(id: number, update: CycleUpdateRequest): Promise<Cycle> {
    return api.put(`${this.baseURL}/cycles/${id}`, update);
  }

  /**
   * Delete cycle (admin only)
   */
  async deleteCycle(id: number): Promise<void> {
    return api.delete(`${this.baseURL}/cycles/${id}`);
  }

  /**
   * Approve or reject project (admin only)
   */
  async approveProject(id: number, status: 'approved' | 'rejected'): Promise<Project> {
    return api.put(`${this.baseURL}/projects/${id}/approve`, { status });
  }

  /**
   * Get cycle statistics (admin only)
   */
  async getCycleStats(cycleId: number): Promise<CycleStats> {
    return api.get(`${this.baseURL}/cycles/${cycleId}/stats`);
  }
}

// Export singleton instance
export const greenroomAPI = new GreenRoomAPI();
