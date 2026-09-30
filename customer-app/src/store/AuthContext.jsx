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
  }, []);

  const restoreSession = useCallback(async () => {
    setReady(false);
    setRestoreError("");
    try {
      const token = await getToken();
      if (token) setUser(await authService.getMe());
      else setUser(null);
    } catch (error) {
      if (error?.response?.status === 401) {
        disconnectSocket();
        setUser(null);
      } else {
        setRestoreError(error?.response?.data?.message || "Unable to restore your session.");
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
