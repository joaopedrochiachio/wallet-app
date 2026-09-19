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
  authError: string | null;
  clearAuthError: () => void;
  signIn: (email: string, pass: string) => Promise<User>;
  signUp: (email: string, pass: string) => Promise<User>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  );
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
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    // Garante persistência IndexedDB configurada logo no boot
    configureBestPersistence().finally(() => {
      // Trata resultado de redirecionamento OAuth exclusivamente aqui
      getRedirectResult(auth)
        .then((cred) => {
          if (!isMounted) return;
          if (cred?.user) {
            setUser(cred.user);
          }
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          console.error("[Auth] Redirect result listener error:", err);
          const code =
            typeof err === "object" && err && "code" in err ? String(err.code) : "";
          if (code === "auth/unauthorized-domain") {
            setAuthError(
              "Domínio não autorizado no Firebase. Adicione o link da Vercel em 'Domínios Autorizados' no Firebase Console."
            );
          } else if (code === "auth/missing-or-invalid-nonce") {
            setAuthError("A sessão de autenticação expirou. Por favor, tente novamente.");
          } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
            setAuthError("Não foi possível concluir a autenticação com o Google. Tente novamente.");
          }
        })
        .finally(() => {
          if (!isMounted) return;
          // Libera loading apenas depois de processar o resultado do redirect
          unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            setLoading(false);
          });
        });
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
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
    setAuthError(null);
    await configureBestPersistence();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // Em modo PWA standalone (app instalado na tela inicial)
    if (isStandalone()) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    // Em navegadores comuns (Desktop e Mobile Web), tentamos popup primeiro
    try {
      const cred = await signInWithPopup(auth, provider);
      return cred.user;
    } catch (popupError: unknown) {
      const code =
        typeof popupError === "object" && popupError && "code" in popupError
          ? String(popupError.code)
          : "";
      // Se popup foi bloqueado pelo navegador mobile, faz fallback para redirect
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
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
        authError,
        clearAuthError,
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
