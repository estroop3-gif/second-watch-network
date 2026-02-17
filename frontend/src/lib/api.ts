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
    return await this._doRequestWithRetry<T>(endpoint, options)
  }

  /**
   * Retry wrapper for network errors (e.g. CORS-blocked 503s during Lambda cold starts).
   * Retries up to 2 times with 1s/2s backoff. Only retries on TypeError/NetworkError,
   * not on HTTP errors (those are real server responses).
   */
  private async _doRequestWithRetry<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const MAX_RETRIES = 2
    const BACKOFF_MS = [1000, 2000]

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this._doRequest<T>(endpoint, options)
      } catch (err: any) {
        const isNetworkError = err instanceof TypeError || (err.name === 'TypeError' && err.message?.includes('fetch'))
        const isLastAttempt = attempt >= MAX_RETRIES

        if (!isNetworkError || isLastAttempt) {
          throw err
        }

        console.warn(`[API] Network error on ${options.method || 'GET'} ${endpoint}, retrying in ${BACKOFF_MS[attempt]}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]))
      }
    }

    // Unreachable, but TypeScript needs it
    throw new Error('Request failed after retries')
  }

  // Token refresh state — prevents multiple concurrent refresh attempts
  private _refreshPromise: Promise<boolean> | null = null

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * De-duplicates concurrent refresh attempts.
   */
  private async _tryRefreshToken(): Promise<boolean> {
    if (this._refreshPromise) return this._refreshPromise

    this._refreshPromise = (async () => {
      const rt = safeStorage.getItem('refresh_token')
      if (!rt) return false
      try {
        console.log('[API] Access token expired, refreshing...')
        const resp = await this._doRequestRaw<{ access_token: string; refresh_token?: string; user: any }>(
          '/api/v1/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refresh_token: rt }) },
        )
        if (resp.access_token) {
          this.setToken(resp.access_token)
          safeStorage.setItem('access_token', resp.access_token)
          if (resp.refresh_token) {
            safeStorage.setItem('refresh_token', resp.refresh_token)
          }
          console.log('[API] Token refreshed successfully')
          return true
        }
        return false
      } catch {
        console.log('[API] Token refresh failed, session expired')
        return false
      } finally {
        this._refreshPromise = null
      }
    })()

    return this._refreshPromise
  }

  /**
   * Raw request that does NOT attempt token refresh (used by the refresh flow itself).
   */
  private async _doRequestRaw<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers }
    const token = this.getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(url, { ...options, headers })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      const detail = error.detail
      const message = typeof detail === 'object' && detail !== null ? detail.message || 'Request failed' : detail || 'Request failed'
      const err = new Error(message) as any
      err.status = response.status
      throw err
    }
    return response.json().catch(() => ({}))
  }

  private async _doRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = this.getToken()
    const url = `${this.baseURL}${endpoint}`

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
        // On 401, try refreshing the token and retry once
        if (response.status === 401 && token && !endpoint.includes('/auth/refresh')) {
          const refreshed = await this._tryRefreshToken()
          if (refreshed) {
            // Retry with new token
            const newToken = this.getToken()
            headers['Authorization'] = `Bearer ${newToken}`
            const retryResponse = await fetch(url, { ...options, headers })
            if (retryResponse.ok) {
              return retryResponse.json().catch(() => ({}))
            }
            // Retry also failed — fall through to error handling
            const retryError = await retryResponse.json().catch(() => ({ detail: 'Request failed' }))
            const retryDetail = retryError.detail
            const retryMessage = typeof retryDetail === 'object' && retryDetail !== null
              ? retryDetail.message || 'Request failed'
              : retryDetail || 'Request failed'
            const err = new Error(retryMessage) as any
            err.status = retryResponse.status
            throw err
          }
        }

        const error = await response.json().catch(() => ({ detail: 'Request failed' }))
        // Only log errors for non-expected failures (skip 401/403 for optional features)
        const isExpectedFailure = response.status === 401 || response.status === 403 || response.status === 404
        if (!isExpectedFailure) {
          console.error(`[API] Error response (${response.status}) ${options.method || 'GET'} ${endpoint}:`, error)
        }
        // Support structured error details: { code: "...", message: "..." }
        const detail = error.detail
        const message = typeof detail === 'object' && detail !== null
          ? detail.message || 'Request failed'
          : detail || 'Request failed'
        const code = typeof detail === 'object' && detail !== null ? detail.code : undefined
        const err = new Error(message) as any
        err.code = code
        err.status = response.status
        throw err
      }

      return response.json().catch(() => ({}))
    } catch (err: any) {
      // Log network errors
      if (err.name === 'TypeError' && err.message.includes('NetworkError')) {
        console.error(`[API] Network error for ${options.method || 'GET'} ${url}:`, err.message)
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

  async getProfileUpdates(userId: string, limit: number = 20, offset: number = 0) {
    return this.request<any>(`/api/v1/profiles/profile-updates/${userId}?limit=${limit}&offset=${offset}`)
  }

  async getActiveProjects(userId: string) {
    return this.request<any>(`/api/v1/profiles/active-projects/${userId}`)
  }

  async updateAvailability(data: { accepting_work: boolean; status_message?: string }) {
    return this.request<any>('/api/v1/profiles/availability', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
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

  async createSubmission(data: any) {
    return this.request<any>(`/api/v1/submissions/`, {
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

  async updateMySubmission(submissionId: string, data: any) {
    return this.request<any>(`/api/v1/submissions/my/${submissionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getSubmitterProfile(submissionId: string) {
    return this.request<any>(`/api/v1/admin/submissions/${submissionId}/submitter-profile`)
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
  async getUnifiedInbox(userId: string, params?: { folder?: string; contextId?: string }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.folder) query.append('folder', params.folder)
    if (params?.contextId) query.append('context_id', params.contextId)
    return this.request<any[]>(`/api/v1/messages/inbox?${query}`)
  }

  async getProjectInboxUpdates(projectId: string, userId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    return this.request<any[]>(`/api/v1/messages/inbox/project/${projectId}/updates?${query}`)
  }

  // ============================================================================
  // MESSAGE CHANNELS (Group Chats)
  // ============================================================================

  async listChannels(userId: string, params?: { channelType?: string; contextId?: string }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.channelType) query.append('channel_type', params.channelType)
    if (params?.contextId) query.append('context_id', params.contextId)
    return this.request<any[]>(`/api/v1/channels/?${query}`)
  }

  async getChannel(channelId: string, userId: string) {
    return this.request<any>(`/api/v1/channels/${channelId}?user_id=${userId}`)
  }

  async createChannel(userId: string, data: {
    name: string;
    slug: string;
    description?: string;
    channel_type: string;
    context_id?: string;
    is_private?: boolean;
  }) {
    return this.request<any>(`/api/v1/channels/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listChannelMessages(channelId: string, userId: string, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams({ user_id: userId })
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    return this.request<any[]>(`/api/v1/channels/${channelId}/messages?${query}`)
  }

  async sendChannelMessage(channelId: string, userId: string, content: string, replyToId?: string) {
    return this.request<any>(`/api/v1/channels/${channelId}/messages?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify({ content, reply_to_id: replyToId }),
    })
  }

  async markChannelRead(channelId: string, userId: string) {
    return this.request<any>(`/api/v1/channels/${channelId}/mark-read?user_id=${userId}`, {
      method: 'POST',
    })
  }

  async joinChannel(channelId: string, userId: string) {
    return this.request<any>(`/api/v1/channels/${channelId}/join?user_id=${userId}`, {
      method: 'POST',
    })
  }

  async leaveChannel(channelId: string, userId: string) {
    return this.request<any>(`/api/v1/channels/${channelId}/leave?user_id=${userId}`, {
      method: 'POST',
    })
  }

  async getFolderUnreadCounts(userId: string) {
    return this.request<Record<string, number>>(`/api/v1/channels/folders/counts?user_id=${userId}`)
  }

  async autoJoinDefaultChannels(userId: string, channelType: string) {
    return this.request<any>(`/api/v1/channels/auto-join/${channelType}?user_id=${userId}`, {
      method: 'POST',
    })
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

  /**
   * Get or create a conversation with a specific user.
   * Used when navigating from applicant page to auto-open conversation.
   */
  async getOrCreateConversationByUser(targetUserId: string, userId: string) {
    return this.request<{
      conversation_id: string;
      target_user: {
        id: string;
        username: string | null;
        full_name: string | null;
        display_name: string | null;
        avatar_url: string | null;
      } | null;
    }>(`/api/v1/messages/conversation-by-user/${targetUserId}?user_id=${userId}`)
  }

  // ============================================================================
  // MESSAGE TEMPLATES
  // ============================================================================

  /**
   * Get system message templates (for quick applicant replies, etc.)
   */
  async getSystemMessageTemplates(params?: { category?: string; contextType?: string }) {
    const query = new URLSearchParams()
    if (params?.category) query.append('category', params.category)
    if (params?.contextType) query.append('context_type', params.contextType)
    const queryStr = query.toString()
    return this.request<Array<{
      id: string;
      name: string;
      slug: string;
      category: string;
      body: string;
      variables: string[];
      context_type: string | null;
      sort_order: number;
    }>>(`/api/v1/message-templates/system${queryStr ? `?${queryStr}` : ''}`)
  }

  // ============================================================================
  // E2EE (END-TO-END ENCRYPTION)
  // ============================================================================

  /**
   * Register E2EE key bundle (identity key, signed prekey, one-time prekeys)
   */
  async registerE2EEKeys(userId: string, bundle: {
    identity_key: { public_key: string; registration_id: number };
    signed_prekey: { key_id: number; public_key: string; signature: string };
    one_time_prekeys: Array<{ key_id: number; public_key: string }>;
  }) {
    return this.request<{ status: string; message: string }>(
      `/api/v1/e2ee/keys/register?user_id=${userId}`,
      { method: 'POST', body: JSON.stringify(bundle) }
    )
  }

  /**
   * Upload additional one-time prekeys
   */
  async uploadE2EEPrekeys(userId: string, prekeys: Array<{ key_id: number; public_key: string }>) {
    return this.request<{ status: string; count: number }>(
      `/api/v1/e2ee/keys/prekeys?user_id=${userId}`,
      { method: 'POST', body: JSON.stringify(prekeys) }
    )
  }

  /**
   * Get count of available one-time prekeys
   */
  async getE2EEPrekeyCount(userId: string) {
    return this.request<{ count: number }>(`/api/v1/e2ee/keys/prekey-count?user_id=${userId}`)
  }

  /**
   * Get a user's prekey bundle for establishing an E2EE session
   */
  async getE2EEPreKeyBundle(targetUserId: string, userId: string) {
    return this.request<{
      user_id: string;
      registration_id: number;
      identity_key: string;
      signed_prekey_id: number;
      signed_prekey: string;
      signed_prekey_signature: string;
      one_time_prekey_id: number | null;
      one_time_prekey: string | null;
    }>(`/api/v1/e2ee/keys/bundle/${targetUserId}?user_id=${userId}`)
  }

  /**
   * Check if a user has registered E2EE keys
   */
  async checkUserHasE2EEKeys(targetUserId: string) {
    return this.request<{ has_keys: boolean }>(`/api/v1/e2ee/keys/has-keys/${targetUserId}`)
  }

  /**
   * Upload encrypted key backup for PIN-based recovery
   */
  async uploadE2EEKeyBackup(userId: string, backup: {
    encrypted_data: string;
    salt: string;
    iv: string;
  }) {
    return this.request<{ status: string; message: string }>(
      `/api/v1/e2ee/keys/backup?user_id=${userId}`,
      { method: 'POST', body: JSON.stringify(backup) }
    )
  }

  /**
   * Get encrypted key backup for PIN-based recovery
   */
  async getE2EEKeyBackup(userId: string) {
    return this.request<{
      encrypted_data: string;
      salt: string;
      iv: string;
      version: number;
    }>(`/api/v1/e2ee/keys/backup?user_id=${userId}`)
  }

  /**
   * Delete E2EE key backup
   */
  async deleteE2EEKeyBackup(userId: string) {
    return this.request<{ status: string; message: string }>(
      `/api/v1/e2ee/keys/backup?user_id=${userId}`,
      { method: 'DELETE' }
    )
  }

  /**
   * Check E2EE session status with a peer
   */
  async getE2EESessionStatus(peerId: string, userId: string) {
    return this.request<{
      has_session: boolean;
      last_activity: string | null;
    }>(`/api/v1/e2ee/sessions/${peerId}?user_id=${userId}`)
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

  async adminSetUserPassword(userId: string, password: string, permanent: boolean = true) {
    return this.request<{ success: boolean; message: string }>(
      `/api/v1/admin/users/${userId}/set-password`,
      { method: 'POST', body: JSON.stringify({ password, permanent }) }
    )
  }

  async adminChangeUserEmail(userId: string, newEmail: string) {
    return this.request<{ success: boolean; old_email: string; new_email: string; message: string }>(
      `/api/v1/admin/users/${userId}/change-email`,
      { method: 'POST', body: JSON.stringify({ new_email: newEmail }) }
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

  async updateScheduleAvailability(availabilityId: string, data: any) {
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

  // User Directory - The Network tab
  async getUserDirectory(params?: {
    search?: string;
    role?: string;
    is_order_member?: boolean;
    is_partner?: boolean;
    location?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.role) searchParams.append('role', params.role)
    if (params?.is_order_member !== undefined) searchParams.append('is_order_member', params.is_order_member.toString())
    if (params?.is_partner !== undefined) searchParams.append('is_partner', params.is_partner.toString())
    if (params?.location) searchParams.append('location', params.location)
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())

    return this.request<{
      users: Array<{
        id: string;
        username: string | null;
        full_name: string | null;
        display_name: string | null;
        avatar_url: string | null;
        role: string | null;
        location: string | null;
        is_order_member: boolean;
        is_partner: boolean;
        connection_status: 'none' | 'pending_sent' | 'pending_received' | 'connected';
      }>;
      total: number;
      page: number;
      pages: number;
    }>(`/api/v1/community/users/directory?${searchParams}`)
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

  async getProjectCollabs(projectId: string) {
    return this.request<any[]>(`/api/v1/community/collabs/by-project/${projectId}`)
  }

  async getCollabApplications(collabId: string, status?: string) {
    const params = status ? `?status=${status}` : ''
    return this.request<any[]>(`/api/v1/community/collabs/${collabId}/applications${params}`)
  }

  async updateCollabApplicationStatus(
    applicationId: string,
    status: string,
    internalNotes?: string,
    rating?: number
  ) {
    return this.request<any>(`/api/v1/community/collab-applications/${applicationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, internal_notes: internalNotes, rating }),
    })
  }

  async getApplicantEmail(applicationId: string) {
    return this.request<{ email: string; name: string }>(
      `/api/v1/community/collab-applications/${applicationId}/email`
    )
  }

  async bookApplicant(applicationId: string, booking: {
    booking_rate?: string;
    booking_start_date?: string; // YYYY-MM-DD
    booking_end_date?: string;
    booking_notes?: string;
    booking_schedule_notes?: string;
    character_id?: string;
    billing_position?: number;
    contract_type?: string;
    role_title?: string;
    department?: string;
    request_documents?: boolean;
    document_types?: string[];
    send_notification?: boolean;
    notification_message?: string;
  }) {
    return this.request(`/api/v1/community/collab-applications/${applicationId}/book`, {
      method: 'POST',
      body: JSON.stringify(booking),
    })
  }

  async unbookApplicant(applicationId: string, reason: string) {
    return this.request(`/api/v1/community/collab-applications/${applicationId}/unbook`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async getCommunityActivity(limit: number = 20) {
    return this.request<any[]>(`/api/v1/community/activity?limit=${limit}`)
  }

  // ============================================================================
  // COMMUNITY FEED
  // ============================================================================

  async listPublicFeed(params?: { limit?: number; before?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.before) searchParams.set('before', params.before)
    const query = searchParams.toString()
    return this.request<{ posts: any[]; next_cursor: string | null }>(
      `/api/v1/community/feed/public${query ? `?${query}` : ''}`
    )
  }

  async listConnectionsFeed(params?: { limit?: number; before?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.before) searchParams.set('before', params.before)
    const query = searchParams.toString()
    return this.request<{ posts: any[]; next_cursor: string | null }>(
      `/api/v1/community/feed/connections${query ? `?${query}` : ''}`
    )
  }

  async getPost(postId: string) {
    return this.request<any>(`/api/v1/community/posts/${postId}`)
  }

  async createPost(data: {
    content: string;
    images?: Array<{ url: string; alt?: string; width?: number; height?: number }>;
    link_url?: string;
    link_title?: string;
    link_description?: string;
    link_image?: string;
    link_site_name?: string;
    visibility: 'public' | 'connections';
    is_profile_update?: boolean;
  }) {
    return this.request<any>('/api/v1/community/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePost(postId: string, data: { content?: string; visibility?: 'public' | 'connections' }) {
    return this.request<any>(`/api/v1/community/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deletePost(postId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/posts/${postId}`, {
      method: 'DELETE',
    })
  }

  async likePost(postId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/posts/${postId}/like`, {
      method: 'POST',
    })
  }

  async unlikePost(postId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/posts/${postId}/unlike`, {
      method: 'DELETE',
    })
  }

  async listPostComments(postId: string) {
    return this.request<any[]>(`/api/v1/community/posts/${postId}/comments`)
  }

  async createPostComment(postId: string, data: { content: string; parent_comment_id?: string }) {
    return this.request<any>(`/api/v1/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePostComment(commentId: string, data: { content: string }) {
    return this.request<any>(`/api/v1/community/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deletePostComment(commentId: string) {
    return this.request<{ success: boolean }>(`/api/v1/community/comments/${commentId}`, {
      method: 'DELETE',
    })
  }

  async fetchLinkPreview(url: string) {
    return this.request<{
      url: string;
      title?: string;
      description?: string;
      image?: string;
      site_name?: string;
      error?: string;
    }>('/api/v1/community/posts/link-preview', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  }

  // ============================================================================
  // BACKLOT PROJECTS
  // ============================================================================

  async listBacklotProjects(options?: {
    status?: string;
    visibility?: string;
    search?: string;
    ownership?: 'owner' | 'member' | 'all';
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.visibility) params.append('visibility', options.visibility);
    if (options?.search) params.append('search', options.search);
    if (options?.ownership) params.append('ownership', options.ownership);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request<any[]>(`/api/v1/backlot/projects${queryString ? `?${queryString}` : ''}`);
  }

  async listPublicBacklotProjects(options?: {
    status?: string;
    search?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request<{ projects: any[] }>(`/api/v1/backlot/projects/public${queryString ? `?${queryString}` : ''}`);
  }

  // =====================================================
  // Donation Methods
  // =====================================================

  async createDonationCheckout(projectId: string, data: {
    amount_cents: number;
    message?: string;
    is_anonymous?: boolean;
  }) {
    return this.request<{ checkout_url: string; donation_id: string }>(`/api/v1/backlot/projects/${projectId}/donate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDonationSummary(projectId: string) {
    return this.request<{
      donations_enabled: boolean;
      donation_message?: string;
      total_raised_cents: number;
      donor_count: number;
      donation_count: number;
      goal_cents?: number;
      percent_of_goal?: number;
      recent_donors: Array<{
        name: string;
        amount_cents: number;
        created_at: string;
      }>;
    }>(`/api/v1/backlot/projects/${projectId}/donations/summary`);
  }

  async listProjectDonations(projectId: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const queryString = params.toString();
    return this.request<{
      donations: Array<{
        id: string;
        amount_cents: number;
        net_amount_cents?: number;
        platform_fee_cents?: number;
        currency: string;
        status: string;
        message?: string;
        is_anonymous: boolean;
        created_at: string;
        donor?: {
          id?: string;
          name?: string;
          email?: string;
        };
      }>;
    }>(`/api/v1/backlot/projects/${projectId}/donations${queryString ? `?${queryString}` : ''}`);
  }

  async updateDonationSettings(projectId: string, data: {
    donations_enabled?: boolean;
    donation_goal_cents?: number;
    donation_message?: string;
  }) {
    const params = new URLSearchParams();
    if (data.donations_enabled !== undefined) params.append('donations_enabled', String(data.donations_enabled));
    if (data.donation_goal_cents !== undefined) params.append('donation_goal_cents', String(data.donation_goal_cents));
    if (data.donation_message !== undefined) params.append('donation_message', data.donation_message);
    return this.request<{
      donations_enabled: boolean;
      donation_goal_cents?: number;
      donation_message?: string;
    }>(`/api/v1/backlot/projects/${projectId}/donation-settings?${params.toString()}`, {
      method: 'PATCH',
    });
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

  async getBacklotWorkspaceInit(projectId: string) {
    return this.request<any>(`/api/v1/backlot/projects/${projectId}/workspace-init`);
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
    video_url?: string;
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

  // Dailies browser upload
  async getDailiesBrowserUploadUrl(projectId: string, filename: string, contentType: string) {
    return this.request<{
      upload_url: string;
      s3_key: string;
      standalone_asset_id: string;
      expires_in: number;
    }>(`/api/v1/backlot/dailies/browser-upload-url`, {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, filename, content_type: contentType }),
    })
  }

  async completeDailiesBrowserUpload(data: {
    standalone_asset_id: string;
    project_id: string;
    camera_label?: string;
    scene_number?: string;
    take_number?: number;
  }) {
    return this.request<{ clip: any }>(`/api/v1/backlot/dailies/complete-browser-upload`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
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

  async getAssetUploadUrl(projectId: string, data: {
    filename: string;
    content_type: string;
    folder_id?: string | null;
  }) {
    return this.request<{
      upload_url: string;
      s3_key: string;
      asset_id: string;
      expires_in: number;
    }>(`/api/v1/backlot/projects/${projectId}/assets/upload-url`, {
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
    approval_status?: string;
  }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.is_active !== undefined) query.append('is_active', params.is_active.toString())
    if (params?.is_featured !== undefined) query.append('is_featured', params.is_featured.toString())
    if (params?.collab_type) query.append('collab_type', params.collab_type)
    if (params?.search) query.append('search', params.search)
    if (params?.approval_status) query.append('approval_status', params.approval_status)

    return this.request<{ collabs: any[]; total: number }>(`/api/v1/admin/community/collabs?${query}`)
  }

  async listPendingCollabsAdmin(params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    return this.request<{ collabs: any[]; total: number }>(`/api/v1/admin/community/collabs/pending?${query}`)
  }

  async approveCollabAdmin(collabId: string, notes?: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/admin/community/collabs/${collabId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    })
  }

  async rejectCollabAdmin(collabId: string, reason: string) {
    return this.request<{ success: boolean; message: string }>(`/api/v1/admin/community/collabs/${collabId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async getCollabApprovalSetting() {
    return this.request<{ enabled: boolean }>(`/api/v1/admin/community/settings/require_collab_approval`)
  }

  async updateCollabApprovalSetting(enabled: boolean) {
    return this.request<{ success: boolean; enabled: boolean }>(`/api/v1/admin/community/settings/require_collab_approval?enabled=${enabled}`, {
      method: 'PUT',
    })
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
    platform_roles?: string[]
    custom_quota_bytes?: number
    send_welcome_email?: boolean
    custom_password?: string
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
      email_sent?: boolean
      email_error?: string | null
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

  // =====================================
  // Order of the Second Watch
  // =====================================

  // --- Craft Houses ---

  async listCraftHouses(params?: { status?: string }) {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    const queryString = query.toString()
    return this.request<{
      craft_houses: Array<{
        id: number
        name: string
        slug: string
        description?: string
        icon?: string
        primary_tracks?: string[]
        status: string
        created_at: string
        updated_at: string
        member_count?: number
        master_name?: string
      }>
      total: number
    }>(`/api/v1/order/craft-houses${queryString ? `?${queryString}` : ''}`)
  }

  async getCraftHouse(craftHouseId: number) {
    return this.request<{
      id: number
      name: string
      slug: string
      description?: string
      icon?: string
      primary_tracks?: string[]
      status: string
      created_at: string
      updated_at: string
      member_count?: number
      master_name?: string
    }>(`/api/v1/order/craft-houses/${craftHouseId}`)
  }

  async getCraftHouseMembers(craftHouseId: number, params?: { skip?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    const queryString = query.toString()
    return this.request<{
      members: Array<{
        user_id: string
        user_name?: string
        role: string
        primary_track?: string
        city?: string
        joined_at: string
      }>
      total: number
    }>(`/api/v1/order/craft-houses/${craftHouseId}/members${queryString ? `?${queryString}` : ''}`)
  }

  async joinCraftHouse(craftHouseId: number) {
    return this.request<{
      id: number
      user_id: string
      craft_house_id: number
      role: string
      joined_at: string
      created_at: string
      craft_house_name?: string
    }>(`/api/v1/order/craft-houses/${craftHouseId}/join`, { method: 'POST' })
  }

  async leaveCraftHouse(craftHouseId: number) {
    return this.request<{ message: string }>(`/api/v1/order/craft-houses/${craftHouseId}/leave`, {
      method: 'DELETE',
    })
  }

  async getMyCraftHouseMemberships() {
    return this.request<Array<{
      id: number
      user_id: string
      craft_house_id: number
      role: string
      joined_at: string
      created_at: string
      craft_house_name?: string
    }>>('/api/v1/order/craft-houses/my/memberships')
  }

  // --- Fellowships ---

  async listFellowships(params?: { fellowship_type?: string }) {
    const query = new URLSearchParams()
    if (params?.fellowship_type) query.append('fellowship_type', params.fellowship_type)
    const queryString = query.toString()
    return this.request<{
      fellowships: Array<{
        id: number
        name: string
        slug: string
        fellowship_type: string
        description?: string
        requirements?: string
        is_opt_in: boolean
        is_visible: boolean
        status: string
        created_at: string
        updated_at: string
        member_count?: number
      }>
      total: number
    }>(`/api/v1/order/fellowships${queryString ? `?${queryString}` : ''}`)
  }

  async getFellowship(fellowshipId: number) {
    return this.request<{
      id: number
      name: string
      slug: string
      fellowship_type: string
      description?: string
      requirements?: string
      is_opt_in: boolean
      is_visible: boolean
      status: string
      created_at: string
      updated_at: string
      member_count?: number
    }>(`/api/v1/order/fellowships/${fellowshipId}`)
  }

  async joinFellowship(fellowshipId: number) {
    return this.request<{
      id: number
      user_id: string
      fellowship_id: number
      role: string
      joined_at: string
      created_at: string
      fellowship_name?: string
    }>(`/api/v1/order/fellowships/${fellowshipId}/join`, { method: 'POST' })
  }

  async leaveFellowship(fellowshipId: number) {
    return this.request<{ message: string }>(`/api/v1/order/fellowships/${fellowshipId}/leave`, {
      method: 'DELETE',
    })
  }

  async getMyFellowshipMemberships() {
    return this.request<Array<{
      id: number
      user_id: string
      fellowship_id: number
      role: string
      joined_at: string
      created_at: string
      fellowship_name?: string
    }>>('/api/v1/order/fellowships/my/memberships')
  }

  // --- Governance ---

  async listGovernancePositions(params?: {
    position_type?: string
    scope_type?: string
    scope_id?: number
    active_only?: boolean
  }) {
    const query = new URLSearchParams()
    if (params?.position_type) query.append('position_type', params.position_type)
    if (params?.scope_type) query.append('scope_type', params.scope_type)
    if (params?.scope_id !== undefined) query.append('scope_id', params.scope_id.toString())
    if (params?.active_only !== undefined) query.append('active_only', params.active_only.toString())
    const queryString = query.toString()
    return this.request<{
      positions: Array<{
        id: number
        user_id: string
        position_type: string
        scope_type?: string
        scope_id?: number
        title: string
        description?: string
        started_at: string
        ended_at?: string
        is_active: boolean
        appointed_by?: string
        created_at: string
        updated_at: string
        user_name?: string
        scope_name?: string
      }>
      total: number
    }>(`/api/v1/order/governance/positions${queryString ? `?${queryString}` : ''}`)
  }

  async getHighCouncil() {
    return this.request<{
      grand_master?: {
        id: number
        user_id: string
        position_type: string
        title: string
        started_at: string
        is_active: boolean
        user_name?: string
      }
      council_members: Array<{
        id: number
        user_id: string
        position_type: string
        title: string
        started_at: string
        is_active: boolean
        user_name?: string
      }>
    }>('/api/v1/order/governance/high-council')
  }

  // --- Membership Tiers ---

  async getMembershipTiers() {
    return this.request<Array<{
      tier: string
      name: string
      price_cents: number
      description: string
      benefits: string[]
    }>>('/api/v1/order/membership/tiers')
  }

  async getMyMembershipStatus() {
    return this.request<{
      is_order_member: boolean
      membership_status?: string
      membership_tier?: string
      tier_started_at?: string
      dues_status?: string
      next_billing_date?: string
      stripe_customer_id?: string
    }>('/api/v1/order/membership/me')
  }

  // --- Order Dashboard ---

  async getOrderDashboardExtended() {
    return this.request<{
      is_order_member: boolean
      membership_status?: string
      membership_tier?: string
      dues_status?: string
      primary_track?: string
      lodge_id?: number
      lodge_name?: string
      craft_houses: Array<{
        id: number
        user_id: string
        craft_house_id: number
        role: string
        joined_at: string
        created_at: string
        craft_house_name?: string
      }>
      fellowships: Array<{
        id: number
        user_id: string
        fellowship_id: number
        role: string
        joined_at: string
        created_at: string
        fellowship_name?: string
      }>
      joined_at?: string
      pending_booking_requests: number
      active_job_applications: number
      governance_positions: Array<{
        id: number
        user_id: string
        position_type: string
        title: string
        is_active: boolean
      }>
    }>('/api/v1/order/dashboard/extended')
  }

  // --- Order Lodges ---

  async listOrderLodges(params?: { status?: string; city?: string }) {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    if (params?.city) query.append('city', params.city)
    const queryString = query.toString()
    return this.request<{
      lodges: Array<{
        id: number
        name: string
        slug: string
        city: string
        region?: string
        status: string
        description?: string
        base_lodge_dues_cents: number
        created_at: string
        updated_at: string
        member_count?: number
      }>
      total: number
    }>(`/api/v1/order/lodges${queryString ? `?${queryString}` : ''}`)
  }

  async getOrderLodge(lodgeId: number) {
    return this.request<{
      id: number
      name: string
      slug: string
      city: string
      region?: string
      status: string
      description?: string
      base_lodge_dues_cents: number
      created_at: string
      updated_at: string
      member_count?: number
    }>(`/api/v1/order/lodges/${lodgeId}`)
  }

  async joinOrderLodge(lodgeId: number) {
    return this.request<{
      id: number
      user_id: string
      lodge_id: number
      status: string
      is_officer: boolean
      joined_at: string
      lodge_name?: string
      lodge_city?: string
    }>(`/api/v1/order/lodges/${lodgeId}/join`, { method: 'POST' })
  }

  async getMyOrderLodgeMemberships() {
    return this.request<Array<{
      id: number
      user_id: string
      lodge_id: number
      status: string
      is_officer: boolean
      officer_title?: string
      joined_at?: string
      lodge_name?: string
      lodge_city?: string
    }>>('/api/v1/order/lodges/my')
  }

  // --- Order Application ---

  async submitOrderApplication(data: {
    primary_track: string
    city?: string
    region?: string
    portfolio_links?: string
    statement?: string
    years_experience?: number
    current_role?: string
  }) {
    return this.request<{
      id: number
      user_id: string
      primary_track: string
      status: string
      created_at: string
    }>('/api/v1/order/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getMyOrderApplication() {
    return this.request<{
      id: number
      user_id: string
      primary_track: string
      city?: string
      region?: string
      portfolio_links?: string
      statement?: string
      years_experience?: number
      current_role?: string
      status: string
      rejection_reason?: string
      created_at: string
      updated_at: string
    } | null>('/api/v1/order/applications/me')
  }

  // --- Order Profile ---

  async getMyOrderProfile() {
    return this.request<{
      id: number
      user_id: string
      primary_track: string
      secondary_tracks?: string
      city?: string
      region?: string
      portfolio_url?: string
      imdb_url?: string
      youtube_url?: string
      vimeo_url?: string
      website_url?: string
      gear_summary?: string
      bio?: string
      years_experience?: number
      availability_status?: string
      lodge_id?: number
      status: string
      membership_tier: string
      joined_at?: string
      dues_status?: string
      lodge_name?: string
      lodge_city?: string
    } | null>('/api/v1/order/profile/me')
  }

  async updateMyOrderProfile(data: {
    primary_track?: string
    secondary_tracks?: string
    city?: string
    region?: string
    portfolio_url?: string
    imdb_url?: string
    youtube_url?: string
    vimeo_url?: string
    website_url?: string
    gear_summary?: string
    bio?: string
    years_experience?: number
    availability_status?: string
  }) {
    return this.request<{
      id: number
      user_id: string
      primary_track: string
      status: string
      updated_at: string
    }>('/api/v1/order/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // --- Order Directory ---

  async getOrderDirectory(params?: {
    track?: string
    city?: string
    lodge_id?: number
    availability?: string
    skip?: number
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params?.track) query.append('track', params.track)
    if (params?.city) query.append('city', params.city)
    if (params?.lodge_id !== undefined) query.append('lodge_id', params.lodge_id.toString())
    if (params?.availability) query.append('availability', params.availability)
    if (params?.skip !== undefined) query.append('skip', params.skip.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    const queryString = query.toString()
    return this.request<Array<{
      user_id: string
      user_name?: string
      primary_track: string
      city?: string
      region?: string
      lodge_name?: string
      availability_status?: string
      years_experience?: number
      bio?: string
    }>>(`/api/v1/order/directory${queryString ? `?${queryString}` : ''}`)
  }

  // ============================================================================
  // CRM — Contacts, Activities, Interactions
  // ============================================================================

  async getCRMContacts(params?: {
    search?: string
    temperature?: string
    status?: string
    tag?: string
    assigned_rep_id?: string
    unassigned?: boolean
    scope?: string
    has_email?: boolean
    has_phone?: boolean
    has_website?: boolean
    sort_by?: string
    sort_order?: string
    limit?: number
    offset?: number
  }) {
    const query = new URLSearchParams()
    if (params?.search) query.append('search', params.search)
    if (params?.temperature) query.append('temperature', params.temperature)
    if (params?.status) query.append('status', params.status)
    if (params?.tag) query.append('tag', params.tag)
    if (params?.assigned_rep_id) query.append('assigned_rep_id', params.assigned_rep_id)
    if (params?.unassigned) query.append('unassigned', 'true')
    if (params?.scope) query.append('scope', params.scope)
    if (params?.has_email !== undefined) query.append('has_email', params.has_email.toString())
    if (params?.has_phone !== undefined) query.append('has_phone', params.has_phone.toString())
    if (params?.has_website !== undefined) query.append('has_website', params.has_website.toString())
    if (params?.sort_by) query.append('sort_by', params.sort_by)
    if (params?.sort_order) query.append('sort_order', params.sort_order)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ contacts: any[]; total: number; limit: number; offset: number }>(
      `/api/v1/crm/contacts${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMContact(id: string) {
    return this.get<any>(`/api/v1/crm/contacts/${id}`)
  }

  async createCRMContact(data: any) {
    return this.post<any>('/api/v1/crm/contacts', data)
  }

  async updateCRMContact(id: string, data: any) {
    return this.put<any>(`/api/v1/crm/contacts/${id}`, data)
  }

  async deleteCRMContact(id: string) {
    return this.delete<any>(`/api/v1/crm/contacts/${id}`)
  }

  async linkCRMContactProfile(contactId: string, profileId: string) {
    return this.post<any>(`/api/v1/crm/contacts/${contactId}/link-profile`, { profile_id: profileId })
  }

  // CRM Companies
  async searchCRMCompanies(q: string, limit?: number) {
    const query = new URLSearchParams()
    if (q) query.append('q', q)
    if (limit) query.append('limit', limit.toString())
    const qs = query.toString()
    return this.get<any[]>(`/api/v1/crm/companies/search${qs ? `?${qs}` : ''}`)
  }

  async getCRMCompanies(params?: { search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.search) query.append('search', params.search)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ companies: any[]; total: number; limit: number; offset: number }>(
      `/api/v1/crm/companies${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMCompany(id: string) {
    return this.get<any>(`/api/v1/crm/companies/${id}`)
  }

  async createCRMCompany(data: any) {
    return this.post<any>('/api/v1/crm/companies', data)
  }

  async updateCRMCompany(id: string, data: any) {
    return this.put<any>(`/api/v1/crm/companies/${id}`, data)
  }

  async deleteCRMCompany(id: string) {
    return this.delete<any>(`/api/v1/crm/companies/${id}`)
  }

  // Direct Import (Leads → Contacts)
  async directImportLeads(data: { lead_ids: string[]; tags?: string[]; assigned_rep_id?: string; enroll_sequence_id?: string }) {
    return this.post<{ imported: number; contact_ids: string[] }>('/api/v1/crm/scraping/leads/direct-import', data)
  }

  async directImportLeadList(listId: string, data?: { tags?: string[]; assigned_rep_id?: string; enroll_sequence_id?: string }) {
    return this.post<{ imported: number; contact_ids: string[] }>(`/api/v1/crm/scraping/lead-lists/${listId}/direct-import`, data || {})
  }

  async getCRMActivities(params?: {
    contact_id?: string
    rep_id?: string
    activity_type?: string
    date_from?: string
    date_to?: string
    tz?: string
    limit?: number
    offset?: number
  }) {
    const query = new URLSearchParams()
    if (params?.contact_id) query.append('contact_id', params.contact_id)
    if (params?.rep_id) query.append('rep_id', params.rep_id)
    if (params?.activity_type) query.append('activity_type', params.activity_type)
    if (params?.date_from) query.append('date_from', params.date_from)
    if (params?.date_to) query.append('date_to', params.date_to)
    if (params?.tz) query.append('tz', params.tz)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ activities: any[] }>(`/api/v1/crm/activities${qs ? `?${qs}` : ''}`)
  }

  async createCRMActivity(data: any) {
    return this.post<any>('/api/v1/crm/activities', data)
  }

  async updateCRMActivity(id: string, data: any) {
    return this.put<any>(`/api/v1/crm/activities/${id}`, data)
  }

  async deleteCRMActivity(id: string) {
    return this.delete<any>(`/api/v1/crm/activities/${id}`)
  }

  async getCRMActivityCalendar(month?: number, year?: number, tz?: string) {
    const query = new URLSearchParams()
    if (month !== undefined) query.append('month', month.toString())
    if (year !== undefined) query.append('year', year.toString())
    if (tz) query.append('tz', tz)
    const qs = query.toString()
    return this.get<{ calendar: Record<string, any[]>; follow_ups: Record<string, any[]>; month: number; year: number }>(
      `/api/v1/crm/activities/calendar${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMFollowUps(tz?: string) {
    const query = new URLSearchParams()
    if (tz) query.append('tz', tz)
    const qs = query.toString()
    return this.get<{ follow_ups: any[] }>(`/api/v1/crm/activities/follow-ups${qs ? `?${qs}` : ''}`)
  }

  async getCRMCalendarEvents(month?: number, year?: number, tz?: string) {
    const query = new URLSearchParams()
    if (month !== undefined) query.append('month', month.toString())
    if (year !== undefined) query.append('year', year.toString())
    if (tz) query.append('tz', tz)
    const qs = query.toString()
    return this.get<{ events: Record<string, any[]>; month: number; year: number }>(
      `/api/v1/crm/calendar/events${qs ? `?${qs}` : ''}`
    )
  }

  async acceptCRMCalendarEvent(eventId: string) {
    return this.post<any>(`/api/v1/crm/calendar/events/${eventId}/accept`, {})
  }

  async declineCRMCalendarEvent(eventId: string) {
    return this.post<any>(`/api/v1/crm/calendar/events/${eventId}/decline`, {})
  }

  async getCRMPendingInviteCount() {
    return this.get<{ count: number }>('/api/v1/crm/calendar/events/pending/count')
  }

  async getCRMMyInteractionsToday() {
    return this.get<any>('/api/v1/crm/interactions/my-today')
  }

  async incrementCRMInteraction(interactionType: string) {
    return this.post<any>('/api/v1/crm/interactions/increment', { interaction_type: interactionType })
  }

  async decrementCRMInteraction(interactionType: string) {
    return this.post<any>('/api/v1/crm/interactions/decrement', { interaction_type: interactionType })
  }

  // CRM Admin
  async getCRMReps() {
    return this.get<{ reps: any[] }>('/api/v1/admin/crm/reps')
  }

  async getCRMAdminInteractions(params?: {
    date_from?: string
    date_to?: string
    rep_id?: string
  }) {
    const query = new URLSearchParams()
    if (params?.date_from) query.append('date_from', params.date_from)
    if (params?.date_to) query.append('date_to', params.date_to)
    if (params?.rep_id) query.append('rep_id', params.rep_id)
    const qs = query.toString()
    return this.get<{ by_rep: any[]; team_totals: any }>(
      `/api/v1/admin/crm/interactions${qs ? `?${qs}` : ''}`
    )
  }

  async assignCRMContact(contactId: string, repId: string, notes?: string) {
    return this.post<any>(`/api/v1/admin/crm/contacts/${contactId}/assign`, { rep_id: repId, notes })
  }

  async bulkAssignCRMContacts(contactIds: string[], repId: string, notes?: string) {
    return this.post<any>('/api/v1/admin/crm/contacts/bulk-assign', {
      contact_ids: contactIds,
      rep_id: repId,
      notes,
    })
  }

  async getCRMContactAssignmentHistory(contactId: string) {
    return this.get<{ history: any[] }>(`/api/v1/admin/crm/contacts/${contactId}/assignment-history`)
  }

  async getCRMNewLeads() {
    return this.get<{ contacts: any[]; total: number }>('/api/v1/crm/new-leads')
  }

  async markCRMNewLeadsViewed() {
    return this.post<{ success: boolean }>('/api/v1/crm/new-leads/mark-viewed', {})
  }

  async addCRMTeamMember(userId: string, role: string) {
    return this.post<any>('/api/v1/admin/crm/team/add', { user_id: userId, role })
  }

  async removeCRMTeamMember(userId: string) {
    return this.post<any>('/api/v1/admin/crm/team/remove', { user_id: userId })
  }

  async updateCRMTeamMemberRole(userId: string, role: string) {
    return this.put<any>(`/api/v1/admin/crm/team/${userId}/role`, { role })
  }

  // ============================================================================
  // CRM — Deals & Pipeline
  // ============================================================================

  async getCRMDeals(params?: {
    contact_id?: string
    stage?: string
    product_type?: string
    assigned_rep_id?: string
    search?: string
    sort_by?: string
    sort_order?: string
    limit?: number
    offset?: number
  }) {
    const query = new URLSearchParams()
    if (params?.contact_id) query.append('contact_id', params.contact_id)
    if (params?.stage) query.append('stage', params.stage)
    if (params?.product_type) query.append('product_type', params.product_type)
    if (params?.assigned_rep_id) query.append('assigned_rep_id', params.assigned_rep_id)
    if (params?.search) query.append('search', params.search)
    if (params?.sort_by) query.append('sort_by', params.sort_by)
    if (params?.sort_order) query.append('sort_order', params.sort_order)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ deals: any[]; total: number; limit: number; offset: number }>(
      `/api/v1/crm/deals${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMDeal(id: string) {
    return this.get<any>(`/api/v1/crm/deals/${id}`)
  }

  async createCRMDeal(data: any) {
    return this.post<any>('/api/v1/crm/deals', data)
  }

  async updateCRMDeal(id: string, data: any) {
    return this.put<any>(`/api/v1/crm/deals/${id}`, data)
  }

  async changeCRMDealStage(id: string, data: { stage: string; notes?: string; close_reason?: string }) {
    return this.patch<any>(`/api/v1/crm/deals/${id}/stage`, data)
  }

  async deleteCRMDeal(id: string) {
    return this.delete<any>(`/api/v1/crm/deals/${id}`)
  }

  async getCRMPipeline(params?: {
    assigned_rep_id?: string
    product_type?: string
  }) {
    const query = new URLSearchParams()
    if (params?.assigned_rep_id) query.append('assigned_rep_id', params.assigned_rep_id)
    if (params?.product_type) query.append('product_type', params.product_type)
    const qs = query.toString()
    return this.get<{ pipeline: Record<string, any[]> }>(
      `/api/v1/crm/deals/pipeline${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMPipelineStats(params?: { assigned_rep_id?: string }) {
    const query = new URLSearchParams()
    if (params?.assigned_rep_id) query.append('assigned_rep_id', params.assigned_rep_id)
    const qs = query.toString()
    return this.get<{ stages: any[] }>(
      `/api/v1/crm/deals/pipeline/stats${qs ? `?${qs}` : ''}`
    )
  }

  // CRM Admin — Deals
  async getCRMLeads(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ leads: any[]; total: number; limit: number; offset: number }>(
      `/api/v1/admin/crm/leads${qs ? `?${qs}` : ''}`
    )
  }

  async assignCRMDeal(dealId: string, repId: string) {
    return this.post<any>(`/api/v1/admin/crm/deals/${dealId}/assign`, { rep_id: repId })
  }

  async getCRMPipelineForecast(monthsAhead?: number) {
    const query = new URLSearchParams()
    if (monthsAhead !== undefined) query.append('months_ahead', monthsAhead.toString())
    const qs = query.toString()
    return this.get<{ forecast: any[]; summary: any }>(
      `/api/v1/admin/crm/pipeline/forecast${qs ? `?${qs}` : ''}`
    )
  }

  // ============================================================================
  // CRM — Goals & KPIs
  // ============================================================================

  async getCRMMyGoals(params?: { period_type?: string }) {
    const query = new URLSearchParams()
    if (params?.period_type) query.append('period_type', params.period_type)
    const qs = query.toString()
    return this.get<{ goals: any[] }>(`/api/v1/crm/goals/my${qs ? `?${qs}` : ''}`)
  }

  async createCRMGoal(data: any) {
    return this.post<any>('/api/v1/admin/crm/goals', data)
  }

  async updateCRMGoal(id: string, data: any) {
    return this.put<any>(`/api/v1/admin/crm/goals/${id}`, data)
  }

  async deleteCRMGoal(id: string) {
    return this.delete<any>(`/api/v1/admin/crm/goals/${id}`)
  }

  async setCRMGoalOverride(id: string, data: { manual_override: number | null }) {
    return this.put<any>(`/api/v1/crm/goals/${id}/override`, data)
  }

  async getCRMKPIOverview(params?: { date_from?: string; date_to?: string }) {
    const query = new URLSearchParams()
    if (params?.date_from) query.append('date_from', params.date_from)
    if (params?.date_to) query.append('date_to', params.date_to)
    const qs = query.toString()
    return this.get<any>(`/api/v1/admin/crm/kpi/overview${qs ? `?${qs}` : ''}`)
  }

  async getCRMRepPerformance(params?: { date_from?: string; date_to?: string }) {
    const query = new URLSearchParams()
    if (params?.date_from) query.append('date_from', params.date_from)
    if (params?.date_to) query.append('date_to', params.date_to)
    const qs = query.toString()
    return this.get<{ reps: any[] }>(`/api/v1/admin/crm/kpi/rep-performance${qs ? `?${qs}` : ''}`)
  }

  async getCRMKPITrends(params?: { period?: string; months_back?: number }) {
    const query = new URLSearchParams()
    if (params?.period) query.append('period', params.period)
    if (params?.months_back !== undefined) query.append('months_back', params.months_back.toString())
    const qs = query.toString()
    return this.get<{ trends: any[]; period: string }>(`/api/v1/admin/crm/kpi/trends${qs ? `?${qs}` : ''}`)
  }

  async getCRMLeaderboard(params?: { metric?: string; date_from?: string; date_to?: string }) {
    const query = new URLSearchParams()
    if (params?.metric) query.append('metric', params.metric)
    if (params?.date_from) query.append('date_from', params.date_from)
    if (params?.date_to) query.append('date_to', params.date_to)
    const qs = query.toString()
    return this.get<{ leaderboard: any[]; metric: string }>(
      `/api/v1/admin/crm/kpi/leaderboard${qs ? `?${qs}` : ''}`
    )
  }

  // ============================================================================
  // CRM — Customer Log & Reviews
  // ============================================================================

  async getCRMContactLog(contactId: string, status?: string) {
    const query = new URLSearchParams()
    if (status) query.append('status', status)
    const qs = query.toString()
    return this.get<{ log_entries: any[] }>(`/api/v1/crm/contacts/${contactId}/log${qs ? `?${qs}` : ''}`)
  }

  async createCRMLogEntry(contactId: string, data: any) {
    return this.post<any>(`/api/v1/crm/contacts/${contactId}/log`, data)
  }

  async updateCRMLogEntry(logId: string, data: any) {
    return this.put<any>(`/api/v1/crm/log/${logId}`, data)
  }

  async getCRMOpenLogEntries() {
    return this.get<{ log_entries: any[] }>('/api/v1/crm/log/open')
  }

  async getCRMMyReviews() {
    return this.get<{ reviews: any[] }>('/api/v1/crm/reviews/my')
  }

  // Admin reviews
  async getCRMAdminReviews(params?: { rep_id?: string; review_type?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.rep_id) query.append('rep_id', params.rep_id)
    if (params?.review_type) query.append('review_type', params.review_type)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ reviews: any[]; total: number }>(`/api/v1/admin/crm/reviews${qs ? `?${qs}` : ''}`)
  }

  async createCRMReview(data: any) {
    return this.post<any>('/api/v1/admin/crm/reviews', data)
  }

  async updateCRMReview(id: string, data: any) {
    return this.put<any>(`/api/v1/admin/crm/reviews/${id}`, data)
  }

  async deleteCRMReview(id: string) {
    return this.delete<any>(`/api/v1/admin/crm/reviews/${id}`)
  }

  async escalateCRMLogEntry(logId: string) {
    return this.post<any>(`/api/v1/admin/crm/log/${logId}/escalate`, {})
  }

  // ============================================================================
  // CRM — Sidebar Badges
  // ============================================================================

  async getCRMSidebarBadges() {
    return this.get<Record<string, number>>('/api/v1/crm/sidebar-badges')
  }

  async markCRMTabViewed(tabKey: string) {
    return this.post<{ success: boolean }>('/api/v1/crm/tab-viewed', { tab_key: tabKey })
  }

  // ============================================================================
  // CRM — Contact Notes
  // ============================================================================

  async getCRMContactNotes(contactId: string) {
    return this.get<{ notes: any[] }>(`/api/v1/crm/contacts/${contactId}/notes`)
  }

  async createCRMContactNote(contactId: string, data: { content: string; parent_id?: string }) {
    return this.post<any>(`/api/v1/crm/contacts/${contactId}/notes`, data)
  }

  async deleteCRMContactNote(contactId: string, noteId: string) {
    return this.delete<any>(`/api/v1/crm/contacts/${contactId}/notes/${noteId}`)
  }

  // ============================================================================
  // CRM — Email Campaigns & DNC
  // ============================================================================

  async updateCRMContactDNC(contactId: string, data: {
    do_not_email?: boolean
    do_not_call?: boolean
    do_not_text?: boolean
    status?: string
  }) {
    return this.patch<any>(`/api/v1/crm/contacts/${contactId}/dnc`, data)
  }

  async getCRMCampaigns(params?: { status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ campaigns: any[]; total: number }>(
      `/api/v1/admin/crm/campaigns${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMCampaign(id: string) {
    return this.get<any>(`/api/v1/admin/crm/campaigns/${id}`)
  }

  async createCRMCampaign(data: any) {
    return this.post<any>('/api/v1/admin/crm/campaigns', data)
  }

  async updateCRMCampaign(id: string, data: any) {
    return this.put<any>(`/api/v1/admin/crm/campaigns/${id}`, data)
  }

  async deleteCRMCampaign(id: string) {
    return this.delete<any>(`/api/v1/admin/crm/campaigns/${id}`)
  }

  async scheduleCRMCampaign(id: string) {
    return this.post<any>(`/api/v1/admin/crm/campaigns/${id}/schedule`, {})
  }

  async cancelCRMCampaign(id: string) {
    return this.post<any>(`/api/v1/admin/crm/campaigns/${id}/cancel`, {})
  }

  async sendCRMCampaignNow(id: string) {
    return this.post<any>(`/api/v1/admin/crm/campaigns/${id}/send-now`, {})
  }

  async getCRMCampaignSenders(id: string) {
    return this.get<{ senders: any[] }>(`/api/v1/admin/crm/campaigns/${id}/senders`)
  }

  async updateCRMCampaignSenders(id: string, accountIds: string[]) {
    return this.put<{ senders: any[] }>(`/api/v1/admin/crm/campaigns/${id}/senders`, { account_ids: accountIds })
  }

  async previewCRMCampaignTargeting(id: string) {
    return this.get<{ total: number; sample: any[] }>(`/api/v1/admin/crm/campaigns/${id}/preview-targeting`)
  }

  // CRM — Email System (Individual Rep Inbox)

  async getCRMEmailAccount() {
    return this.get<any>('/api/v1/crm/email/account')
  }

  async updateCRMEmailSignature(signatureHtml: string) {
    return this.put<any>('/api/v1/crm/email/account/signature', { signature_html: signatureHtml })
  }

  async getCRMEmailInbox(params?: {
    unread_only?: boolean; archived?: boolean; starred_only?: boolean;
    snoozed?: boolean; deleted?: boolean; label_id?: string;
    sort_by?: string; all_threads?: boolean;
    search?: string; limit?: number; offset?: number
  }) {
    const query = new URLSearchParams()
    if (params?.unread_only) query.append('unread_only', 'true')
    if (params?.archived) query.append('archived', 'true')
    if (params?.starred_only) query.append('starred_only', 'true')
    if (params?.snoozed) query.append('snoozed', 'true')
    if (params?.deleted) query.append('deleted', 'true')
    if (params?.label_id) query.append('label_id', params.label_id)
    if (params?.sort_by) query.append('sort_by', params.sort_by)
    if (params?.all_threads) query.append('all_threads', 'true')
    if (params?.search) query.append('search', params.search)
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ threads: any[]; total: number }>(
      `/api/v1/crm/email/inbox${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMEmailThread(threadId: string) {
    return this.get<{ thread: any; messages: any[] }>(`/api/v1/crm/email/threads/${threadId}`)
  }

  async markCRMEmailThreadRead(threadId: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/read`, {})
  }

  async archiveCRMEmailThread(threadId: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/archive`, {})
  }

  async deleteCRMEmailThread(threadId: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/delete`, {})
  }

  async getCRMEmailContactThreads(contactId: string) {
    return this.get<{ threads: any[] }>(`/api/v1/crm/email/contacts/${contactId}/threads`)
  }

  async getCRMEmailUnreadCount() {
    return this.get<{ count: number }>('/api/v1/crm/email/unread-count')
  }

  async getCRMEmailSuggestions(q: string) {
    const query = new URLSearchParams({ q })
    return this.get<{ suggestions: { email: string; display_name: string; company: string | null; source: string; contact_id: string | null }[] }>(`/api/v1/crm/email/suggestions?${query}`)
  }

  async sendCRMEmail(data: {
    contact_id?: string; to_emails: string[]; subject: string;
    body_html: string; body_text?: string; cc?: string[];
    bcc?: string[]; thread_id?: string; scheduled_at?: string;
    attachment_ids?: string[]; template_id?: string;
  }) {
    return this.post<{ message: any; thread_id: string; scheduled?: boolean; internal?: boolean }>('/api/v1/crm/email/send', data)
  }

  // CRM — Email Templates

  async getCRMEmailTemplates(category?: string) {
    const query = new URLSearchParams()
    if (category) query.append('category', category)
    const qs = query.toString()
    return this.get<{ templates: any[] }>(
      `/api/v1/crm/email/templates${qs ? `?${qs}` : ''}`
    )
  }

  async createCRMEmailTemplate(data: {
    name: string; subject: string; body_html: string;
    body_text?: string; category?: string; placeholders?: string[];
  }) {
    return this.post<any>('/api/v1/admin/crm/email/templates', data)
  }

  async updateCRMEmailTemplate(id: string, data: {
    name?: string; subject?: string; body_html?: string;
    body_text?: string; category?: string; placeholders?: string[];
    is_active?: boolean;
  }) {
    return this.put<any>(`/api/v1/admin/crm/email/templates/${id}`, data)
  }

  async deleteCRMEmailTemplate(id: string) {
    return this.delete<any>(`/api/v1/admin/crm/email/templates/${id}`)
  }

  // CRM Admin — Email Accounts

  async createCRMEmailAccount(data: { profile_id: string; email_address: string; display_name: string }) {
    return this.post<any>('/api/v1/admin/crm/email/accounts', data)
  }

  async getCRMEmailAccounts() {
    return this.get<{ accounts: any[] }>('/api/v1/admin/crm/email/accounts')
  }

  async deactivateCRMEmailAccount(accountId: string) {
    return this.delete<any>(`/api/v1/admin/crm/email/accounts/${accountId}`)
  }

  // CRM Email — Star / Snooze / Bulk / Link / Assign

  async starCRMEmailThread(threadId: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/star`, {})
  }

  async snoozeCRMEmailThread(threadId: string, snoozedUntil: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/snooze`, { snoozed_until: snoozedUntil })
  }

  async bulkCRMEmailThreadAction(threadIds: string[], action: string) {
    return this.post<any>('/api/v1/crm/email/threads/bulk', { thread_ids: threadIds, action })
  }

  async linkCRMEmailThreadContact(threadId: string, contactId: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/link-contact`, { contact_id: contactId })
  }

  async unlinkCRMEmailThreadContact(threadId: string) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/unlink-contact`, {})
  }

  async assignCRMEmailThread(threadId: string, assignedTo: string | null) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/assign`, { assigned_to: assignedTo })
  }

  // CRM Email — Internal Notes

  async getCRMEmailThreadNotes(threadId: string) {
    return this.get<{ notes: any[] }>(`/api/v1/crm/email/threads/${threadId}/notes`)
  }

  async createCRMEmailThreadNote(threadId: string, content: string) {
    return this.post<any>(`/api/v1/crm/email/threads/${threadId}/notes`, { content })
  }

  async deleteCRMEmailThreadNote(threadId: string, noteId: string) {
    return this.delete<any>(`/api/v1/crm/email/threads/${threadId}/notes/${noteId}`)
  }

  // CRM Email — Labels

  async getCRMEmailLabels() {
    return this.get<{ labels: any[] }>('/api/v1/crm/email/labels')
  }

  async createCRMEmailLabel(data: { name: string; color?: string }) {
    return this.post<any>('/api/v1/crm/email/labels', data)
  }

  async updateCRMEmailLabel(id: string, data: { name?: string; color?: string }) {
    return this.put<any>(`/api/v1/crm/email/labels/${id}`, data)
  }

  async deleteCRMEmailLabel(id: string) {
    return this.delete<any>(`/api/v1/crm/email/labels/${id}`)
  }

  async addCRMEmailThreadLabel(threadId: string, labelId: string) {
    return this.post<any>(`/api/v1/crm/email/threads/${threadId}/labels/${labelId}`, {})
  }

  async removeCRMEmailThreadLabel(threadId: string, labelId: string) {
    return this.delete<any>(`/api/v1/crm/email/threads/${threadId}/labels/${labelId}`)
  }

  // CRM Email — Quick Replies

  async getCRMEmailQuickReplies() {
    return this.get<{ quick_replies: any[] }>('/api/v1/crm/email/quick-replies')
  }

  async createCRMEmailQuickReply(data: { title: string; body_text: string; body_html?: string }) {
    return this.post<any>('/api/v1/crm/email/quick-replies', data)
  }

  async updateCRMEmailQuickReply(id: string, data: { title?: string; body_text?: string; body_html?: string }) {
    return this.put<any>(`/api/v1/crm/email/quick-replies/${id}`, data)
  }

  async deleteCRMEmailQuickReply(id: string) {
    return this.delete<any>(`/api/v1/crm/email/quick-replies/${id}`)
  }

  // CRM Email — Attachments

  async getCRMEmailAttachmentUploadUrl(data: { filename: string; content_type: string; size_bytes: number }) {
    return this.post<{ attachment: any; upload_url: string }>('/api/v1/crm/email/attachments/upload-url', data)
  }

  async getCRMEmailAttachmentDownloadUrl(attachmentId: string) {
    return this.get<{ download_url: string; filename: string }>(`/api/v1/crm/email/attachments/${attachmentId}/download`)
  }

  // CRM Email — Scheduled

  async getCRMEmailScheduled() {
    return this.get<{ messages: any[] }>('/api/v1/crm/email/scheduled')
  }

  async cancelCRMEmailScheduled(messageId: string) {
    return this.post<any>(`/api/v1/crm/email/messages/${messageId}/cancel-schedule`, {})
  }

  // CRM Email — AI

  async aiComposeCRMEmail(data: { context?: string; tone?: string; recipient_name?: string; topic?: string }) {
    return this.post<{ body_html: string }>('/api/v1/crm/email/ai/compose', data)
  }

  async aiSummarizeCRMEmailThread(threadId: string) {
    return this.post<{ summary: string }>('/api/v1/crm/email/ai/summarize', { thread_id: threadId })
  }

  async aiAnalyzeCRMEmailSentiment(threadId: string) {
    return this.post<{ sentiment: string; confidence: number }>('/api/v1/crm/email/ai/sentiment', { thread_id: threadId })
  }

  // CRM Email — Sequences (Rep)

  async getCRMEmailSequences() {
    return this.get<{ sequences: any[] }>('/api/v1/crm/email/sequences')
  }

  async enrollCRMEmailSequence(sequenceId: string, contactId: string) {
    return this.post<any>(`/api/v1/crm/email/sequences/${sequenceId}/enroll`, { contact_id: contactId })
  }

  async unenrollCRMEmailSequence(sequenceId: string, contactId: string) {
    return this.post<any>(`/api/v1/crm/email/sequences/${sequenceId}/unenroll`, { contact_id: contactId })
  }

  async getCRMEmailContactSequences(contactId: string) {
    return this.get<{ enrollments: any[] }>(`/api/v1/crm/email/contacts/${contactId}/sequences`)
  }

  // CRM Admin — Email Analytics

  async getCRMEmailAnalytics(days?: number) {
    const query = new URLSearchParams()
    if (days !== undefined) query.append('days', days.toString())
    const qs = query.toString()
    return this.get<any>(`/api/v1/admin/crm/email/analytics${qs ? `?${qs}` : ''}`)
  }

  // CRM Admin — Goals List

  async getCRMAdminGoals(params?: { rep_id?: string }) {
    const query = new URLSearchParams()
    if (params?.rep_id) query.append('rep_id', params.rep_id)
    const qs = query.toString()
    return this.get<{ goals: any[] }>(`/api/v1/admin/crm/goals${qs ? `?${qs}` : ''}`)
  }

  // CRM Admin — Rep Summary

  async getCRMRepSummary(repId: string) {
    return this.get<any>(`/api/v1/admin/crm/reps/${repId}/summary`)
  }

  // CRM Admin — Rep Email Drill-Down

  async getCRMRepEmailMessages(repId: string, params?: {
    direction?: string; days?: number; limit?: number; offset?: number;
  }) {
    const query = new URLSearchParams()
    if (params?.direction) query.append('direction', params.direction)
    if (params?.days !== undefined) query.append('days', params.days.toString())
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ messages: any[]; total: number }>(
      `/api/v1/admin/crm/email/reps/${repId}/messages${qs ? `?${qs}` : ''}`
    )
  }

  // CRM — Deal-Email Linking

  async linkCRMEmailThreadDeal(threadId: string, dealId: string | null) {
    return this.patch<any>(`/api/v1/crm/email/threads/${threadId}/deal`, { deal_id: dealId })
  }

  async getCRMDealEmailThreads(dealId: string) {
    return this.get<{ threads: any[] }>(`/api/v1/crm/email/deals/${dealId}/threads`)
  }

  // CRM — Email Account Avatar

  async updateCRMEmailAvatar(avatarUrl: string) {
    return this.put<any>('/api/v1/crm/email/account/avatar', { avatar_url: avatarUrl })
  }

  // CRM Admin — Email Sequences

  async getAdminCRMEmailSequences() {
    return this.get<{ sequences: any[] }>('/api/v1/admin/crm/email/sequences')
  }

  async createAdminCRMEmailSequence(data: { name: string; description?: string }) {
    return this.post<any>('/api/v1/admin/crm/email/sequences', data)
  }

  async getAdminCRMEmailSequence(id: string) {
    return this.get<{ sequence: any; steps: any[]; enrollments: any[] }>(`/api/v1/admin/crm/email/sequences/${id}`)
  }

  async updateAdminCRMEmailSequence(id: string, data: { name?: string; description?: string; is_active?: boolean }) {
    return this.put<any>(`/api/v1/admin/crm/email/sequences/${id}`, data)
  }

  async deleteAdminCRMEmailSequence(id: string) {
    return this.delete<any>(`/api/v1/admin/crm/email/sequences/${id}`)
  }

  async createAdminCRMEmailSequenceStep(sequenceId: string, data: {
    step_number: number; delay_days: number; template_id?: string;
    subject: string; body_html: string
  }) {
    return this.post<any>(`/api/v1/admin/crm/email/sequences/${sequenceId}/steps`, data)
  }

  async updateAdminCRMEmailSequenceStep(sequenceId: string, stepId: string, data: {
    delay_days?: number; template_id?: string; subject?: string; body_html?: string
  }) {
    return this.put<any>(`/api/v1/admin/crm/email/sequences/${sequenceId}/steps/${stepId}`, data)
  }

  async deleteAdminCRMEmailSequenceStep(sequenceId: string, stepId: string) {
    return this.delete<any>(`/api/v1/admin/crm/email/sequences/${sequenceId}/steps/${stepId}`)
  }

  async getCRMDNCList(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ contacts: any[]; total: number }>(
      `/api/v1/admin/crm/dnc-list${qs ? `?${qs}` : ''}`
    )
  }

  async getCRMRepDNCList(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.limit !== undefined) query.append('limit', params.limit.toString())
    if (params?.offset !== undefined) query.append('offset', params.offset.toString())
    const qs = query.toString()
    return this.get<{ contacts: any[]; total: number }>(
      `/api/v1/crm/dnc-list${qs ? `?${qs}` : ''}`
    )
  }

  // ==========================================================================
  // CRM Email Notification Settings
  // ==========================================================================

  async getCRMEmailNotificationSettings() {
    return this.get<{ settings: any }>('/api/v1/crm/email/account/notifications')
  }

  async updateCRMEmailNotificationSettings(data: {
    account_id: string;
    notification_email?: string;
    notification_mode?: string;
    notification_digest_interval?: string;
  }) {
    return this.put<{ status: string }>('/api/v1/crm/email/account/notifications', data)
  }

  // ==========================================================================
  // CRM Email Avatar Upload
  // ==========================================================================

  async uploadCRMEmailAvatar(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const token = await this.getToken()
    const baseUrl = this.getBaseUrl()
    const res = await fetch(`${baseUrl}/api/v1/crm/email/account/avatar/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error('Failed to upload avatar')
    return res.json() as Promise<{ success: boolean; avatar_url: string }>
  }

  // ==========================================================================
  // CRM Business Cards
  // ==========================================================================

  async getCRMBusinessCard() {
    return this.get<{ card: any }>('/api/v1/crm/business-card')
  }

  async createOrUpdateCRMBusinessCard(data: any) {
    return this.post<{ card: any }>('/api/v1/crm/business-card', data)
  }

  async uploadCRMBusinessCardLogo(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const token = await this.getToken()
    const baseUrl = this.getBaseUrl()
    const res = await fetch(`${baseUrl}/api/v1/crm/business-card/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error('Failed to upload logo')
    return res.json() as Promise<{ success: boolean; logo_url: string }>
  }

  async submitCRMBusinessCard() {
    return this.put<{ status: string }>('/api/v1/crm/business-card/submit', {})
  }

  async getCRMBusinessCards(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    if (params?.search) query.append('search', params.search)
    const qs = query.toString()
    return this.get<{ cards: any[] }>(`/api/v1/crm/business-cards${qs ? `?${qs}` : ''}`)
  }

  async getCRMBusinessCardById(id: string) {
    return this.get<{ card: any }>(`/api/v1/crm/business-cards/${id}`)
  }

  async updateCRMBusinessCardStatus(id: string, data: { status: string; admin_notes?: string }) {
    return this.put<{ status: string }>(`/api/v1/crm/business-cards/${id}/status`, data)
  }

  async exportCRMBusinessCards() {
    return this.get<{ cards: any[] }>('/api/v1/crm/business-cards/export')
  }

  // ==========================================================================
  // CRM Training Resources
  // ==========================================================================

  async getCRMTrainingResources(params?: { type?: string; category?: string; search?: string }) {
    const query = new URLSearchParams()
    if (params?.type) query.append('type', params.type)
    if (params?.category) query.append('category', params.category)
    if (params?.search) query.append('search', params.search)
    const qs = query.toString()
    return this.get<{ resources: any[] }>(`/api/v1/crm/training/resources${qs ? `?${qs}` : ''}`)
  }

  async getCRMTrainingResource(id: string) {
    return this.get<{ resource: any }>(`/api/v1/crm/training/resources/${id}`)
  }

  async createCRMTrainingResource(data: any) {
    return this.post<{ resource: any }>('/api/v1/crm/training/resources', data)
  }

  async updateCRMTrainingResource(id: string, data: any) {
    return this.put<{ status: string }>(`/api/v1/crm/training/resources/${id}`, data)
  }

  async deleteCRMTrainingResource(id: string) {
    return this.delete<any>(`/api/v1/crm/training/resources/${id}`)
  }

  async uploadCRMTrainingFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const token = await this.getToken()
    const baseUrl = this.getBaseUrl()
    const res = await fetch(`${baseUrl}/api/v1/crm/training/resources/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error('Failed to upload file')
    return res.json() as Promise<{ success: boolean; url: string; file_size_bytes: number; filename: string }>
  }

  // ==========================================================================
  // CRM Discussion Board
  // ==========================================================================

  async getCRMDiscussionCategories() {
    return this.get<{ categories: any[] }>('/api/v1/crm/discussions/categories')
  }

  async createCRMDiscussionCategory(data: { name: string; description?: string }) {
    return this.post<{ category: any }>('/api/v1/crm/discussions/categories', data)
  }

  async updateCRMDiscussionCategory(id: string, data: { name?: string; description?: string }) {
    return this.put<{ status: string }>(`/api/v1/crm/discussions/categories/${id}`, data)
  }

  async deleteCRMDiscussionCategory(id: string) {
    return this.delete<any>(`/api/v1/crm/discussions/categories/${id}`)
  }

  async getCRMDiscussionThreads(params?: { category_slug?: string; search?: string; sort?: string }) {
    const query = new URLSearchParams()
    if (params?.category_slug) query.append('category_slug', params.category_slug)
    if (params?.search) query.append('search', params.search)
    if (params?.sort) query.append('sort', params.sort)
    const qs = query.toString()
    return this.get<{ threads: any[] }>(`/api/v1/crm/discussions/threads${qs ? `?${qs}` : ''}`)
  }

  async getCRMDiscussionThread(id: string) {
    return this.get<{ thread: any }>(`/api/v1/crm/discussions/threads/${id}`)
  }

  async createCRMDiscussionThread(data: { category_id: string; title: string; content: string; resource_id?: string }) {
    return this.post<{ thread: any }>('/api/v1/crm/discussions/threads', data)
  }

  async updateCRMDiscussionThread(id: string, data: { title?: string; content?: string }) {
    return this.put<{ status: string }>(`/api/v1/crm/discussions/threads/${id}`, data)
  }

  async deleteCRMDiscussionThread(id: string) {
    return this.delete<any>(`/api/v1/crm/discussions/threads/${id}`)
  }

  async pinCRMDiscussionThread(id: string, is_pinned: boolean) {
    return this.post<{ status: string }>(`/api/v1/crm/discussions/threads/${id}/pin`, { is_pinned })
  }

  async getCRMDiscussionReplies(threadId: string) {
    return this.get<{ replies: any[] }>(`/api/v1/crm/discussions/threads/${threadId}/replies`)
  }

  async createCRMDiscussionReply(data: { thread_id: string; content: string }) {
    return this.post<{ reply: any }>('/api/v1/crm/discussions/replies', data)
  }

  async updateCRMDiscussionReply(id: string, data: { content: string }) {
    return this.put<{ status: string }>(`/api/v1/crm/discussions/replies/${id}`, data)
  }

  async deleteCRMDiscussionReply(id: string) {
    return this.delete<any>(`/api/v1/crm/discussions/replies/${id}`)
  }

  async getTeamDirectory() {
    return this.get<any[]>('/api/v1/crm/team-directory')
  }

  // CRM Data Scraping
  async getCRMScrapeSources() {
    return this.get<{ sources: any[] }>('/api/v1/crm/scraping/sources')
  }

  async createCRMScrapeSource(data: any) {
    return this.post<{ source: any }>('/api/v1/crm/scraping/sources', data)
  }

  async updateCRMScrapeSource(id: string, data: any) {
    return this.put<{ source: any }>(`/api/v1/crm/scraping/sources/${id}`, data)
  }

  async deleteCRMScrapeSource(id: string) {
    return this.delete<any>(`/api/v1/crm/scraping/sources/${id}`)
  }

  async getCRMScrapeJobs(params?: { source_id?: string; status?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.source_id) searchParams.set('source_id', params.source_id)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const qs = searchParams.toString()
    return this.get<{ jobs: any[] }>(`/api/v1/crm/scraping/jobs${qs ? `?${qs}` : ''}`)
  }

  async createCRMScrapeJob(data: { source_id: string; filters?: any }) {
    return this.post<{ job: any }>('/api/v1/crm/scraping/jobs', data)
  }

  async getCRMScrapeJob(id: string) {
    return this.get<{ job: any }>(`/api/v1/crm/scraping/jobs/${id}`)
  }

  async getCRMScrapedLeads(params?: {
    job_id?: string; status?: string; min_score?: number; max_score?: number;
    country?: string; has_email?: boolean; has_phone?: boolean; has_website?: boolean; search?: string;
    sort_by?: string; sort_order?: string; limit?: number; offset?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') searchParams.set(k, String(v))
      })
    }
    const qs = searchParams.toString()
    return this.get<{ leads: any[]; total: number }>(`/api/v1/crm/scraping/leads${qs ? `?${qs}` : ''}`)
  }

  async bulkApproveCRMLeads(data: { lead_ids: string[]; tags?: string[]; enroll_sequence_id?: string }) {
    return this.post<{ approved: number; contact_ids: string[] }>('/api/v1/crm/scraping/leads/approve', data)
  }

  async bulkRejectCRMLeads(data: { lead_ids: string[] }) {
    return this.post<{ rejected: number }>('/api/v1/crm/scraping/leads/reject', data)
  }

  async mergeCRMScrapedLead(id: string, data: { contact_id: string }) {
    return this.post<{ status: string; contact_id: string }>(`/api/v1/crm/scraping/leads/${id}/merge`, data)
  }

  async rescrapeCRMLeads(data: { scrape_profile_id: string; lead_ids?: string[]; filters?: Record<string, any>; thoroughness?: string; profile_overrides?: Record<string, any> }) {
    return this.post<{ job: any; leads_count: number; ecs_task_arn: string | null; lead_list_id: string | null }>('/api/v1/crm/scraping/leads/rescrape', data)
  }

  async retryScrapeJob(jobId: string) {
    return this.post<{ job: any; sites_remaining: number | null; ecs_task_arn: string | null }>(`/api/v1/crm/scraping/jobs/${jobId}/retry`, {})
  }

  async cancelScrapeJob(jobId: string) {
    return this.post<{ job: any }>(`/api/v1/crm/scraping/jobs/${jobId}/cancel`, {})
  }

  async exportScrapedLeads(params?: { job_id?: string; status?: string; min_score?: number }): Promise<Blob> {
    const searchParams = new URLSearchParams()
    if (params?.job_id) searchParams.set('job_id', params.job_id)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.min_score !== undefined) searchParams.set('min_score', String(params.min_score))
    const qs = searchParams.toString()
    const token = this.getToken()
    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}/api/v1/crm/scraping/leads/export${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Export failed')
    return response.blob()
  }

  async bulkImportContacts(file: File, params?: { tags?: string; source?: string; source_detail?: string; temperature?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.tags) searchParams.set('tags', params.tags)
    if (params?.source) searchParams.set('source', params.source)
    if (params?.source_detail) searchParams.set('source_detail', params.source_detail)
    if (params?.temperature) searchParams.set('temperature', params.temperature)
    const qs = searchParams.toString()
    const formData = new FormData()
    formData.append('file', file)
    const token = this.getToken()
    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}/api/v1/crm/contacts/bulk-import${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Import failed' }))
      throw new Error(err.detail || 'Import failed')
    }
    return response.json() as Promise<{ created: number; skipped: number; errors: string[]; total_rows: number }>
  }

  // CRM Lead Lists
  async getCRMLeadLists() {
    return this.get<{ lists: any[] }>('/api/v1/crm/scraping/lead-lists')
  }

  async getCRMLeadList(id: string) {
    return this.get<{ list: any }>(`/api/v1/crm/scraping/lead-lists/${id}`)
  }

  async createCRMLeadList(data: { name: string; description?: string; lead_ids?: string[] }) {
    return this.post<{ list: any }>('/api/v1/crm/scraping/lead-lists', data)
  }

  async updateCRMLeadList(id: string, data: { name?: string; description?: string; status?: string }) {
    return this.put<{ list: any }>(`/api/v1/crm/scraping/lead-lists/${id}`, data)
  }

  async deleteCRMLeadList(id: string) {
    return this.delete<any>(`/api/v1/crm/scraping/lead-lists/${id}`)
  }

  async getCRMLeadListLeads(id: string, params?: { limit?: number; offset?: number }) {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    const qs = sp.toString()
    return this.get<{ leads: any[]; total: number }>(`/api/v1/crm/scraping/lead-lists/${id}/leads${qs ? `?${qs}` : ''}`)
  }

  async addLeadsToCRMList(id: string, data: { lead_ids: string[] }, allPending?: boolean) {
    const url = allPending
      ? `/api/v1/crm/scraping/lead-lists/${id}/leads?all_pending=true`
      : `/api/v1/crm/scraping/lead-lists/${id}/leads`;
    return this.post<{ added: number }>(url, data)
  }

  async removeLeadsFromCRMList(id: string, leadIds: string[]) {
    const sp = new URLSearchParams()
    leadIds.forEach(lid => sp.append('lead_ids', lid))
    return this.delete<{ removed: number }>(`/api/v1/crm/scraping/lead-lists/${id}/leads?${sp.toString()}`)
  }

  async exportCRMLeadList(id: string): Promise<Blob> {
    const token = this.getToken()
    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}/api/v1/crm/scraping/lead-lists/${id}/export`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Export failed')
    return response.blob()
  }

  async importToCRMLeadList(id: string, file: File, tags?: string): Promise<{ created: number; skipped: number; errors: string[]; total_rows: number }> {
    const sp = new URLSearchParams()
    if (tags) sp.set('tags', tags)
    const qs = sp.toString()
    const formData = new FormData()
    formData.append('file', file)
    const token = this.getToken()
    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}/api/v1/crm/scraping/lead-lists/${id}/import${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Import failed' }))
      throw new Error(err.detail || 'Import failed')
    }
    return response.json()
  }

  // CRM Scrape Profiles
  async getCRMScrapeProfiles() {
    return this.get<{ profiles: any[] }>('/api/v1/crm/scraping/profiles')
  }

  async createCRMScrapeProfile(data: any) {
    return this.post<{ profile: any }>('/api/v1/crm/scraping/profiles', data)
  }

  async updateCRMScrapeProfile(id: string, data: any) {
    return this.patch<{ profile: any }>(`/api/v1/crm/scraping/profiles/${id}`, data)
  }

  async deleteCRMScrapeProfile(id: string) {
    return this.delete<any>(`/api/v1/crm/scraping/profiles/${id}`)
  }

  // CRM Discovery Profiles
  async getCRMDiscoveryProfiles() {
    return this.get<{ profiles: any[] }>('/api/v1/crm/scraping/discovery-profiles')
  }

  async createCRMDiscoveryProfile(data: any) {
    return this.post<{ profile: any }>('/api/v1/crm/scraping/discovery-profiles', data)
  }

  async updateCRMDiscoveryProfile(id: string, data: any) {
    return this.patch<{ profile: any }>(`/api/v1/crm/scraping/discovery-profiles/${id}`, data)
  }

  async deleteCRMDiscoveryProfile(id: string) {
    return this.delete<any>(`/api/v1/crm/scraping/discovery-profiles/${id}`)
  }

  // CRM Discovery Runs & Sites
  async getCRMDiscoveryRuns(params?: { profile_id?: string; status?: string; limit?: number; offset?: number }) {
    const sp = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
      })
    }
    const qs = sp.toString()
    return this.get<{ runs: any[] }>(`/api/v1/crm/scraping/discovery-runs${qs ? `?${qs}` : ''}`)
  }

  async createCRMDiscoveryRun(profileId: string) {
    return this.post<{ run: any }>(`/api/v1/crm/scraping/discovery-runs?profile_id=${profileId}`, {})
  }

  async getCRMDiscoveryRun(id: string) {
    return this.get<{ run: any }>(`/api/v1/crm/scraping/discovery-runs/${id}`)
  }

  async getCRMDiscoveryRunSites(runId: string, params?: {
    min_score?: number; source_type?: string; is_selected?: boolean;
    search?: string; limit?: number; offset?: number
  }) {
    const sp = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
      })
    }
    const qs = sp.toString()
    return this.get<{ sites: any[]; total: number }>(`/api/v1/crm/scraping/discovery-runs/${runId}/sites${qs ? `?${qs}` : ''}`)
  }

  async startDiscoveryScraping(runId: string, data: { scrape_profile_id: string; site_ids?: string[]; min_score?: number }) {
    return this.post<{ job: any; sites_selected: number }>(`/api/v1/crm/scraping/discovery-runs/${runId}/start-scraping`, data)
  }

  // CRM Scraping Settings
  async getScrapingSettings() {
    return this.get<{ settings: any[] }>('/api/v1/crm/scraping/settings')
  }

  async updateScrapingSettings(settings: Record<string, string>) {
    return this.put<{ updated: string[] }>('/api/v1/crm/scraping/settings', settings)
  }

  // CRM Pricing / Quotes
  async getPricingTiers() {
    return this.get<{ tiers: any; addon_prices: any }>('/api/v1/crm/pricing/tiers')
  }

  async computeQuotePrice(data: any) {
    return this.post<any>('/api/v1/crm/pricing/compute', data)
  }

  async createPricingQuote(data: any) {
    return this.post<{ quote: any }>('/api/v1/crm/pricing/quotes', data)
  }

  async getPricingQuotes(params?: { status?: string; linked_contact_id?: string; search?: string; limit?: number; offset?: number }) {
    const sp = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
      })
    }
    const qs = sp.toString()
    return this.get<{ quotes: any[] }>(`/api/v1/crm/pricing/quotes${qs ? `?${qs}` : ''}`)
  }

  async getPricingQuote(id: string) {
    return this.get<{ quote: any; versions: any[] }>(`/api/v1/crm/pricing/quotes/${id}`)
  }

  async updatePricingQuoteStatus(id: string, status: string) {
    return this.patch<{ quote: any }>(`/api/v1/crm/pricing/quotes/${id}`, { status })
  }

  async updatePricingQuote(id: string, data: any) {
    return this.put<{ quote: any }>(`/api/v1/crm/pricing/quotes/${id}`, data)
  }

  async getPricingQuoteText(id: string) {
    return this.get<{ text: string }>(`/api/v1/crm/pricing/quotes/${id}/text`)
  }

  // Backlot Free Trial
  async getSalesRepsPublic() {
    return this.get<{ reps: { id: string; full_name: string }[] }>('/api/v1/crm/backlot-trials/reps')
  }

  async submitBacklotTrial(data: { first_name: string; last_name: string; email: string; phone: string; consent_contact: boolean; referred_by_rep_id?: string }) {
    return this.post<{ success: boolean; message: string }>('/api/v1/crm/backlot-trials', data)
  }

  async getBacklotTrialRequests(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.search) query.set('search', params.search)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const qs = query.toString()
    return this.get<{ trials: any[]; total: number; limit: number; offset: number }>(`/api/v1/crm/backlot-trials/admin${qs ? '?' + qs : ''}`)
  }

  async approveBacklotTrial(id: string) {
    return this.post<{ success: boolean; contact: any }>(`/api/v1/crm/backlot-trials/${id}/approve`)
  }

  async rejectBacklotTrial(id: string, notes?: string) {
    return this.post<{ success: boolean }>(`/api/v1/crm/backlot-trials/${id}/reject`, notes ? { notes } : undefined)
  }

  async bulkApproveBacklotTrials(ids: string[]) {
    return this.post<{ success: boolean; approved: number }>('/api/v1/crm/backlot-trials/bulk-approve', { ids })
  }
}

// Export singleton instance
export const api = new APIClient()
export const apiClient = api // Alias for hooks that use apiClient
export { safeStorage } // Export for use in AuthContext
export default api
