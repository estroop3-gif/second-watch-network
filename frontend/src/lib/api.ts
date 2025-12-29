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

  /**
   * Get the base URL for direct fetch calls
   */
  getBaseUrl(): string {
    return this.baseURL
  }

  /**
   * Get headers for direct fetch calls
   */
  getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = this.getToken()
    const url = `${this.baseURL}${endpoint}`

    // Debug logging for POST requests
    if (options.method === 'POST' || options.method === 'PATCH') {
      console.log(`[API] ${options.method} ${url}`)
      console.log(`[API] Token present: ${!!token}`)
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }))
        // Only log errors for non-expected failures (skip 401/403 for optional features)
        const isExpectedFailure = response.status === 401 || response.status === 403 || response.status === 404
        if (!isExpectedFailure) {
          console.error(`[API] Error response (${response.status}):`, error)
        }
        throw new Error(error.detail || 'Request failed')
      }

      return response.json()
    } catch (err: any) {
      // Log network errors
      if (err.name === 'TypeError' && err.message.includes('NetworkError')) {
        console.error(`[API] Network error for ${options.method} ${url}:`, err.message)
      }
      throw err
    }
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
    const response = await this.request<{
      access_token?: string
      user?: any
      challenge?: string
      session?: string
      parameters?: Record<string, any>
    }>('/api/v1/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (response.access_token) {
      this.setToken(response.access_token)
    }
    return response
  }

  async completeNewPassword(email: string, newPassword: string, session: string) {
    const response = await this.request<{ access_token: string; user: any }>('/api/v1/auth/complete-new-password', {
      method: 'POST',
      body: JSON.stringify({ email, new_password: newPassword, session }),
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

  async createCheckoutSession(
    plan: 'monthly' | 'yearly' = 'monthly',
    product: 'premium' | 'backlot' = 'premium',
    context?: string,
    returnTo?: string
  ) {
    return this.request<{ url: string }>('/api/v1/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ plan, product, context, returnTo }),
    })
  }

  async createPortalSession(returnTo?: string) {
    return this.request<{ url: string }>('/api/v1/billing/portal-session', {
      method: 'POST',
      body: JSON.stringify({ returnTo }),
    })
  }

  async checkBacklotAccess(): Promise<{ has_access: boolean; reason: string }> {
    return this.request<{ has_access: boolean; reason: string }>('/api/v1/billing/backlot/access')
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

  /**
   * Get current user's effective permissions from all assigned roles
   * This is live data from the database, not cached
   */
  async getMyPermissions() {
    return this.request<{
      user_id: string;
      roles: string[];
      permissions: Record<string, boolean>;
      profile_flags: Record<string, boolean>;
    }>('/api/v1/users/me/permissions')
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

  // Unified inbox (DMs + Project Updates)
  async getUnifiedInbox(userId: string) {
    return this.request<any[]>(`/api/v1/messages/inbox?user_id=${userId}`)
  }

  async getProjectInboxUpdates(projectId: string, userId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    return this.request<any[]>(`/api/v1/messages/inbox/project/${projectId}/updates?${query}`)
  }

  async markProjectUpdateRead(projectId: string, updateId: string, userId: string) {
    return this.request<any>(`/api/v1/messages/inbox/project/${projectId}/updates/${updateId}/mark-read?user_id=${userId}`, {
      method: 'POST',
    })
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

  async getNewlyAvailableFilmmakersAdmin(hours: number = 48) {
    return this.request<any[]>(`/api/v1/admin/dashboard/newly-available?hours=${hours}`)
  }

  async getAllUsersAdmin(params?: {
    skip?: number
    limit?: number
    search?: string
    roles?: string
    status?: string
    date_from?: string
    date_to?: string
    sort_by?: string
    sort_order?: string
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.roles) query.append('roles', params.roles)
    if (params?.status) query.append('status', params.status)
    if (params?.date_from) query.append('date_from', params.date_from)
    if (params?.date_to) query.append('date_to', params.date_to)
    if (params?.sort_by) query.append('sort_by', params.sort_by)
    if (params?.sort_order) query.append('sort_order', params.sort_order)

    return this.request<{
      users: any[]
      total: number
      page: number
      pages: number
      limit: number
    }>(`/api/v1/admin/users/all?${query}`)
  }

  async listUsersAdmin(params?: {
    skip?: number
    limit?: number
    search?: string
    role?: string
    is_featured?: boolean
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.role) query.append('roles', params.role)
    if (params?.is_featured !== undefined) query.append('is_featured', params.is_featured.toString())

    return this.request<{
      users: any[]
      total: number
    }>(`/api/v1/admin/users/all?${query}`)
  }

  async getUserStats() {
    return this.request<{
      total_users: number
      new_this_week: number
      active_filmmakers: number
      order_members: number
      premium_subscribers: number
      banned_users: number
    }>('/api/v1/admin/users/stats')
  }

  async getUserDetails(userId: string) {
    return this.request<{
      profile: any
      filmmaker_profile: any | null
      order_membership: any | null
      submissions: any[]
      applications: any[]
      recent_activity: any[]
      backlot_projects: Array<{
        id: string
        title: string
        status: string
        project_type: string
        created_at: string
        thumbnail_url?: string
      }>
      storage_usage: {
        bytes_used: number
        quota_bytes: number
        custom_quota_bytes?: number
        percentage: number
      } | null
    }>(`/api/v1/admin/users/${userId}/details`)
  }

  async resetUserPassword(userId: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/v1/admin/users/${userId}/reset-password`,
      { method: 'POST' }
    )
  }

  async resendTempPassword(userId: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/v1/admin/users/${userId}/resend-temp-password`,
      { method: 'POST' }
    )
  }

  async adminUpdateUserProfile(userId: string, data: {
    full_name?: string
    display_name?: string
    username?: string
    bio?: string
    email?: string
  }) {
    return this.request<{
      success: boolean
      message: string
      updated_fields?: string[]
    }>(`/api/v1/admin/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async bulkUserAction(userIds: string[], action: string, role?: string) {
    return this.request<{ success: boolean; affected_count: number; message: string }>(
      '/api/v1/admin/users/bulk',
      {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds, action, role }),
      }
    )
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

  async getSubmissionStats() {
    return this.request<{
      total_content: number
      total_greenroom: number
      content_pending: number
      content_in_review: number
      content_approved: number
      content_rejected: number
      greenroom_pending: number
      greenroom_approved: number
      greenroom_rejected: number
      new_this_week: number
    }>('/api/v1/admin/submissions/stats')
  }

  async listGreenRoomAdmin(params?: {
    skip?: number
    limit?: number
    status?: string
    search?: string
    cycle_id?: number
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.search) query.append('search', params.search)
    if (params?.cycle_id !== undefined) query.append('cycle_id', params.cycle_id.toString())

    return this.request<{ projects: any[]; total: number }>(`/api/v1/admin/greenroom/list?${query}`)
  }

  async bulkSubmissionAction(
    submissionIds: string[],
    action: string,
    submissionType: 'content' | 'greenroom',
    sendEmail: boolean = false
  ) {
    return this.request<{ success: boolean; affected_count: number; message: string }>(
      '/api/v1/admin/submissions/bulk',
      {
        method: 'POST',
        body: JSON.stringify({
          submission_ids: submissionIds,
          action,
          submission_type: submissionType,
          send_email: sendEmail,
        }),
      }
    )
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

  // Order Application Methods
  async listOrderApplications(status?: string): Promise<{ applications: any[]; total: number }> {
    const query = new URLSearchParams()
    if (status) query.append('status', status)
    const queryString = query.toString()
    return this.request<{ applications: any[]; total: number }>(
      `/api/v1/order/applications${queryString ? `?${queryString}` : ''}`
    )
  }

  async approveOrderApplication(applicationId: number) {
    return this.request<any>(`/api/v1/order/applications/${applicationId}/approve`, {
      method: 'POST',
    })
  }

  async rejectOrderApplication(applicationId: number, reason?: string) {
    return this.request<any>(`/api/v1/order/applications/${applicationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ status: 'rejected', rejection_reason: reason }),
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

  // Review Folders
  async listReviewFolders(projectId: string) {
    return this.request<{ folders: any[]; root_assets: any[] }>(`/api/v1/backlot/projects/${projectId}/review/folders`)
  }

  async createReviewFolder(projectId: string, data: {
    name: string;
    description?: string | null;
    color?: string | null;
    parent_folder_id?: string | null;
  }) {
    return this.request<{ folder: any }>(`/api/v1/backlot/projects/${projectId}/review/folders`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getReviewFolder(folderId: string) {
    return this.request<{ folder: any; subfolders: any[]; assets: any[]; breadcrumbs: any[] }>(`/api/v1/backlot/review/folders/${folderId}`)
  }

  async updateReviewFolder(folderId: string, data: {
    name?: string;
    description?: string | null;
    color?: string | null;
    parent_folder_id?: string | null;
    sort_order?: number;
  }) {
    return this.request<{ folder: any }>(`/api/v1/backlot/review/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteReviewFolder(folderId: string) {
    return this.request<{ success: boolean; moved_to_parent: boolean }>(`/api/v1/backlot/review/folders/${folderId}`, {
      method: 'DELETE',
    })
  }

  async moveReviewFolder(folderId: string, parentFolderId: string | null) {
    return this.request<{ folder: any }>(`/api/v1/backlot/review/folders/${folderId}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_folder_id: parentFolderId }),
    })
  }

  async moveReviewAsset(assetId: string, folderId: string | null) {
    return this.request<{ asset: any }>(`/api/v1/backlot/review/assets/${assetId}/move`, {
      method: 'POST',
      body: JSON.stringify({ folder_id: folderId }),
    })
  }

  async updateReviewAssetStatus(assetId: string, status: string) {
    return this.request<{ asset: any }>(`/api/v1/backlot/review/assets/${assetId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async bulkMoveReviewAssets(projectId: string, assetIds: string[], folderId: string | null) {
    return this.request<{ moved_count: number }>(`/api/v1/backlot/projects/${projectId}/review/assets/bulk-move`, {
      method: 'POST',
      body: JSON.stringify({ asset_ids: assetIds, folder_id: folderId }),
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

  // Review Version Streaming (S3)
  async getReviewVersionStreamUrl(versionId: string, quality?: string) {
    const params = quality ? `?quality=${quality}` : '';
    return this.request<{ url: string; quality: string; expires_at: string }>(
      `/api/v1/backlot/review/versions/${versionId}/stream-url${params}`
    )
  }

  async getReviewVersionUploadUrl(assetId: string, filename: string, contentType: string) {
    return this.request<{
      upload_url: string;
      s3_key: string;
      version_id: string;
    }>(`/api/v1/backlot/review/assets/${assetId}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ filename, content_type: contentType }),
    })
  }

  async completeReviewVersionUpload(versionId: string) {
    return this.request<{ version: any; transcode_started: boolean }>(
      `/api/v1/backlot/review/versions/${versionId}/complete-upload`,
      { method: 'POST' }
    )
  }

  async getReviewVersionTranscodeStatus(versionId: string) {
    return this.request<{
      status: string;
      progress: number;
      renditions: Record<string, string>;
      error?: string;
    }>(`/api/v1/backlot/review/versions/${versionId}/transcode-status`)
  }

  // External Review Links
  async listExternalLinks(projectId: string) {
    return this.request<{ links: import('@/types/backlot').ReviewExternalLink[] }>(
      `/api/v1/backlot/projects/${projectId}/review/external-links`
    )
  }

  async createExternalLink(projectId: string, data: import('@/types/backlot').ReviewExternalLinkInput) {
    return this.request<{ link: import('@/types/backlot').ReviewExternalLink; share_url: string }>(
      `/api/v1/backlot/projects/${projectId}/review/external-links`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async updateExternalLink(linkId: string, data: Partial<import('@/types/backlot').ReviewExternalLinkInput> & { is_active?: boolean }) {
    return this.request<{ link: import('@/types/backlot').ReviewExternalLink }>(
      `/api/v1/backlot/review/external-links/${linkId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteExternalLink(linkId: string) {
    return this.request<{ success: boolean }>(
      `/api/v1/backlot/review/external-links/${linkId}`,
      { method: 'DELETE' }
    )
  }

  // Public Review (no auth required - uses token)
  async validateExternalReviewLink(token: string) {
    return this.request<{
      valid: boolean;
      name: string;
      requires_password: boolean;
      scope: 'asset' | 'folder' | 'project';
      asset_name?: string;
      folder_name?: string;
      project_name?: string;
      can_comment: boolean;
      can_download: boolean;
      can_approve: boolean;
      expires_at: string | null;
    }>(`/api/v1/public/review/${token}`)
  }

  async startExternalReviewSession(token: string, data: {
    display_name: string;
    email?: string;
    password?: string;
  }) {
    return this.request<{
      session_token: string;
      expires_at: string;
    }>(`/api/v1/public/review/${token}/start-session`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getExternalReviewContent(token: string, sessionToken: string) {
    return this.request<{
      assets: any[];
      folders?: any[];
    }>(`/api/v1/public/review/${token}/content`, {
      headers: { 'X-Review-Session': sessionToken },
    })
  }

  async createExternalReviewNote(token: string, sessionToken: string, data: {
    version_id: string;
    timecode_seconds?: number | null;
    timecode_end_seconds?: number | null;
    content: string;
    drawing_data?: Record<string, unknown> | null;
  }) {
    return this.request<{ note: any }>(`/api/v1/public/review/${token}/notes`, {
      method: 'POST',
      headers: { 'X-Review-Session': sessionToken },
      body: JSON.stringify(data),
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
  // UNIFIED ASSETS (Assets Tab)
  // ============================================================================

  async listUnifiedAssets(projectId: string, options?: {
    source?: string;
    asset_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams()
    if (options?.source) params.append('source', options.source)
    if (options?.asset_type) params.append('asset_type', options.asset_type)
    if (options?.search) params.append('search', options.search)
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    return this.request<{
      assets: import('@/types/backlot').UnifiedAsset[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/v1/backlot/projects/${projectId}/assets/unified?${params}`)
  }

  async getAssetsSummary(projectId: string) {
    return this.request<{
      summary: import('@/types/backlot').UnifiedAssetsSummary[];
      total_storage_bytes: number;
    }>(`/api/v1/backlot/projects/${projectId}/assets/summary`)
  }

  // Standalone Assets CRUD
  async createStandaloneAsset(projectId: string, data: import('@/types/backlot').StandaloneAssetInput) {
    return this.request<{ asset: import('@/types/backlot').StandaloneAsset }>(
      `/api/v1/backlot/projects/${projectId}/assets/standalone`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async listStandaloneAssets(projectId: string, options?: {
    folder_id?: string;
    asset_type?: string;
    tags?: string;
  }) {
    const params = new URLSearchParams()
    if (options?.folder_id) params.append('folder_id', options.folder_id)
    if (options?.asset_type) params.append('asset_type', options.asset_type)
    if (options?.tags) params.append('tags', options.tags)
    return this.request<{ assets: import('@/types/backlot').StandaloneAsset[] }>(
      `/api/v1/backlot/projects/${projectId}/assets/standalone?${params}`
    )
  }

  async getStandaloneAsset(assetId: string) {
    return this.request<{ asset: import('@/types/backlot').StandaloneAsset }>(
      `/api/v1/backlot/assets/standalone/${assetId}`
    )
  }

  async updateStandaloneAsset(assetId: string, data: Partial<{
    name: string;
    description: string | null;
    tags: string[];
    metadata: Record<string, unknown>;
    folder_id: string | null;
  }>) {
    return this.request<{ asset: import('@/types/backlot').StandaloneAsset }>(
      `/api/v1/backlot/assets/standalone/${assetId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteStandaloneAsset(assetId: string) {
    return this.request<{ success: boolean }>(
      `/api/v1/backlot/assets/standalone/${assetId}`,
      { method: 'DELETE' }
    )
  }

  async getStandaloneAssetUploadUrl(assetId: string, data: {
    filename: string;
    content_type?: string;
    project_id: string;
  }) {
    return this.request<{
      upload_url: string;
      s3_key: string;
      expires_in: number;
    }>(`/api/v1/backlot/assets/standalone/${assetId}/upload-url`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Asset Folders CRUD
  async listAssetFolders(projectId: string) {
    return this.request<{ folders: import('@/types/backlot').AssetFolder[] }>(
      `/api/v1/backlot/projects/${projectId}/assets/folders`
    )
  }

  async createAssetFolder(projectId: string, data: import('@/types/backlot').AssetFolderInput) {
    return this.request<{ folder: import('@/types/backlot').AssetFolder }>(
      `/api/v1/backlot/projects/${projectId}/assets/folders`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async updateAssetFolder(folderId: string, data: Partial<{
    name: string;
    folder_type: string | null;
    parent_folder_id: string | null;
    sort_order: number;
  }>) {
    return this.request<{ folder: import('@/types/backlot').AssetFolder }>(
      `/api/v1/backlot/assets/folders/${folderId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteAssetFolder(folderId: string) {
    return this.request<{ success: boolean }>(
      `/api/v1/backlot/assets/folders/${folderId}`,
      { method: 'DELETE' }
    )
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

  // DESKTOP API KEYS
  async listDesktopKeys() {
    return this.request<any[]>('/api/v1/backlot/desktop-keys')
  }

  async createDesktopKey(name: string) {
    return this.request<any>('/api/v1/backlot/desktop-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  async revokeDesktopKey(keyId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/backlot/desktop-keys/${keyId}`, {
      method: 'DELETE',
    })
  }

  // ============================================================================
  // ADMIN COMMUNITY MANAGEMENT
  // ============================================================================

  // Topics Admin
  async listCommunityTopicsAdmin() {
    return this.request<any[]>('/api/v1/admin/community/topics')
  }

  async createCommunityTopicAdmin(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    is_active?: boolean;
  }) {
    return this.request<any>('/api/v1/admin/community/topics', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCommunityTopicAdmin(topicId: string, data: Partial<{
    name: string;
    slug: string;
    description: string;
    icon: string;
    is_active: boolean;
  }>) {
    return this.request<any>(`/api/v1/admin/community/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCommunityTopicAdmin(topicId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/topics/${topicId}`, {
      method: 'DELETE',
    })
  }

  async reorderCommunityTopicsAdmin(topicIds: string[]) {
    return this.request<{ success: boolean }>('/api/v1/admin/community/topics/reorder', {
      method: 'POST',
      body: JSON.stringify({ topic_ids: topicIds }),
    })
  }

  // Threads Admin
  async listThreadsAdmin(params?: {
    skip?: number;
    limit?: number;
    topic_id?: string;
    search?: string;
    is_pinned?: boolean;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.topic_id) query.append('topic_id', params.topic_id)
    if (params?.search) query.append('search', params.search)
    if (params?.is_pinned !== undefined) query.append('is_pinned', params.is_pinned.toString())

    return this.request<{ threads: any[]; total: number }>(`/api/v1/admin/community/threads?${query}`)
  }

  async deleteThreadAdmin(threadId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/threads/${threadId}`, {
      method: 'DELETE',
    })
  }

  async pinThreadAdmin(threadId: string, isPinned: boolean) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/threads/${threadId}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ is_pinned: isPinned }),
    })
  }

  async bulkDeleteThreadsAdmin(threadIds: string[]) {
    return this.request<{ success: boolean; deleted_count: number }>('/api/v1/admin/community/threads/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: threadIds }),
    })
  }

  // Replies Admin
  async listRepliesAdmin(params?: {
    skip?: number;
    limit?: number;
    thread_id?: string;
    search?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.thread_id) query.append('thread_id', params.thread_id)
    if (params?.search) query.append('search', params.search)

    return this.request<{ replies: any[]; total: number }>(`/api/v1/admin/community/replies?${query}`)
  }

  async deleteReplyAdmin(replyId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/replies/${replyId}`, {
      method: 'DELETE',
    })
  }

  // Collabs Admin
  async listCollabsAdmin(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    is_featured?: boolean;
    collab_type?: string;
    search?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString())
    if (params?.is_featured !== undefined) query.append('is_featured', params.is_featured.toString())
    if (params?.collab_type) query.append('collab_type', params.collab_type)
    if (params?.search) query.append('search', params.search)

    return this.request<{ collabs: any[]; total: number }>(`/api/v1/admin/community/collabs?${query}`)
  }

  async featureCollabAdmin(collabId: string, isFeatured: boolean, featuredUntil?: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/collabs/${collabId}/feature`, {
      method: 'PUT',
      body: JSON.stringify({ is_featured: isFeatured, featured_until: featuredUntil }),
    })
  }

  async deactivateCollabAdmin(collabId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/collabs/${collabId}/deactivate`, {
      method: 'PUT',
    })
  }

  async bulkDeactivateCollabsAdmin(collabIds: string[]) {
    return this.request<{ success: boolean; deactivated_count: number }>('/api/v1/admin/community/collabs/bulk-deactivate', {
      method: 'POST',
      body: JSON.stringify({ collab_ids: collabIds }),
    })
  }

  // User Moderation
  async warnUserAdmin(userId: string, data: {
    reason: string;
    details?: string;
    related_content_type?: string;
    related_content_id?: string;
  }) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/admin/community/users/${userId}/warn`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async muteUserAdmin(userId: string, data: {
    reason: string;
    duration_hours: number;
    related_content_type?: string;
    related_content_id?: string;
  }) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/admin/community/users/${userId}/mute`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async unmuteUserAdmin(userId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/admin/community/users/${userId}/unmute`, {
      method: 'POST',
    })
  }

  async getUserModerationHistory(userId: string) {
    return this.request<any[]>(`/api/v1/admin/community/users/${userId}/moderation-history`)
  }

  async listActiveMutes() {
    return this.request<any[]>('/api/v1/admin/community/moderation/active-mutes')
  }

  // Content Reports
  async listContentReportsAdmin(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    content_type?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.content_type) query.append('content_type', params.content_type)

    return this.request<{ reports: any[]; total: number }>(`/api/v1/admin/community/reports?${query}`)
  }

  // Alias for backward compatibility
  async listReportsAdmin(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    content_type?: string;
  }) {
    return this.listContentReportsAdmin(params)
  }

  async getReportStats() {
    return this.request<{
      pending: number;
      reviewing: number;
      resolved: number;
      dismissed: number;
      total: number;
    }>('/api/v1/admin/community/reports/stats')
  }

  async resolveContentReportAdmin(reportId: string, resolutionNotes?: string, actionTaken?: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/reports/${reportId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolution_notes: resolutionNotes, action_taken: actionTaken }),
    })
  }

  async dismissContentReportAdmin(reportId: string, resolutionNotes?: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/reports/${reportId}/dismiss`, {
      method: 'PUT',
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    })
  }

  // Flagged Content
  async listFlaggedContentAdmin(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    severity?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.severity) query.append('severity', params.severity)

    return this.request<{ flagged: any[]; total: number }>(`/api/v1/admin/community/flagged?${query}`)
  }

  async approveFlaggedContentAdmin(flaggedId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/flagged/${flaggedId}/approve`, {
      method: 'PUT',
    })
  }

  async removeFlaggedContentAdmin(flaggedId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/flagged/${flaggedId}/remove`, {
      method: 'PUT',
    })
  }

  // Broadcasts
  async listBroadcastsAdmin() {
    return this.request<any[]>('/api/v1/admin/community/broadcasts')
  }

  async createBroadcastAdmin(data: {
    title: string;
    message: string;
    broadcast_type?: string;
    target_audience?: string;
    starts_at?: string;
    expires_at?: string;
  }) {
    return this.request<any>('/api/v1/admin/community/broadcasts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateBroadcastAdmin(broadcastId: string, data: Partial<{
    title: string;
    message: string;
    broadcast_type: string;
    target_audience: string;
    is_active: boolean;
    starts_at: string;
    expires_at: string;
  }>) {
    return this.request<any>(`/api/v1/admin/community/broadcasts/${broadcastId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteBroadcastAdmin(broadcastId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/broadcasts/${broadcastId}`, {
      method: 'DELETE',
    })
  }

  // Forum Bans (Admin)
  async createForumBan(userId: string, data: {
    restriction_type: 'read_only' | 'full_block' | 'shadow_restrict';
    reason: string;
    details?: string;
    duration_hours?: number;
  }) {
    return this.request<any>(`/api/v1/admin/community/users/${userId}/forum-ban`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async removeForumBan(userId: string) {
    return this.request<{ success: boolean }>(`/api/v1/admin/community/users/${userId}/forum-ban`, {
      method: 'DELETE',
    })
  }

  async getUserForumBan(userId: string) {
    return this.request<any>(`/api/v1/admin/community/users/${userId}/forum-ban`)
  }

  async listForumBans(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    restriction_type?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString())
    if (params?.restriction_type) query.append('restriction_type', params.restriction_type)

    return this.request<{ bans: any[]; total: number }>(`/api/v1/admin/community/forum-bans?${query}`)
  }

  // Public Community Methods
  async submitContentReport(data: {
    content_type: 'thread' | 'reply';
    content_id: string;
    reason: string;
    details?: string;
  }) {
    return this.request<any>('/api/v1/community/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getUserForumStatus() {
    return this.request<{
      is_banned: boolean;
      restriction_type: string | null;
      reason: string | null;
      expires_at: string | null;
    }>('/api/v1/community/user-forum-status')
  }

  // =====================================
  // Admin Content - Fast Channel Methods
  // =====================================

  async listFastChannelContent(params?: {
    skip?: number;
    limit?: number;
    content_type?: string;
    is_active?: boolean;
    search?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.content_type) query.append('content_type', params.content_type)
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString())
    if (params?.search) query.append('search', params.search)
    return this.request<{ content: any[]; total: number }>(`/api/v1/admin/content/fast-channel?${query}`)
  }

  async createFastChannelContent(data: any) {
    return this.request<any>('/api/v1/admin/content/fast-channel', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateFastChannelContent(id: string, data: any) {
    return this.request<any>(`/api/v1/admin/content/fast-channel/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteFastChannelContent(id: string) {
    return this.request<any>(`/api/v1/admin/content/fast-channel/${id}`, {
      method: 'DELETE',
    })
  }

  async bulkUpdateFastChannelContent(content_ids: string[], is_active: boolean) {
    return this.request<any>('/api/v1/admin/content/fast-channel/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ content_ids, is_active }),
    })
  }

  async listFastChannels() {
    return this.request<any[]>('/api/v1/admin/content/channels')
  }

  async createFastChannel(data: any) {
    return this.request<any>('/api/v1/admin/content/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateFastChannel(id: string, data: any) {
    return this.request<any>(`/api/v1/admin/content/channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getChannelSchedule(channelId: string, startDate?: string, endDate?: string) {
    const query = new URLSearchParams()
    if (startDate) query.append('start_date', startDate)
    if (endDate) query.append('end_date', endDate)
    return this.request<any[]>(`/api/v1/admin/content/channels/${channelId}/schedule?${query}`)
  }

  async addToChannelSchedule(channelId: string, data: any) {
    return this.request<any>(`/api/v1/admin/content/channels/${channelId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async removeFromChannelSchedule(channelId: string, scheduleId: string) {
    return this.request<any>(`/api/v1/admin/content/channels/${channelId}/schedule/${scheduleId}`, {
      method: 'DELETE',
    })
  }

  async listFastChannelPlaylists() {
    return this.request<any[]>('/api/v1/admin/content/playlists')
  }

  async createFastChannelPlaylist(data: any) {
    return this.request<any>('/api/v1/admin/content/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getFastChannelPlaylist(id: string) {
    return this.request<any>(`/api/v1/admin/content/playlists/${id}`)
  }

  async updateFastChannelPlaylist(id: string, data: any) {
    return this.request<any>(`/api/v1/admin/content/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteFastChannelPlaylist(id: string) {
    return this.request<any>(`/api/v1/admin/content/playlists/${id}`, {
      method: 'DELETE',
    })
  }

  async addToPlaylist(playlistId: string, data: { content_id: string; sort_order?: number }) {
    return this.request<any>(`/api/v1/admin/content/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async removeFromPlaylist(playlistId: string, itemId: string) {
    return this.request<any>(`/api/v1/admin/content/playlists/${playlistId}/items/${itemId}`, {
      method: 'DELETE',
    })
  }

  // =====================================
  // Admin Backlot Methods
  // =====================================

  async listBacklotProjectsAdmin(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    project_type?: string;
    search?: string;
    owner_id?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.project_type) query.append('project_type', params.project_type)
    if (params?.search) query.append('search', params.search)
    if (params?.owner_id) query.append('owner_id', params.owner_id)
    return this.request<{ projects: any[]; total: number }>(`/api/v1/admin/backlot/projects?${query}`)
  }

  async createBacklotProjectAdmin(data: any) {
    return this.request<any>('/api/v1/admin/backlot/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getBacklotProjectAdmin(id: string) {
    return this.request<any>(`/api/v1/admin/backlot/projects/${id}`)
  }

  async updateBacklotProjectAdmin(id: string, data: any) {
    return this.request<any>(`/api/v1/admin/backlot/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteBacklotProjectAdmin(id: string) {
    return this.request<any>(`/api/v1/admin/backlot/projects/${id}`, {
      method: 'DELETE',
    })
  }

  async updateBacklotProjectStatus(id: string, status: string) {
    return this.request<any>(`/api/v1/admin/backlot/projects/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  async getBacklotStats() {
    return this.request<{
      total_projects: number;
      by_status: { draft: number; active: number; complete: number; archived: number };
      total_credits: number;
      total_files: number;
    }>('/api/v1/admin/backlot/stats')
  }

  // =====================================
  // Admin Profiles Methods
  // =====================================

  async listProfileProductionsAdmin(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    production_type?: string;
    user_id?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.production_type) query.append('production_type', params.production_type)
    if (params?.user_id) query.append('user_id', params.user_id)
    return this.request<{ productions: any[]; total: number }>(`/api/v1/admin/profiles/productions?${query}`)
  }

  async deleteProfileProductionAdmin(id: string) {
    return this.request<any>(`/api/v1/admin/profiles/productions/${id}`, {
      method: 'DELETE',
    })
  }

  async listProfileCreditsAdmin(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    user_id?: string;
    production_id?: string;
    is_featured?: boolean;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.user_id) query.append('user_id', params.user_id)
    if (params?.production_id) query.append('production_id', params.production_id)
    if (params?.is_featured !== undefined) query.append('is_featured', params.is_featured.toString())
    return this.request<{ credits: any[]; total: number }>(`/api/v1/admin/profiles/credits?${query}`)
  }

  async deleteProfileCreditAdmin(id: string) {
    return this.request<any>(`/api/v1/admin/profiles/credits/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleProfileCreditFeatured(id: string, is_featured: boolean) {
    return this.request<any>(`/api/v1/admin/profiles/credits/${id}/featured?is_featured=${is_featured}`, {
      method: 'PUT',
    })
  }

  async getProfileContentStats() {
    return this.request<{
      total_productions: number;
      total_credits: number;
      featured_credits: number;
      users_with_credits: number;
    }>('/api/v1/admin/profiles/stats')
  }

  async getProfileConfig() {
    return this.request<any>('/api/v1/admin/profiles/config')
  }

  async updateProfileConfig(data: { config_key: string; config_value: any }) {
    return this.request<any>('/api/v1/admin/profiles/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getPrivacyDefaults() {
    return this.request<any>('/api/v1/admin/profiles/privacy-defaults')
  }

  async updatePrivacyDefaults(data: any) {
    return this.request<any>('/api/v1/admin/profiles/privacy-defaults', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getAvailableLayouts() {
    return this.request<string[]>('/api/v1/admin/profiles/layouts')
  }

  async updateAvailableLayouts(layouts: string[]) {
    return this.request<string[]>('/api/v1/admin/profiles/layouts', {
      method: 'PUT',
      body: JSON.stringify(layouts),
    })
  }

  async getVisibleFields() {
    return this.request<string[]>('/api/v1/admin/profiles/visible-fields')
  }

  async updateVisibleFields(fields: string[]) {
    return this.request<string[]>('/api/v1/admin/profiles/visible-fields', {
      method: 'PUT',
      body: JSON.stringify(fields),
    })
  }

  // Featured Users (Admin)
  async toggleUserFeatured(userId: string, isFeatured: boolean) {
    return this.request<any>(`/api/v1/admin/users/${userId}/feature?is_featured=${isFeatured}`, {
      method: 'PUT',
    })
  }

  async listFeaturedUsers() {
    return this.request<any[]>('/api/v1/admin/users/featured')
  }

  async reorderFeaturedUsers(userIds: string[]) {
    return this.request<any>('/api/v1/admin/users/featured/reorder', {
      method: 'PUT',
      body: JSON.stringify(userIds),
    })
  }

  // Alpha Testing Management
  async getAlphaStats() {
    return this.request<{
      total_testers: number
      feedback_new: number
      feedback_reviewing: number
      feedback_in_progress: number
      feedback_resolved: number
      bugs_reported: number
      features_requested: number
      ux_issues: number
      sessions_this_week: number
    }>('/api/v1/admin/alpha/stats')
  }

  async listAlphaTesters(params?: {
    skip?: number
    limit?: number
    search?: string
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)

    return this.request<{
      testers: any[]
      total: number
    }>(`/api/v1/admin/alpha/testers?${query}`)
  }

  async toggleAlphaTester(userId: string, isAlpha: boolean, notes?: string) {
    const query = new URLSearchParams()
    query.append('is_alpha', isAlpha.toString())
    if (notes) query.append('notes', notes)

    return this.request<any>(`/api/v1/admin/alpha/testers/${userId}/toggle?${query}`, {
      method: 'PUT',
    })
  }

  async listAlphaFeedback(params?: {
    skip?: number
    limit?: number
    status?: string
    feedback_type?: string
    priority?: string
    user_id?: string
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)
    if (params?.feedback_type) query.append('feedback_type', params.feedback_type)
    if (params?.priority) query.append('priority', params.priority)
    if (params?.user_id) query.append('user_id', params.user_id)

    return this.request<{
      feedback: any[]
      total: number
    }>(`/api/v1/admin/alpha/feedback?${query}`)
  }

  async getAlphaFeedback(feedbackId: string) {
    return this.request<any>(`/api/v1/admin/alpha/feedback/${feedbackId}`)
  }

  async updateAlphaFeedback(feedbackId: string, data: {
    status?: string
    priority?: string
    admin_notes?: string
    resolved_by?: string
  }) {
    return this.request<any>(`/api/v1/admin/alpha/feedback/${feedbackId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async listAlphaSessions(params?: {
    skip?: number
    limit?: number
    user_id?: string
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.user_id) query.append('user_id', params.user_id)

    return this.request<{
      sessions: any[]
      total: number
    }>(`/api/v1/admin/alpha/sessions?${query}`)
  }

  // =====================================
  // Alpha Feedback User Methods
  // =====================================

  async submitAlphaFeedback(data: {
    title: string
    description: string
    feedback_type: string
    priority?: string
    page_url?: string
    browser_info?: Record<string, any>
    context?: Record<string, any>
    screenshot_url?: string
  }) {
    return this.request<{
      success: boolean
      message: string
      feedback_id: string
    }>('/api/v1/feedback/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getAlphaScreenshotUploadUrl(filename: string) {
    return this.request<{
      upload_url: string
      fields: Record<string, string>
      key: string
      public_url: string
    }>('/api/v1/feedback/screenshot-upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    })
  }

  async getMyAlphaFeedback(params?: {
    skip?: number
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())

    return this.request<{
      feedback: any[]
      total: number
    }>(`/api/v1/feedback/my-feedback?${query}`)
  }

  // =====================================
  // Admin Custom Roles API
  // =====================================

  async listCustomRoles() {
    return this.request<{
      roles: Array<{
        id: string
        name: string
        display_name: string
        description?: string
        color: string
        storage_quota_bytes: number
        is_system_role: boolean
        can_access_backlot: boolean
        can_access_greenroom: boolean
        can_access_forum: boolean
        can_access_community: boolean
        can_submit_content: boolean
        can_upload_files: boolean
        can_create_projects: boolean
        can_invite_collaborators: boolean
        user_count: number
        created_at: string
        updated_at: string
      }>
    }>('/api/v1/admin/roles')
  }

  async getCustomRole(roleId: string) {
    return this.request<any>(`/api/v1/admin/roles/${roleId}`)
  }

  async createCustomRole(data: {
    name: string
    display_name: string
    description?: string
    color?: string
    storage_quota_bytes?: number
    permissions: {
      can_access_backlot: boolean
      can_access_greenroom: boolean
      can_access_forum: boolean
      can_access_community: boolean
      can_submit_content: boolean
      can_upload_files: boolean
      can_create_projects: boolean
      can_invite_collaborators: boolean
    }
  }) {
    return this.request<any>('/api/v1/admin/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCustomRole(roleId: string, data: {
    display_name?: string
    description?: string
    color?: string
    storage_quota_bytes?: number
    permissions?: {
      can_access_backlot: boolean
      can_access_greenroom: boolean
      can_access_forum: boolean
      can_access_community: boolean
      can_submit_content: boolean
      can_upload_files: boolean
      can_create_projects: boolean
      can_invite_collaborators: boolean
    }
  }) {
    return this.request<any>(`/api/v1/admin/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCustomRole(roleId: string) {
    return this.request<any>(`/api/v1/admin/roles/${roleId}`, {
      method: 'DELETE',
    })
  }

  async assignRoleToUser(roleId: string, userId: string) {
    return this.request<any>(`/api/v1/admin/roles/${roleId}/assign/${userId}`, {
      method: 'POST',
    })
  }

  async unassignRoleFromUser(roleId: string, userId: string) {
    return this.request<any>(`/api/v1/admin/roles/${roleId}/unassign/${userId}`, {
      method: 'DELETE',
    })
  }

  async getRoleUsers(roleId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())

    return this.request<{
      role: any
      users: any[]
      total: number
    }>(`/api/v1/admin/roles/${roleId}/users?${query}`)
  }

  async getUserRoles(userId: string) {
    return this.request<{
      roles: any[]
    }>(`/api/v1/admin/users/${userId}/roles`)
  }

  async updateUserCustomRoles(userId: string, roleIds: string[]) {
    return this.request<any>(`/api/v1/admin/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify(roleIds),
    })
  }

  // =====================================
  // Admin Storage API
  // =====================================

  async getStorageOverview() {
    return this.request<{
      total_bytes_used: number
      total_formatted: string
      breakdown: {
        backlot_files: { bytes: number; formatted: string }
        backlot_media: { bytes: number; formatted: string }
        avatars: { bytes: number; formatted: string }
      }
      total_users: number
      users_with_storage: number
      top_users: Array<{
        user_id: string
        display_name: string
        email: string
        avatar_url?: string
        bytes_used: number
        bytes_used_formatted: string
        custom_quota?: number
      }>
      users_near_quota: Array<{
        user_id: string
        display_name: string
        email: string
        bytes_used: number
        bytes_used_formatted: string
        quota_bytes: number
        quota_formatted: string
        percentage: number
      }>
    }>('/api/v1/admin/storage/overview')
  }

  async getUsersStorage(params?: {
    skip?: number
    limit?: number
    sort_by?: string
    sort_order?: string
    search?: string
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.sort_by) query.append('sort_by', params.sort_by)
    if (params?.sort_order) query.append('sort_order', params.sort_order)
    if (params?.search) query.append('search', params.search)

    return this.request<{
      users: Array<{
        user_id: string
        display_name: string
        email: string
        avatar_url?: string
        bytes_used: number
        bytes_used_formatted: string
        quota_bytes: number
        quota_formatted: string
        custom_quota_bytes?: number
        percentage: number
        last_updated: string
      }>
      total: number
    }>(`/api/v1/admin/storage/users?${query}`)
  }

  async getUserStorageDetail(userId: string) {
    return this.request<{
      user: any
      roles: any[]
      storage: {
        total_bytes_used: number
        total_formatted: string
        quota_bytes: number
        quota_formatted: string
        custom_quota_bytes?: number
        percentage: number
        breakdown: {
          backlot_files: { bytes: number; formatted: string }
          backlot_media: { bytes: number; formatted: string }
          avatars: { bytes: number; formatted: string }
        }
        last_updated: string
      }
      largest_files: Array<{
        id: string
        name: string
        size: number
        size_formatted: string
        type: string
        created_at: string
      }>
    }>(`/api/v1/admin/storage/users/${userId}`)
  }

  async setUserStorageQuota(userId: string, quotaBytes: number) {
    return this.request<any>(`/api/v1/admin/storage/users/${userId}/quota`, {
      method: 'PUT',
      body: JSON.stringify({ quota_bytes: quotaBytes }),
    })
  }

  async removeUserStorageQuota(userId: string) {
    return this.request<any>(`/api/v1/admin/storage/users/${userId}/quota`, {
      method: 'DELETE',
    })
  }

  async recalculateStorage() {
    return this.request<{
      success: boolean
      message: string
    }>('/api/v1/admin/storage/recalculate', {
      method: 'POST',
    })
  }

  // =====================================
  // Admin User Creation API
  // =====================================

  async adminCreateUser(data: {
    email: string
    display_name: string
    full_name?: string
    role_ids?: string[]
    custom_quota_bytes?: number
    send_welcome_email?: boolean
  }) {
    return this.request<{
      success: boolean
      user: {
        id: string
        email: string
        display_name: string
        roles_assigned: number
      }
      temp_password?: string
      message: string
    }>('/api/v1/admin/users/create', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async adminListUsersWithRoles(params?: {
    skip?: number
    limit?: number
    search?: string
    role_id?: string
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.search) query.append('search', params.search)
    if (params?.role_id) query.append('role_id', params.role_id)

    return this.request<{
      users: Array<{
        id: string
        email: string
        display_name: string
        full_name?: string
        avatar_url?: string
        is_admin: boolean
        is_filmmaker: boolean
        is_partner: boolean
        created_at: string
        created_by_admin: boolean
        roles: Array<{
          id: string
          name: string
          display_name: string
          color: string
          storage_quota_bytes: number
        }>
        storage: {
          bytes_used: number
          quota_bytes: number
          custom_quota_bytes?: number
          percentage: number
        }
      }>
      total: number
    }>(`/api/v1/admin/users?${query}`)
  }

  async adminGetUserDetail(userId: string) {
    return this.request<{
      user: any
      roles: any[]
      storage: any
      created_by?: any
    }>(`/api/v1/admin/users/${userId}`)
  }

  async adminUpdateUser(userId: string, data: {
    display_name?: string
    full_name?: string
    bio?: string
  }) {
    return this.request<any>(`/api/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async adminResetUserPassword(userId: string) {
    return this.request<{
      success: boolean
      message: string
    }>(`/api/v1/admin/users/${userId}/reset-password`, {
      method: 'POST',
    })
  }

  async adminDeleteUser(userId: string) {
    return this.request<{
      success: boolean
      message: string
    }>(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
    })
  }

  // =====================================
  // User Storage Quota (for current user)
  // =====================================

  async getMyStorageQuota() {
    return this.request<{
      bytes_used: number
      bytes_used_formatted: string
      quota_bytes: number
      quota_formatted: string
      bytes_remaining: number
      bytes_remaining_formatted: string
      percentage_used: number
    }>('/api/v1/backlot/storage/quota')
  }
}

// Export singleton instance
export const api = new APIClient()
export const apiClient = api // Alias for hooks that use apiClient
export { safeStorage } // Export for use in AuthContext
export default api
