import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authService from "../services/authService";
import { connectSocket, disconnectSocket } from "../services/socketService";
import { setAuthenticationExpiredHandler } from "../services/api";
import { getToken, removeToken, saveToken } from "../utils/authStorage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const clearSession = useCallback(async () => {
    await removeToken();
    disconnectSocket();
    setUser(null);
    setRestoreError("");
  }, []);

  const restoreSession = useCallback(async () => {
    setReady(false);
    setRestoreError("");
    try {
      const token = await getToken();
      if (!token || typeof token !== "string" || !token.trim() || token === "null" || token === "undefined") {
        await removeToken();
        disconnectSocket();
        setUser(null);
        setRestoreError("");
        return;
      }

      const currentUser = await authService.getMe();
      setUser(currentUser);
      setRestoreError("");
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // Authenticated token is invalid or expired: clear session and show login screen
        await removeToken();
        disconnectSocket();
        setUser(null);
        setRestoreError("");
      } else {
        // Network timeout, offline, or Render cold start: preserve token and show retryable notice
        const isTimeout = error?.code === "ECONNABORTED" || error?.message?.toLowerCase().includes("timeout");
        const isNetwork = !error?.response || error?.code === "ERR_NETWORK";
        let message = error?.response?.data?.message;
        if (!message) {
          if (isTimeout) {
            message = "LoadBalbin server is waking up. Please tap Try Again.";
          } else if (isNetwork) {
            message = "Unable to connect to server. Please check your internet connection and tap Try Again.";
          } else {
            message = "Service is temporarily busy. Please tap Try Again.";
          }
        }
        setRestoreError(message);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    setAuthenticationExpiredHandler(() => {
      disconnectSocket();
      setUser(null);
      setReady(true);
    });
    restoreSession();
    return () => setAuthenticationExpiredHandler(undefined);
  }, [restoreSession]);

  useEffect(() => {
    let cancelled = false;
    if (user?._id || user?.id) {
      getToken().then((token) => {
        if (!cancelled && token) connectSocket(token);
      });
    } else {
      disconnectSocket();
    }
    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, [user]);

  const establishSession = useCallback(async (authResponse) => {
    if (!authResponse?.token) throw new Error("The authentication response did not include a token.");
    await saveToken(authResponse.token);
    const currentUser = await authService.getMe();
    setUser(currentUser);
    setRestoreError("");
    return currentUser;
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    restoreError,
    retryRestore: restoreSession,
    establishSession,
    signOut: clearSession
  }), [user, ready, restoreError, restoreSession, establishSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
};
