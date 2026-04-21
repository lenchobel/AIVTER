const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  async getBookings() {
    return this.request('/bookings');
  }

  async getLatestBooking() {
    return this.request('/latest-booking');
  }

  async getBookingById(id) {
    return this.request(`/bookings/${id}`);
  }

  async getHealth() {
    return this.request('/health');
  }

  async getFlows(limit = 50, offset = 0) {
    return this.request(`/debug/flows?limit=${limit}&offset=${offset}`);
  }

  async getLatestFlows(count = 20) {
    return this.request(`/debug/stream?count=${count}`);
  }

  async getFlowByCallId(callId) {
    return this.request(`/debug/flow/${callId}`);
  }

  async getFlowStats() {
    return this.request('/debug/stats');
  }
}

export const apiService = new ApiService();
