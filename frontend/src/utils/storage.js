export const storage = {
  // Save user data
  setUser: (userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    console.log("💾 User saved to localStorage:", userData);
  },

  // Get user data
  getUser: () => {
    try {
      const user = localStorage.getItem("user");
      
      // ✅ FIX: Check if user exists BEFORE parsing
      if (user && user !== "undefined" && user !== "null") {
        return JSON.parse(user);
      }
      return null;
    } catch (error) {
      console.error("❌ Error parsing user data:", error);
      localStorage.removeItem("user");
      return null;
    }
  },

  // Check if user exists
  isLoggedIn: () => {
    try {
      const user = localStorage.getItem("user");
      return user && user !== "undefined" && user !== "null";
    } catch (error) {
      return false;
    }
  },

  // Clear user data (logout)
  clearUser: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token"); // ✅ Also clear token
    console.log("🗑️ User and token cleared from localStorage");
  },

  // ✅ TOKEN MANAGEMENT - For cross-origin authentication fallback
  
  // Save authentication token
  setToken: (token) => {
    if (token) {
      localStorage.setItem("token", token);
      console.log("🔐 Token saved to localStorage");
    }
  },

  // Get authentication token
  getToken: () => {
    try {
      const token = localStorage.getItem("token");
      if (token && token !== "undefined" && token !== "null") {
        return token;
      }
      return null;
    } catch (error) {
      console.error("❌ Error getting token:", error);
      return null;
    }
  },

  // Clear authentication token
  clearToken: () => {
    localStorage.removeItem("token");
    console.log("🗑️ Token cleared from localStorage");
  },
};