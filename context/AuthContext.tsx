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
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
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

    // Garante persistência IndexedDB configurada logo no boot
    configureBestPersistence().finally(() => {
      // Trata resultado de redirecionamento OAuth com timeout de 3.5s para não travar o boot
      const redirectPromise = getRedirectResult(auth)
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
              "Domínio não autorizado no Firebase. Adicione o link em 'Domínios Autorizados' no Firebase Console."
            );
          } else if (code === "auth/missing-or-invalid-nonce") {
            setAuthError("A sessão de autenticação expirou. Por favor, tente novamente.");
          } else if (
            code !== "auth/popup-closed-by-user" &&
            code !== "auth/cancelled-popup-request"
          ) {
            setAuthError("Não foi possível concluir a autenticação com o Google. Tente novamente.");
          }
        });

      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3500));

      Promise.race([redirectPromise, timeoutPromise]).finally(() => {
        if (!isMounted) return;
        // Escuta mudanças no estado de autenticação em tempo real
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
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // Em modo PWA standalone ou em dispositivos móveis (onde popups abrem nova aba e perdem window.opener)
    if (isStandalone() || isMobile()) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    // Em navegadores Desktop convencionais, tentamos popup com fallback automático para redirect
    try {
      const cred = await signInWithPopup(auth, provider);
      if (cred?.user) {
        setUser(cred.user);
      }
      return cred.user;
    } catch (popupError: unknown) {
      const code =
        typeof popupError === "object" && popupError && "code" in popupError
          ? String(popupError.code)
          : "";
      // Se popup foi bloqueado, cancelado ou fechado sem comunicação, aciona redirect seguro
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/popup-closed-by-user"
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

    // 2. Com a autenticação recente comprovada, apaga os dados no Firestore
    await deleteUserDataFromFirestore(currentUid);

    // 3. E finalmente exclui a conta no Firebase Auth
    await deleteUser(currentUser);
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
