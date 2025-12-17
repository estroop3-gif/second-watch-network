/**
 * FastAPI Backend Client
 * Complete API client for Second Watch Network
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface RequestOptions extends RequestInit {
  token?: string
}

class APIClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    this.loadToken()
  }

  private loadToken() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token)
      } else {
        localStorage.removeItem('access_token')
      }
    }
  }

  getToken(): string | null {
    return this.token
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
    }
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = this.getToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || 'Request failed')
    }

    return response.json()
  }

  // Generic REST methods for modular API files
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string, options?: { data?: any }): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: options?.data ? JSON.stringify(options.data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async signUp(email: string, password: string, fullName?: string) {
    const response = await this.request<{ access_token: string; user: any }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    })
    if (response.access_token) {
      this.setToken(response.access_token)
    }
    return response
  }

  async signIn(email: string, password: string) {
    const response = await this.request<{ access_token: string; user: any }>('/api/v1/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (response.access_token) {
      this.setToken(response.access_token)
    }
    return response
  }

  async signOut() {
    await this.request('/api/v1/auth/signout', { method: 'POST' })
    this.clearToken()
  }

  async getCurrentUser() {
    return this.request<any>('/api/v1/auth/me')
  }

  // ============================================================================
  // PROFILES
  // ============================================================================

  async getProfile(userId: string) {
    return this.request<any>(`/api/v1/profiles/${userId}`)
  }

  async getProfileByUsername(username: string) {
    return this.request<any>(`/api/v1/profiles/username/${username}`)
  }

  async updateProfile(userId: string, data: any) {
    return this.request<any>(`/api/v1/profiles/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getFilmmakerProfile(userId: string) {
    return this.request<any>(`/api/v1/profiles/filmmaker/${userId}`)
  }

  async createFilmmakerProfile(data: any) {
    return this.request<any>('/api/v1/profiles/filmmaker', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateFilmmakerProfile(userId: string, data: any) {
    return this.request<any>(`/api/v1/profiles/filmmaker/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async listFilmmakers(params?: { skip?: number; limit?: number; department?: string; accepting_work?: boolean }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.department) query.append('department', params.department)
    if (params?.accepting_work !== undefined) query.append('accepting_work', params.accepting_work.toString())
    
    return this.request<any[]>(`/api/v1/profiles/filmmaker/list?${query}`)
  }

  // ============================================================================
  // SUBMISSIONS
  // ============================================================================

  async createSubmission(userId: string, data: any) {
    return this.request<any>(`/api/v1/submissions/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getSubmission(submissionId: string) {
    return this.request<any>(`/api/v1/submissions/${submissionId}`)
  }

  async listSubmissions(params?: { skip?: number; limit?: number; status?: string; user_id?: string }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.user_id) query.append('user_id', params.user_id)
    
    return this.request<any[]>(`/api/v1/submissions/?${query}`)
  }

  async updateSubmission(submissionId: string, data: any) {
    return this.request<any>(`/api/v1/submissions/${submissionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteSubmission(submissionId: string) {
    return this.request<any>(`/api/v1/submissions/${submissionId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // FORUM
  // ============================================================================

  async listForumCategories() {
    return this.request<any[]>('/api/v1/forum/categories')
  }

  async createForumCategory(name: string, description: string, slug: string) {
    return this.request<any>('/api/v1/forum/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description, slug }),
    })
  }

  async listForumThreads(params?: { skip?: number; limit?: number; category_id?: string; is_pinned?: boolean }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.category_id) query.append('category_id', params.category_id)
    if (params?.is_pinned !== undefined) query.append('is_pinned', params.is_pinned.toString())
    
    return this.request<any[]>(`/api/v1/forum/threads?${query}`)
  }

  async getForumThread(threadId: string) {
    return this.request<any>(`/api/v1/forum/threads/${threadId}`)
  }

  async createForumThread(authorId: string, data: any) {
    return this.request<any>(`/api/v1/forum/threads?author_id=${authorId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateForumThread(threadId: string, data: any) {
    return this.request<any>(`/api/v1/forum/threads/${threadId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteForumThread(threadId: string) {
    return this.request<any>(`/api/v1/forum/threads/${threadId}`, {
      method: 'DELETE',
    })
  }

  async listThreadReplies(threadId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    
    return this.request<any[]>(`/api/v1/forum/threads/${threadId}/replies?${query}`)
  }

  async createForumReply(authorId: string, data: any) {
    return this.request<any>(`/api/v1/forum/replies?author_id=${authorId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteForumReply(replyId: string) {
    return this.request<any>(`/api/v1/forum/replies/${replyId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // MESSAGES
  // ============================================================================

  async listConversations(userId: string) {
    return this.request<any[]>(`/api/v1/messages/conversations?user_id=${userId}`)
  }

  async listConversationMessages(conversationId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    
    return this.request<any[]>(`/api/v1/messages/conversations/${conversationId}/messages?${query}`)
  }

  async sendMessage(senderId: string, data: any) {
    return this.request<any>(`/api/v1/messages/?sender_id=${senderId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async markMessagesRead(messageIds: string[]) {
    return this.request<any>('/api/v1/messages/mark-read', {
      method: 'PUT',
      body: JSON.stringify(messageIds),
    })
  }

  async getUnreadMessageCount(userId: string) {
    return this.request<{ count: number }>(`/api/v1/messages/unread-count?user_id=${userId}`)
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  async listNotifications(userId: string, params?: { skip?: number; limit?: number; status?: string; type?: string }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.type) query.append('type', params.type)
    
    return this.request<any[]>(`/api/v1/notifications/?${query}`)
  }

  async getNotificationCounts(userId: string) {
    return this.request<any>(`/api/v1/notifications/counts?user_id=${userId}`)
  }

  async markNotificationsRead(notificationIds: string[]) {
    return this.request<any>('/api/v1/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify(notificationIds),
    })
  }

  async createNotification(data: any) {
    return this.request<any>('/api/v1/notifications/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ============================================================================
  // CONNECTIONS
  // ============================================================================

  async createConnectionRequest(requesterId: string, data: any) {
    return this.request<any>(`/api/v1/connections/?requester_id=${requesterId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listConnections(userId: string, params?: { status?: string; skip?: number; limit?: number }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.status) query.append('status', params.status)
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    
    return this.request<any[]>(`/api/v1/connections/?${query}`)
  }

  async updateConnection(connectionId: string, status: string) {
    return this.request<any>(`/api/v1/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  // ============================================================================
  // CONTENT
  // ============================================================================

  async listContent(params?: { skip?: number; limit?: number; content_type?: string }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.content_type) query.append('content_type', params.content_type)
    
    return this.request<any[]>(`/api/v1/content/?${query}`)
  }

  async getContent(contentId: string) {
    return this.request<any>(`/api/v1/content/${contentId}`)
  }

  async createContent(data: any) {
    return this.request<any>('/api/v1/content/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateContent(contentId: string, data: any) {
    return this.request<any>(`/api/v1/content/${contentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteContent(contentId: string) {
    return this.request<any>(`/api/v1/content/${contentId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // ADMIN
  // ============================================================================

  async getAdminDashboardStats() {
    return this.request<any>('/api/v1/admin/dashboard/stats')
  }

  async listAllUsers(params?: { skip?: number; limit?: number; role?: string }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.role) query.append('role', params.role)
    
    return this.request<any[]>(`/api/v1/admin/users?${query}`)
  }

  async banUser(userId: string, banned: boolean, reason?: string) {
    return this.request<any>('/api/v1/admin/users/ban', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, banned, reason }),
    })
  }

  async updateUserRole(userId: string, role: string) {
    return this.request<any>('/api/v1/admin/users/role', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    })
  }

  async deleteUser(userId: string) {
    return this.request<any>(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
    })
  }

  async listFilmmakerApplications(params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    
    return this.request<any[]>(`/api/v1/admin/applications/filmmakers?${query}`)
  }

  async listPartnerApplications(params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    
    return this.request<any[]>(`/api/v1/admin/applications/partners?${query}`)
  }

  // ============================================================================
  // AVAILABILITY
  // ============================================================================

  async listAvailability(userId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    
    return this.request<any[]>(`/api/v1/availability/?${query}`)
  }

  async getNewlyAvailableFilmmakers(days: number = 2) {
    return this.request<any[]>(`/api/v1/availability/newly-available?days=${days}`)
  }

  async createAvailability(userId: string, data: any) {
    return this.request<any>(`/api/v1/availability/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAvailability(availabilityId: string, data: any) {
    return this.request<any>(`/api/v1/availability/${availabilityId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAvailability(availabilityId: string) {
    return this.request<any>(`/api/v1/availability/${availabilityId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // CREDITS
  // ============================================================================

  async listCredits(userId: string) {
    return this.request<any[]>(`/api/v1/credits/?user_id=${userId}`)
  }

  async createCredit(userId: string, data: any) {
    return this.request<any>(`/api/v1/credits/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteCredit(creditId: string) {
    return this.request<any>(`/api/v1/credits/${creditId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // COMMUNITY & SEARCH
  // ============================================================================

  async searchFilmmakers(query?: string, params?: { skip?: number; limit?: number; sort_by?: string }) {
    const searchParams = new URLSearchParams()
    if (query) searchParams.append('query', query)
    if (params?.skip !== undefined) searchParams.append('skip', params.skip.toString())
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString())
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by)
    
    return this.request<any[]>(`/api/v1/community/filmmakers?${searchParams}`)
  }

  async globalSearch(query: string, type?: string) {
    const params = new URLSearchParams({ query })
    if (type) params.append('type', type)

    return this.request<any>(`/api/v1/community/search?${params}`)
  }

  // ============================================================================
  // BACKLOT REVIEW (Frame.io-style)
  // ============================================================================

  // Review Assets
  async listReviewAssets(projectId: string) {
    return this.request<{ assets: any[] }>(`/api/v1/backlot/projects/${projectId}/review/assets`)
  }

  async createReviewAsset(projectId: string, data: {
    name: string;
    description?: string | null;
    video_url: string;
    video_provider?: string;
    external_video_id?: string | null;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
    linked_scene_id?: string | null;
    linked_shot_list_id?: string | null;
  }) {
    return this.request<{ asset: any }>(`/api/v1/backlot/projects/${projectId}/review/assets`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getReviewAsset(assetId: string) {
    return this.request<{ asset: any }>(`/api/v1/backlot/review/assets/${assetId}`)
  }

  async updateReviewAsset(assetId: string, data: {
    name?: string;
    description?: string | null;
    thumbnail_url?: string | null;
    linked_scene_id?: string | null;
    linked_shot_list_id?: string | null;
  }) {
    return this.request<{ asset: any }>(`/api/v1/backlot/review/assets/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteReviewAsset(assetId: string) {
    return this.request<{ success: boolean }>(`/api/v1/backlot/review/assets/${assetId}`, {
      method: 'DELETE',
    })
  }

  // Review Versions
  async createReviewVersion(assetId: string, data: {
    name?: string | null;
    video_url: string;
    video_provider?: string;
    external_video_id?: string | null;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
  }) {
    return this.request<{ version: any }>(`/api/v1/backlot/review/assets/${assetId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async makeVersionActive(versionId: string) {
    return this.request<{ success: boolean }>(`/api/v1/backlot/review/versions/${versionId}/make-active`, {
      method: 'POST',
    })
  }

  async deleteReviewVersion(versionId: string) {
    return this.request<{ success: boolean }>(`/api/v1/backlot/review/versions/${versionId}`, {
      method: 'DELETE',
    })
  }

  // Review Notes
  async listReviewNotes(versionId: string) {
    return this.request<{ notes: any[] }>(`/api/v1/backlot/review/versions/${versionId}/notes`)
  }

  async createReviewNote(versionId: string, data: {
    timecode_seconds?: number | null;
    timecode_end_seconds?: number | null;
    content: string;
    drawing_data?: Record<string, unknown> | null;
  }) {
    return this.request<{ note: any }>(`/api/v1/backlot/review/versions/${versionId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateReviewNote(noteId: string, data: {
    content?: string;
    drawing_data?: Record<string, unknown> | null;
    is_resolved?: boolean;
  }) {
    return this.request<{ note: any }>(`/api/v1/backlot/review/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteReviewNote(noteId: string) {
    return this.request<{ success: boolean }>(`/api/v1/backlot/review/notes/${noteId}`, {
      method: 'DELETE',
    })
  }

  // Review Note Replies
  async createNoteReply(noteId: string, content: string) {
    return this.request<{ reply: any }>(`/api/v1/backlot/review/notes/${noteId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  async deleteNoteReply(replyId: string) {
    return this.request<{ success: boolean }>(`/api/v1/backlot/review/replies/${replyId}`, {
      method: 'DELETE',
    })
  }

  // Note to Task Integration
  async createTaskFromNote(noteId: string, data: {
    task_list_id: string;
    title?: string;
    priority?: string;
    assignee_user_id?: string | null;
  }) {
    return this.request<{ task: any }>(`/api/v1/backlot/review/notes/${noteId}/create-task`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

// Export singleton instance
export const api = new APIClient()
export const apiClient = api // Alias for hooks that use apiClient
export default api
