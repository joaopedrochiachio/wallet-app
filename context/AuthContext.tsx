"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  setPersistence,
  sendPasswordResetEmail,
  deleteUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { deleteUserDataFromFirestore } from "@/lib/services/userService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<User>;
  signUp: (email: string, pass: string) => Promise<User>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isStandaloneOrMobile(): boolean {
  if (typeof window === "undefined") return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isStandalone || isMobile;
}

async function configureBestPersistence() {
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Usa persistência padrão da sessão
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Trata resultado de redirecionamento do Google OAuth (PWA standalone e mobile)
    getRedirectResult(auth)
      .then((cred) => {
        if (cred?.user) {
          setUser(cred.user);
        }
      })
      .catch((err) => {
        console.warn("[Auth] Redirect result listener:", err);
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    await configureBestPersistence();
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  };

  const signUp = async (email: string, pass: string) => {
    await configureBestPersistence();
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return cred.user;
  };

  const signInWithGoogle = async (): Promise<User | null> => {
    await configureBestPersistence();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // No modo PWA standalone ou em dispositivos móveis, popups são desconectados da janela pai
    // signInWithRedirect é o padrão exigido pelo Safari/Chrome para PWAs instalados
    if (isStandaloneOrMobile()) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    try {
      const cred = await signInWithPopup(auth, provider);
      return cred.user;
    } catch (popupError: unknown) {
      const code =
        typeof popupError === "object" && popupError && "code" in popupError
          ? String(popupError.code)
          : "";
      // Se popup foi bloqueado pelo navegador, tenta via redirecionamento seguro
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw popupError;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) {
      throw new Error("Nenhum usuário conectado para exclusão.");
    }
    const currentUid = auth.currentUser.uid;
    await deleteUserDataFromFirestore(currentUid);
    await deleteUser(auth.currentUser);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
