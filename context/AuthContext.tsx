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
  getAdditionalUserInfo,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  setPersistence,
  sendPasswordResetEmail,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { clearUserLocalCaches } from "@/lib/services/aiChatService";
import { markUserOnboardedLocal } from "@/lib/services/userService";

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
  deleteAccount: (password?: string) => Promise<void>;
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

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
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

    // Aguarda a restauração nativa da sessão pelo IndexedDB antes de liberar `loading = false`
    const readyPromise =
      typeof auth.authStateReady === "function"
        ? auth.authStateReady().catch(() => undefined)
        : Promise.resolve();

    // Trata resultado de redirecionamento OAuth sem bloquear a restauração da sessão
    getRedirectResult(auth)
      .then((cred) => {
        if (!isMounted || !cred?.user) return;
        const additionalInfo = getAdditionalUserInfo(cred);
        if (additionalInfo?.isNewUser === false) {
          markUserOnboardedLocal(cred.user.uid);
        }
        setUser(cred.user);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.error("[Auth] Redirect result listener error:", err);
        const code =
          typeof err === "object" && err && "code" in err ? String(err.code) : "";
        if (code === "auth/unauthorized-domain") {
          const currentHost = typeof window !== "undefined" ? window.location.hostname : "seu-dominio.vercel.app";
          setAuthError(
            `O domínio '${currentHost}' não está autorizado no Firebase. Adicione-o no Firebase Console em Authentication > Configurações > Domínios Autorizados.`
          );
        } else if (code === "auth/missing-or-invalid-nonce") {
          setAuthError("A sessão de autenticação expirou. Por favor, tente novamente.");
        }
      });

    readyPromise.finally(() => {
      if (!isMounted) return;
      if (auth.currentUser) {
        setUser(auth.currentUser);
      }
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (!isMounted) return;
        setUser(currentUser);
        setLoading(false);
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
    if (cred.user) {
      markUserOnboardedLocal(cred.user.uid);
    }
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

    // Priorizamos signInWithPopup em todos os ambientes (inclusive PWA e Mobile)
    // porque o popup troca o token via postMessage em memória, evitando perdas de cookies
    // entre o domínio da Vercel e o domínio do Firebase (wallet-ia-c8e77.firebaseapp.com)
    try {
      const cred = await signInWithPopup(auth, provider);
      if (cred?.user) {
        const additionalInfo = getAdditionalUserInfo(cred);
        // Se não é o 1º login desta conta Google, marca imediatamente como já cadastrada
        if (additionalInfo?.isNewUser === false) {
          markUserOnboardedLocal(cred.user.uid);
        }
        setUser(cred.user);
      }
      return cred.user;
    } catch (popupError: unknown) {
      const code =
        typeof popupError === "object" && popupError && "code" in popupError
          ? String(popupError.code)
          : "";

      // Se for domínio não autorizado no Firebase Console, informa o hostname exato
      if (code === "auth/unauthorized-domain") {
        const currentHost = typeof window !== "undefined" ? window.location.hostname : "seu-dominio.vercel.app";
        const message = `O domínio '${currentHost}' não está autorizado no Firebase. Adicione este domínio no Firebase Console em Authentication > Configurações > Domínios Autorizados.`;
        setAuthError(message);
        throw popupError;
      }

      // Se o usuário simplesmente fechou a janela ou cancelou, não faz redirect indesejado
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return null;
      }

      // Apenas se o navegador bloqueou estritamente o popup fazemos fallback para redirect
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return null;
      }

      throw popupError;
    }
  };

  const signOut = async () => {
    const currentUid = user?.uid;
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("wallet_login_failed_attempts");
      }
      clearUserLocalCaches(currentUid);
    } catch {
      // Ignora erro de limpeza local
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const deleteAccount = async (password?: string) => {
    if (!auth.currentUser) {
      throw new Error("Nenhum usuário conectado para exclusão.");
    }
    const currentUser = auth.currentUser;
    const currentUid = currentUser.uid;

    // 1. Validar e renovar a autenticação ANTES de excluir os dados do Firestore
    // Evita que os dados sejam apagados caso o Firebase Auth exija login recente
    const isGoogleUser = currentUser.providerData.some(
      (p) => p.providerId === "google.com"
    );

    const tokenResult = await currentUser.getIdTokenResult(true);
    const authTimeMs = new Date(tokenResult.authTime).getTime();
    const diffMinutes = (Date.now() - authTimeMs) / (1000 * 60);

    if (isGoogleUser) {
      // Para login com Google, aciona reautenticação com popup para renovar a sessão
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await reauthenticateWithPopup(currentUser, provider);
    } else if (password && currentUser.email) {
      // Para login com e-mail/senha, valida a credencial fornecida
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    } else if (diffMinutes > 4) {
      // Se a sessão expirou para operações sensíveis e não foi renovada
      const err = new Error(
        "Por segurança, a exclusão da conta exige login recente. Saia e entre novamente antes de solicitar a exclusão."
      );
      (err as unknown as { code: string }).code = "auth/requires-recent-login";
      throw err;
    }

    // 2. O servidor deriva o UID do token e remove recursivamente todos os dados.
    const idToken = await currentUser.getIdToken(true);
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; code?: string; error?: string }
      | null;

    if (!response.ok || !result?.success) {
      const error = new Error(result?.error || "Não foi possível excluir a conta por completo.");
      if (result?.code === "REAUTHENTICATION_REQUIRED") {
        (error as Error & { code: string }).code = "auth/requires-recent-login";
      }
      throw error;
    }

    // 3. Remove resíduos sensíveis do dispositivo e encerra a sessão local.
    clearUserLocalCaches(currentUid);
    await firebaseSignOut(auth).catch(() => undefined);
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
