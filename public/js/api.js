// API Client for FG TEN Platform
const API = {
  getToken() {
    return localStorage.getItem('fg_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('fg_token', token);
    } else {
      localStorage.removeItem('fg_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      // Handle 401 Unauthorized
      if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/portal/')) {
        this.setToken(null);
        if (typeof App !== 'undefined' && App.onUnauthorized) {
          App.onUnauthorized();
        }
        throw new Error('Sesi telah berakhir. Silakan login kembali.');
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada request.');
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  },

  async checkAuth() {
    try {
      return await this.request('/api/auth/me');
    } catch (e) {
      return null;
    }
  },

  // Stats
  async getStats() {
    return await this.request('/api/stats');
  },

  // Projects
  async getProjects(filter = 'all', query = '') {
    const params = new URLSearchParams();
    if (filter && filter !== 'all') params.append('status', filter);
    if (query) params.append('q', query);
    return await this.request(`/api/projects?${params.toString()}`);
  },

  async getProject(id) {
    return await this.request(`/api/projects/${id}`);
  },

  async createProject(data) {
    return await this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProject(id, data) {
    return await this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProject(id) {
    return await this.request(`/api/projects/${id}`, {
      method: 'DELETE'
    });
  },

  // Clients
  async getClients() {
    return await this.request('/api/clients');
  },

  async getClient(id) {
    return await this.request(`/api/clients/${id}`);
  },

  async createClient(data) {
    return await this.request('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateClient(id, data) {
    return await this.request(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteClient(id) {
    return await this.request(`/api/clients/${id}`, {
      method: 'DELETE'
    });
  },

  // Packages
  async getPackages() {
    return await this.request('/api/packages');
  },

  async createPackage(data) {
    return await this.request('/api/packages', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updatePackage(id, data) {
    return await this.request(`/api/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deletePackage(id) {
    return await this.request(`/api/packages/${id}`, {
      method: 'DELETE'
    });
  },

  // Settings
  async getSettings() {
    return await this.request('/api/settings');
  },

  async updateSettings(data) {
    return await this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Public Portal
  async getPortalProject(id) {
    return await this.request(`/api/portal/${id}`);
  },

  async submitPortalSelection(id, selectedPhotos) {
    return await this.request(`/api/portal/${id}`, {
      method: 'POST',
      body: JSON.stringify({ selectedPhotos })
    });
  }
};
