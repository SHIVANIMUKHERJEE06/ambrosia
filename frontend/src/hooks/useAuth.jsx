import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api, setToken, clearToken, isLoggedIn } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  const refreshProfile = useCallback(async () => {
    if (!isLoggedIn()) {
      setProfile(null);
      return;
    }
    try {
      const { profile } = await api.getProfile();
      setProfile(profile);
    } catch {
      // token may be invalid/expired
      clearToken();
      setLoggedIn(false);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setUser(data.user);
    setLoggedIn(true);
    await refreshProfile();
    return data;
  }, [refreshProfile]);

  const signup = useCallback(async (email, password) => {
    const data = await api.signup(email, password);
    setToken(data.token);
    setUser(data.user);
    setLoggedIn(true);
    await refreshProfile();
    return data;
  }, [refreshProfile]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setProfile(null);
    setLoggedIn(false);
  }, []);

  const saveProfile = useCallback(async (profileData) => {
    const { profile } = await api.saveProfile(profileData);
    setProfile(profile);
    return profile;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, loggedIn, login, signup, logout, saveProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
