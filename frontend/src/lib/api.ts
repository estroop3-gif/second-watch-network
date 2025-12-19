/**
 * FastAPI Backend Client
 * Complete API client for Second Watch Network
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface RequestOptions extends RequestInit {
  token?: string
}

/**
 * Safe localStorage wrapper that handles private browsing mode
 * and other scenarios where localStorage might be unavailable
 */
const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key)
      }
    } catch (e) {
      console.warn('localStorage not available:', e)
    }
    return null
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value)
      }
    } catch (e) {
      console.warn('localStorage not available:', e)
    }
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key)
      }
    } catch (e) {
      console.warn('localStorage not available:', e)
    }
  }
}

class APIClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    this.loadToken()
  }

  private loadToken() {
    this.token = safeStorage.getItem('access_token')
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      safeStorage.setItem('access_token', token)
    } else {
      safeStorage.removeItem('access_token')
    }
  }

  getToken(): string | null {
    return this.token
  }

  /**
   * Get the user ID from the JWT token
   * Extracts the 'sub' claim from the Cognito JWT
   */
  getUserId(): string | null {
    const token = this.token
    if (!token) return null

    try {
      // JWT is base64url encoded: header.payload.signature
      const parts = token.split('.')
      if (parts.length !== 3) return null

      // Decode the payload (second part)
      const payload = parts[1]
      // Base64url to Base64
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      // Decode
      const decoded = atob(base64)
      const parsed = JSON.parse(decoded)

      // Cognito uses 'sub' for user ID
      return parsed.sub || null
    } catch {
      return null
    }
  }

  clearToken() {
    this.token = null
    safeStorage.removeItem('access_token')
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

  async confirmSignUp(email: string, confirmationCode: string) {
    return this.request<{ message: string }>('/api/v1/auth/confirm-signup', {
      method: 'POST',
      body: JSON.stringify({ email, confirmation_code: confirmationCode }),
    })
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async resetPassword(email: string, confirmationCode: string, newPassword: string) {
    return this.request<{ message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, confirmation_code: confirmationCode, new_password: newPassword }),
    })
  }

  async resendConfirmation(email: string) {
    return this.request<{ message: string }>('/api/v1/auth/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async getCurrentUser() {
    return this.request<any>('/api/v1/auth/me')
  }

  async ensureProfile() {
    return this.request<{ profile: any; newly_created: boolean }>('/api/v1/auth/ensure-profile', {
      method: 'POST',
    })
  }

  async oauthCallback(code: string, redirectUri?: string) {
    const response = await this.request<{ access_token: string; refresh_token?: string; user: any }>('/api/v1/auth/oauth/callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    })
    if (response.access_token) {
      this.setToken(response.access_token)
      if (response.refresh_token) {
        safeStorage.setItem('refresh_token', response.refresh_token)
      }
    }
    return response
  }

  async refreshToken(refreshToken: string) {
    const response = await this.request<{ access_token: string; refresh_token?: string; user: any }>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (response.access_token) {
      this.setToken(response.access_token)
      if (response.refresh_token) {
        safeStorage.setItem('refresh_token', response.refresh_token)
      }
    }
    return response
  }

  // ============================================================================
  // BILLING
  // ============================================================================

  async createCheckoutSession(plan: string = 'premium', context?: string, returnTo?: string) {
    return this.request<{ url: string }>('/api/v1/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ plan, context, returnTo }),
    })
  }

  async createPortalSession(returnTo?: string) {
    return this.request<{ url: string }>('/api/v1/billing/portal-session', {
      method: 'POST',
      body: JSON.stringify({ returnTo }),
    })
  }

  // ============================================================================
  // PROFILES
  // ============================================================================

  async getProfile(userId?: string) {
    if (userId) {
      return this.request<any>(`/api/v1/profiles/${userId}`)
    }
    // Get current user's profile
    return this.request<any>('/api/v1/profiles/me')
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

  async getFilmmakerProfileByUsername(username: string) {
    return this.request<any>(`/api/v1/profiles/filmmaker/username/${username}`)
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

  async onboardFilmmaker(data: {
    full_name: string;
    display_name?: string;
    bio?: string;
    reel_links?: string[];
    portfolio_website?: string;
    location?: string;
    location_visible?: boolean;
    department?: string;
    experience_level?: string;
    skills?: string[];
    credits?: any[];
    accepting_work?: boolean;
    available_for?: string[];
    preferred_locations?: string[];
    contact_method?: string;
    show_email?: boolean;
  }) {
    return this.request<any>('/api/v1/profiles/filmmaker/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async submitFilmmakerApplication(data: {
    full_name: string;
    display_name: string;
    email: string;
    location: string;
    portfolio_link: string;
    professional_profile_link?: string;
    years_of_experience: string;
    primary_roles: string[];
    top_projects: any[];
    join_reason: string;
  }) {
    return this.request<any>('/api/v1/profiles/filmmaker/application', {
      method: 'POST',
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

  async getPartnerProfile(userId: string) {
    return this.request<any>(`/api/v1/profiles/partner/${userId}`)
  }

  async getUserCredits(userId: string) {
    return this.request<any[]>(`/api/v1/profiles/credits/${userId}`)
  }

  async getCombinedProfile(userId: string) {
    return this.request<{
      profile: any;
      filmmaker_profile: any;
      partner_profile: any;
      credits: any[];
    }>(`/api/v1/profiles/combined/${userId}`)
  }

  // ============================================================================
  // SUBMISSIONS
  // ============================================================================

  async getMySubmissions() {
    return this.request<any[]>('/api/v1/submissions/my')
  }

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

  async listSubmissionMessages(submissionId: string) {
    return this.request<any[]>(`/api/v1/submissions/${submissionId}/messages`)
  }

  async createSubmissionMessage(submissionId: string, senderId: string, content: string) {
    return this.request<any>(`/api/v1/submissions/${submissionId}/messages?sender_id=${senderId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
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

  async getForumThreadWithDetails(threadId: string) {
    return this.request<any>(`/api/v1/forum/threads/${threadId}/details`)
  }

  async getForumRepliesWithProfiles(threadId: string) {
    return this.request<any[]>(`/api/v1/forum/threads/${threadId}/replies-with-profiles`)
  }

  async listForumThreadsWithDetails(params?: {
    skip?: number;
    limit?: number;
    categorySlug?: string;
    search?: string;
    sortBy?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.categorySlug) query.append('category_slug', params.categorySlug)
    if (params?.search) query.append('search', params.search)
    if (params?.sortBy) query.append('sort_by', params.sortBy)

    return this.request<any[]>(`/api/v1/forum/threads-with-details?${query}`)
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

  async createPrivateConversation(userId: string, otherUserId: string) {
    return this.request<{ conversation_id: string }>(`/api/v1/messages/conversations/create?user_id=${userId}&other_user_id=${otherUserId}`, {
      method: 'POST',
    })
  }

  async markConversationRead(conversationId: string, userId: string) {
    return this.request<any>(`/api/v1/messages/conversations/${conversationId}/mark-read?user_id=${userId}`, {
      method: 'POST',
    })
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

  async getNotificationSettings(userId: string) {
    return this.request<any>(`/api/v1/notifications/settings/${userId}`)
  }

  async updateNotificationSettings(userId: string, settings: {
    email_digest_enabled?: boolean;
    email_on_submission_updates?: boolean;
    email_on_connection_accepts?: boolean;
    digest_hour_utc?: number;
  }) {
    return this.request<any>(`/api/v1/notifications/settings/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
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

  async deleteConnection(connectionId: string) {
    return this.request<any>(`/api/v1/connections/${connectionId}`, {
      method: 'DELETE',
    })
  }

  async getConnectionRelationship(peerId: string, userId: string) {
    return this.request<any>(`/api/v1/connections/relationship/${peerId}?user_id=${userId}`)
  }

  async searchUsers(query: string, limit: number = 10) {
    return this.request<any[]>(`/api/v1/profiles/search/users?query=${encodeURIComponent(query)}&limit=${limit}`)
  }

  // ============================================================================
  // STATUS UPDATES
  // ============================================================================

  async listStatusUpdates(userId: string, limit: number = 50) {
    return this.request<any[]>(`/api/v1/profiles/status-updates/${userId}?limit=${limit}`)
  }

  async createStatusUpdate(data: { content: string; type?: string }) {
    return this.request<any>('/api/v1/profiles/status-updates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async markAllNotificationsRead(userId: string, tab: string = 'all') {
    return this.request<any>(`/api/v1/notifications/mark-all-read?user_id=${userId}&tab=${tab}`, {
      method: 'POST',
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

  async listPartnerApplications(params?: { skip?: number; limit?: number; status?: string; search?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.search) query.append('search', params.search)
    if (params?.page !== undefined) query.append('page', params.page.toString())
    if (params?.pageSize !== undefined) query.append('pageSize', params.pageSize.toString())

    return this.request<any>(`/api/v1/admin/applications/partners?${query}`)
  }

  async getSiteSettings() {
    return this.request<Array<{ key: string; value: { value: any } }>>('/api/v1/admin/settings')
  }

  async updateSiteSettings(settings: Record<string, any>) {
    return this.request<any>('/api/v1/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    })
  }

  async getNewlyAvailableFilmmakers(hours: number = 48) {
    return this.request<any[]>(`/api/v1/admin/dashboard/newly-available?hours=${hours}`)
  }

  async getAllUsersAdmin(params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())

    return this.request<any[]>(`/api/v1/admin/users/all?${query}`)
  }

  async listSubmissionsAdmin(params?: { skip?: number; limit?: number; status?: string; search?: string }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.search) query.append('search', params.search)

    return this.request<{ submissions: any[]; count: number }>(`/api/v1/admin/submissions/list?${query}`)
  }

  async updateSubmissionStatus(submissionId: string, status: string) {
    return this.request<any>('/api/v1/admin/submissions/status', {
      method: 'POST',
      body: JSON.stringify({ submission_id: submissionId, status }),
    })
  }

  async markSubmissionRead(submissionId: string) {
    return this.request<any>(`/api/v1/admin/submissions/${submissionId}/mark-read`, {
      method: 'POST',
    })
  }

  async updateSubmissionNotes(submissionId: string, notes: string) {
    return this.request<any>(`/api/v1/admin/submissions/${submissionId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    })
  }

  async updateUserRoles(userId: string, roles: string[]) {
    return this.request<any>('/api/v1/admin/users/roles', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, roles }),
    })
  }

  async getAdminFeed(limit: number = 15) {
    return this.request<any[]>(`/api/v1/admin/feed?limit=${limit}`)
  }

  // Forum Management
  async listForumThreadsAdmin() {
    return this.request<any[]>('/api/v1/admin/forum/threads')
  }

  async deleteForumThreadAdmin(threadId: string) {
    return this.request<any>(`/api/v1/admin/forum/threads/${threadId}`, { method: 'DELETE' })
  }

  async listForumRepliesAdmin() {
    return this.request<any[]>('/api/v1/admin/forum/replies')
  }

  async deleteForumReplyAdmin(replyId: string) {
    return this.request<any>(`/api/v1/admin/forum/replies/${replyId}`, { method: 'DELETE' })
  }

  async listForumCategoriesAdmin() {
    return this.request<any[]>('/api/v1/admin/forum/categories')
  }

  async createForumCategoryAdmin(data: { name: string; slug: string; description?: string }) {
    return this.request<any>('/api/v1/admin/forum/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateForumCategoryAdmin(categoryId: string, data: { name: string; slug: string; description?: string }) {
    return this.request<any>(`/api/v1/admin/forum/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteForumCategoryAdmin(categoryId: string) {
    return this.request<any>(`/api/v1/admin/forum/categories/${categoryId}`, { method: 'DELETE' })
  }

  // Filmmaker Profiles
  async listFilmmakerProfilesAdmin() {
    return this.request<any[]>('/api/v1/admin/filmmaker-profiles')
  }

  async revokeFilmmakerProfileAdmin(userId: string) {
    return this.request<any>(`/api/v1/admin/filmmaker-profiles/${userId}/revoke`, { method: 'DELETE' })
  }

  async approveFilmmakerApplication(applicationId: string) {
    return this.request<any>(`/api/v1/admin/applications/filmmakers/${applicationId}/approve`, {
      method: 'POST',
    })
  }

  async rejectFilmmakerApplication(applicationId: string) {
    return this.request<any>(`/api/v1/admin/applications/filmmakers/${applicationId}/reject`, {
      method: 'POST',
    })
  }

  async updatePartnerApplicationStatus(applicationId: string, status: string, adminNotes?: string) {
    return this.request<any>(`/api/v1/admin/applications/partners/${applicationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes }),
    })
  }

  async getSubscriptionActivity(userId: string) {
    return this.request<any[]>(`/api/v1/admin/subscriptions/activity/${userId}`)
  }

  async listAllAvailabilityAdmin() {
    return this.request<any[]>('/api/v1/admin/availability/all')
  }

  async deleteAvailabilityAdmin(recordId: string) {
    return this.request<any>(`/api/v1/admin/availability/${recordId}`, { method: 'DELETE' })
  }

  async listAllProductionsAdmin() {
    return this.request<any[]>('/api/v1/admin/productions')
  }

  async deleteProductionAdmin(productionId: string) {
    return this.request<any>(`/api/v1/admin/productions/${productionId}`, { method: 'DELETE' })
  }

  async listAllCreditsAdmin() {
    return this.request<any[]>('/api/v1/admin/credits/all')
  }

  async deleteCreditAdmin(creditId: string) {
    return this.request<any>(`/api/v1/admin/credits/${creditId}`, { method: 'DELETE' })
  }

  // ============================================================================
  // ORDER PROFILE SETTINGS
  // ============================================================================

  async getOrderProfileSettings() {
    return this.request<any>('/api/v1/order/profile-settings/me')
  }

  async updateOrderProfileSettings(updates: {
    public_visibility?: string;
    show_booking_form?: boolean;
    show_portfolio?: boolean;
  }) {
    return this.request<any>('/api/v1/order/profile-settings/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async getOrderProfileSettingsForUser(userId: string) {
    return this.request<any>(`/api/v1/order/profile-settings/${userId}`)
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

  async updateCredit(creditId: string, userId: string, data: {
    position?: string;
    production_title?: string;
    description?: string;
    production_date?: string;
  }) {
    return this.request<any>(`/api/v1/credits/${creditId}?user_id=${userId}`, {
      method: 'PUT',
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

  // Community Profiles (main community page)
  async listCommunityProfiles(params?: {
    q?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: string;
  }) {
    const searchParams = new URLSearchParams()
    if (params?.q) searchParams.append('q', params.q)
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy)
    if (params?.sortDir) searchParams.append('sortDir', params.sortDir)

    return this.request<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
      nextCursor: any;
    }>(`/api/v1/community/profiles?${searchParams}`)
  }

  // Community Topics
  async listCommunityTopics() {
    return this.request<any[]>('/api/v1/community/topics')
  }

  // Community Threads
  async listCommunityThreads(params?: { topicId?: string; userId?: string; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.topicId) searchParams.append('topic_id', params.topicId)
    if (params?.userId) searchParams.append('user_id', params.userId)
    if (params?.limit) searchParams.append('limit', params.limit.toString())

    return this.request<any[]>(`/api/v1/community/threads?${searchParams}`)
  }

  async getCommunityThread(threadId: string) {
    return this.request<any>(`/api/v1/community/threads/${threadId}`)
  }

  async createCommunityThread(data: { topic_id: string; title: string; content: string; is_pinned?: boolean }) {
    return this.request<any>('/api/v1/community/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCommunityThread(threadId: string, data: { title?: string; content?: string; is_pinned?: boolean }) {
    return this.request<any>(`/api/v1/community/threads/${threadId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCommunityThread(threadId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/threads/${threadId}`, {
      method: 'DELETE',
    })
  }

  // Community Thread Replies
  async listCommunityReplies(threadId: string) {
    return this.request<any[]>(`/api/v1/community/threads/${threadId}/replies`)
  }

  async createCommunityReply(threadId: string, data: { content: string; parent_reply_id?: string }) {
    return this.request<any>(`/api/v1/community/threads/${threadId}/replies`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCommunityReply(replyId: string, data: { content: string }) {
    return this.request<any>(`/api/v1/community/replies/${replyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCommunityReply(replyId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/replies/${replyId}`, {
      method: 'DELETE',
    })
  }

  // Community Collabs
  async listCollabs(params?: {
    type?: string;
    isRemote?: boolean;
    compensationType?: string;
    orderOnly?: boolean;
    userId?: string;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams()
    if (params?.type && params.type !== 'all') searchParams.append('type', params.type)
    if (params?.isRemote !== undefined) searchParams.append('is_remote', params.isRemote.toString())
    if (params?.compensationType && params.compensationType !== 'all') {
      searchParams.append('compensation_type', params.compensationType)
    }
    if (params?.orderOnly) searchParams.append('order_only', 'true')
    if (params?.userId) searchParams.append('user_id', params.userId)
    if (params?.limit) searchParams.append('limit', params.limit.toString())

    return this.request<any[]>(`/api/v1/community/collabs?${searchParams}`)
  }

  async getCollab(collabId: string) {
    return this.request<any>(`/api/v1/community/collabs/${collabId}`)
  }

  async createCollab(data: {
    title: string;
    type: string;
    description: string;
    location?: string;
    is_remote?: boolean;
    compensation_type?: string;
    start_date?: string;
    end_date?: string;
    tags?: string[];
    is_order_only?: boolean;
  }) {
    return this.request<any>('/api/v1/community/collabs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCollab(collabId: string, data: {
    title?: string;
    type?: string;
    description?: string;
    location?: string;
    is_remote?: boolean;
    compensation_type?: string;
    start_date?: string;
    end_date?: string;
    tags?: string[];
    is_order_only?: boolean;
  }) {
    return this.request<any>(`/api/v1/community/collabs/${collabId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCollab(collabId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/collabs/${collabId}`, {
      method: 'DELETE',
    })
  }

  async deactivateCollab(collabId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/collabs/${collabId}/deactivate`, {
      method: 'PATCH',
    })
  }

  async getCommunityActivity(limit: number = 20) {
    return this.request<any[]>(`/api/v1/community/activity?limit=${limit}`)
  }

  // ============================================================================
  // BACKLOT PROJECTS
  // ============================================================================

  async listBacklotProjects(options?: {
    status?: string;
    visibility?: string;
    search?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.visibility) params.append('visibility', options.visibility);
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request<any[]>(`/api/v1/backlot/projects${queryString ? `?${queryString}` : ''}`);
  }

  async createBacklotProject(data: {
    title: string;
    logline?: string | null;
    description?: string | null;
    project_type?: string | null;
    genre?: string | null;
    format?: string | null;
    runtime_minutes?: number | null;
    status?: string;
    visibility?: string;
    target_start_date?: string | null;
    target_end_date?: string | null;
    cover_image_url?: string | null;
    thumbnail_url?: string | null;
  }) {
    return this.request<any>(`/api/v1/backlot/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBacklotProject(projectId: string) {
    return this.request<any>(`/api/v1/backlot/projects/${projectId}`);
  }

  async updateBacklotProject(projectId: string, data: {
    title?: string;
    logline?: string | null;
    description?: string | null;
    project_type?: string | null;
    genre?: string | null;
    format?: string | null;
    runtime_minutes?: number | null;
    status?: string;
    visibility?: string;
    target_start_date?: string | null;
    target_end_date?: string | null;
    cover_image_url?: string | null;
    thumbnail_url?: string | null;
  }) {
    return this.request<any>(`/api/v1/backlot/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBacklotProject(projectId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/backlot/projects/${projectId}`, {
      method: 'DELETE',
    });
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

  // ============================================================================
  // GREENROOM (ADMIN)
  // ============================================================================

  async listGreenroomCycles(status?: string) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    return this.request<any[]>(`/api/v1/greenroom/cycles?${params}`)
  }

  async getGreenroomCycle(cycleId: string | number) {
    return this.request<any>(`/api/v1/greenroom/cycles/${cycleId}`)
  }

  async createGreenroomCycle(data: {
    name: string;
    description?: string | null;
    submission_start?: string | null;
    submission_end?: string | null;
    voting_start?: string | null;
    voting_end?: string | null;
    max_submissions_per_user?: number;
    tickets_per_user?: number;
  }) {
    return this.request<any>('/api/v1/greenroom/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateGreenroomCycle(cycleId: string | number, data: {
    name?: string;
    description?: string | null;
    status?: string;
    current_phase?: string;
    submission_start?: string | null;
    submission_end?: string | null;
    voting_start?: string | null;
    voting_end?: string | null;
    max_submissions_per_user?: number;
    tickets_per_user?: number;
  }) {
    return this.request<any>(`/api/v1/greenroom/cycles/${cycleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteGreenroomCycle(cycleId: string | number) {
    return this.request<any>(`/api/v1/greenroom/cycles/${cycleId}`, {
      method: 'DELETE',
    })
  }

  async updateGreenroomCyclePhase(cycleId: string | number, phase: string) {
    return this.request<any>(`/api/v1/greenroom/admin/cycles/${cycleId}/phase?phase=${phase}`, {
      method: 'PUT',
    })
  }

  async listGreenroomProjects(cycleId?: string | number, status?: string) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    return this.request<any[]>(`/api/v1/greenroom/cycles/${cycleId}/projects?${params}`)
  }

  async updateGreenroomProjectStatus(projectId: string | number, status: string) {
    return this.request<any>(`/api/v1/greenroom/admin/projects/${projectId}/status?status=${status}`, {
      method: 'PUT',
    })
  }

  async toggleGreenroomProjectFeatured(projectId: string | number, isFeatured: boolean, isStaffPick: boolean = false) {
    return this.request<any>(`/api/v1/greenroom/admin/projects/${projectId}/featured?is_featured=${isFeatured}&is_staff_pick=${isStaffPick}`, {
      method: 'PUT',
    })
  }

  async getGreenroomCycleStats(cycleId: string | number) {
    return this.request<any>(`/api/v1/greenroom/cycles/${cycleId}/stats`)
  }

  async getGreenroomCycleResults(cycleId: string | number) {
    return this.request<any>(`/api/v1/greenroom/cycles/${cycleId}/results`)
  }

  async listGreenroomVotingTickets(cycleId?: string | number) {
    if (cycleId) {
      return this.request<any[]>(`/api/v1/greenroom/admin/export/tickets?cycle_id=${cycleId}`)
    }
    return this.request<any>('/api/v1/greenroom/admin/export/tickets')
  }

  async adjustGreenroomTickets(userId: string, cycleId: number, ticketsToAdd: number, reason?: string) {
    const params = new URLSearchParams({
      user_id: userId,
      cycle_id: cycleId.toString(),
      tickets_to_add: ticketsToAdd.toString(),
    })
    if (reason) params.append('reason', reason)
    return this.request<any>(`/api/v1/greenroom/admin/tickets/adjust?${params}`, {
      method: 'POST',
    })
  }

  async exportGreenroomData(dataType: string, cycleId?: number) {
    const params = new URLSearchParams()
    if (cycleId) params.append('cycle_id', cycleId.toString())
    return this.request<any>(`/api/v1/greenroom/admin/export/${dataType}?${params}`)
  }
}

// Export singleton instance
export const api = new APIClient()
export const apiClient = api // Alias for hooks that use apiClient
export { safeStorage } // Export for use in AuthContext
export default api
