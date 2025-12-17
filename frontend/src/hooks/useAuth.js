import { useState, useEffect } from "react";
import { storage } from "../utils/storage";
import { getFullURL } from "../utils/config";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get user from localStorage on mount
  useEffect(() => {
    const savedUser = storage.getUser();
    if (savedUser) {
      setUser(savedUser);
      setIsLoggedIn(true);
    }
  }, []);

  // Fetch user profile from backend
  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      console.log("🔍 Fetching user profile...");
      
      // ✅ Build headers with token if available
      const headers = {
        "Content-Type": "application/json",
      };
      
      const token = storage.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      // ✅ Use dynamic API URL instead of hardcoded localhost
      const response = await fetch(getFullURL("/api/auth/profile"), {
        method: "GET",
        headers,
        credentials: "include", // ✅ Send cookies if available
      });

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      console.log("✅ Profile fetched:", data);

      if (data.success && data.user) {
        storage.setUser(data.user);
        setUser(data.user);
        setIsLoggedIn(true);
        return data.user;
      }
    } catch (error) {
      console.error("❌ Error fetching profile:", error.message);
      storage.clearUser();
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    storage.clearUser(); // ✅ This now clears both user and token (updated in storage.js)
    setUser(null);
    setIsLoggedIn(false);
  };

  return {
    user,
    isLoggedIn,
    loading,
    fetchUserProfile,
    logout,
  };
};