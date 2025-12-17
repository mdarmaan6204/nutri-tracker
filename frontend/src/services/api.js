import axios from 'axios';
import { getAPIUrl } from '../utils/config';
import { storage } from '../utils/storage';

const API_BASE_URL = `${getAPIUrl()}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ Enable sending cookies with cross-origin requests
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = storage.getToken(); // ✅ Use storage utility instead of direct localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== AUTH ENDPOINTS ====================
export const authAPI = {
  register: (name, email, password) =>
    api.post('/auth/register', { name, email, password }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  logout: () =>
    api.post('/auth/logout'),
  refreshToken: () =>
    api.post('/auth/refresh'),
};

// ==================== MEALS ENDPOINTS ====================
export const mealsAPI = {
  // Add a new meal
  addMeal: (mealData) =>
    api.post('/meals', mealData),
  
  // Get all meals for user
  getAllMeals: () =>
    api.get('/meals'),
  
  // Get meals for a specific date
  getMealsByDate: (date) =>
    api.get(`/meals?date=${date}`),
  
  // Get meals for date range
  getMealsByDateRange: (startDate, endDate) =>
    api.get(`/meals?startDate=${startDate}&endDate=${endDate}`),
  
  // Get single meal
  getMeal: (id) =>
    api.get(`/meals/${id}`),
  
  // Update meal
  updateMeal: (id, mealData) =>
    api.put(`/meals/${id}`, mealData),
  
  // Delete meal
  deleteMeal: (id) =>
    api.delete(`/meals/${id}`),
};

// ==================== PREDICTION ENDPOINT ====================
export const predictionAPI = {
  // Upload image and get food prediction
  predictFood: (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return api.post('/predict', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// ==================== ANALYTICS ENDPOINTS ====================
export const analyticsAPI = {
  // Get today's summary
  getTodayAnalytics: () =>
    api.get('/analytics/today'),
  
  // Get weekly analytics
  getWeeklyAnalytics: () =>
    api.get('/analytics/week'),
  
  // Get monthly analytics
  getMonthlyAnalytics: () =>
    api.get('/analytics/month'),
  
  // Get custom date range analytics
  getAnalyticsByRange: (startDate, endDate) =>
    api.get(`/analytics?startDate=${startDate}&endDate=${endDate}`),
  
  // Get user goals
  getGoals: () =>
    api.get('/analytics/goals'),
  
  // Update user goals
  updateGoals: (goals) =>
    api.put('/analytics/goals', goals),
};

// ==================== SETTINGS ENDPOINTS ====================
export const settingsAPI = {
  // Get user settings
  getSettings: () =>
    api.get('/settings'),
  
  // Update settings
  updateSettings: (settings) =>
    api.put('/settings', settings),
  
  // Change password
  changePassword: (oldPassword, newPassword) =>
    api.post('/settings/change-password', { oldPassword, newPassword }),
};

export default api;
