"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/services/userService";
import { Lock, Mail, ArrowRight, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    authError,
    clearAuthError,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Sincroniza erro de autenticação/redirect do contexto
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Navega para o destino correto com fallback imediato se o router do Next.js engasgar em mobile/PWA
  const navigateToAuthenticatedApp = async (uid: string) => {
    let target = "/dashboard";
    try {
      const profilePromise = getUserProfile(uid);
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2000)
      );
      const profile = await Promise.race([profilePromise, timeoutPromise]);
      target = profile?.isOnboarded ? "/dashboard" : "/onboarding";
    } catch {
      target = "/dashboard";
    }

    router.replace(target);

    // Fallback garantido se o roteador do Next.js não completar a transição
    setTimeout(() => {
      if (window.location.pathname === "/login") {
        window.location.replace(target);
      }
    }, 1200);
  };

  // Se o usuário estiver autenticado (seja por redirect, popup ou e-mail), direciona com base no onboarding
  useEffect(() => {
    if (!authLoading && user) {
      navigateToAuthenticatedApp(user.uid);
    }
  }, [user, authLoading]);

  const handleGoogleSignIn = async () => {
    setError(null);
    clearAuthError();
    setSuccessMessage(null);
    setGoogleLoading(true);

    // Timeout de segurança para evitar que a tela fique congelada indefinidamente
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setGoogleLoading(false);
    }, 15000);

    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        await navigateToAuthenticatedApp(loggedUser.uid);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error("Erro no login Google:", err);
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "seu-dominio.vercel.app";
      if (code === "auth/unauthorized-domain") {
        setError(
          `O domínio '${currentHost}' não está autorizado no Firebase. Adicione este domínio no Firebase Console em Authentication > Configurações > Domínios Autorizados.`
        );
      } else if (code === "auth/popup-closed-by-user") {
        setError("A janela de autenticação foi fechada antes de concluir o login. Tente novamente.");
      } else {
        setError("Não foi possível autenticar com o Google. Verifique as configurações e domínios autorizados no Firebase Console.");
      }
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Por favor, informe seu e-mail.");
      return;
    }

    if (mode === "reset") {
      setLoading(true);
      try {
        await resetPassword(trimmedEmail);
        setSuccessMessage("Link de recuperação enviado com sucesso! Verifique sua caixa de entrada.");
      } catch (err: unknown) {
        console.error("Erro ao solicitar recuperação de senha:", err);
        const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
        if (code === "auth/user-not-found") {
          setError("Não encontramos nenhuma conta com este e-mail.");
        } else if (code === "auth/invalid-email") {
          setError("Formato de e-mail inválido.");
        } else {
          setError("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("A senha deve conter no mínimo 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As senhas digitadas não coincidem.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const loggedUser = await signIn(trimmedEmail, password);
        await navigateToAuthenticatedApp(loggedUser.uid);
      } else {
        await signUp(trimmedEmail, password);
        router.replace("/onboarding");
        setTimeout(() => {
          if (window.location.pathname === "/login") {
            window.location.replace("/onboarding");
          }
        }, 1200);
      }
    } catch (err: unknown) {
      console.error("Erro na autenticação:", err);
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("E-mail ou senha incorretos.");
      } else if (code === "auth/email-already-in-use") {
        setError("Este e-mail já está cadastrado. Tente entrar.");
      } else if (code === "auth/weak-password") {
        setError("A senha é muito fraca. Use pelo menos 6 caracteres.");
      } else if (code === "auth/invalid-email") {
        setError("Formato de e-mail inválido.");
      } else {
        setError(err instanceof Error ? err.message : "Ocorreu um erro ao processar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-between items-center px-4 py-8 md:py-12 font-sans selection:bg-[#1D1D1F] selection:text-white">
      
      {/* Top Brand Indicator */}
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <Image
          src="/logo2.png"
          alt="Wallet"
          width={36}
          height={36}
          className="rounded-xl object-contain shadow-xs shrink-0"
          priority
        />
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
            Wallet
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-black/5 text-[#86868B]">
            ID
          </span>
        </div>
      </Link>

      {/* Cartão de Autenticação Estilo Pass Kit Físico */}
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-[0_12px_36px_rgba(0,0,0,0.06)] border border-black/[0.04] p-7 md:p-8 space-y-5 my-auto animate-in fade-in zoom-in-95 duration-300">
        
        {/* Thumb Notch Decorativo no topo do Cartão */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />

        <div className="flex justify-center mb-1">
          <Image
            src="/logo2.png"
            alt="Wallet Logo"
            width={60}
            height={60}
            className="rounded-[18px] shadow-xs border border-black/5"
            priority
          />
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            {mode === "login"
              ? "Acessar Carteira"
              : mode === "register"
              ? "Criar seu Wallet ID"
              : "Recuperar Senha"}
          </h1>
          <p className="text-xs text-[#86868B] max-w-xs mx-auto">
            {mode === "login"
              ? "Autentique-se com segurança para gerenciar seus cartões e finanças."
              : mode === "register"
              ? "Inicie sua experiência financeira com dados criptografados e controle pessoal."
              : "Informe seu e-mail cadastrado para enviarmos um link seguro de redefinição de senha."}
          </p>
        </div>

        {mode !== "reset" ? (
          <>
            {/* Botão de Autenticação com Google Estilo Apple HIG */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full bg-white hover:bg-gray-50 active:scale-[0.99] text-[#1D1D1F] border border-black/10 font-semibold text-xs py-3 px-4 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <Loader2 size={16} className="animate-spin text-[#86868B]" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continuar com Google</span>
            </button>

            {/* Divisor Delicado */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200/80" />
              <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
                ou com e-mail
              </span>
              <div className="flex-1 h-px bg-gray-200/80" />
            </div>

            {/* Segmented Control iOS */}
            <div className="bg-[#E5E5EA]/70 p-1 rounded-full flex gap-1 border border-black/5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mode === "login"
                    ? "bg-white text-[#1D1D1F] shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                Iniciar Sessão
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mode === "register"
                    ? "bg-white text-[#1D1D1F] shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                Criar Conta
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer flex items-center gap-1"
            >
              ← Voltar ao login
            </button>
          </div>
        )}

        {/* Mensagem de Sucesso Estilo Alerta iOS */}
        {successMessage && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Mensagem de Erro Estilo Alerta iOS */}
        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200/60 rounded-xl px-4 py-2.5 text-xs font-medium animate-in fade-in duration-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
              E-mail
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]"
                strokeWidth={1.5}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full bg-[#F2F2F7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
              />
            </div>
          </div>

          {mode !== "reset" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Senha
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]"
                  strokeWidth={1.5}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#F2F2F7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
                />
              </div>
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]"
                  strokeWidth={1.5}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#F2F2F7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
                />
              </div>
            </div>
          )}

          <div className="pt-1.5">
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full bg-[#1D1D1F] hover:bg-black active:scale-[0.99] text-white font-semibold text-sm py-3 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? "Entrar com E-mail"
                      : mode === "register"
                      ? "Criar Wallet ID"
                      : "Enviar Link de Recuperação"}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-black/[0.04] text-center">
          <Link
            href="/"
            className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            ← Voltar para a apresentação
          </Link>
        </div>
      </div>

      {/* Footer Segurança */}
      <div className="flex items-center gap-2 text-xs text-[#86868B]">
        <ShieldCheck size={14} strokeWidth={1.5} />
        <span>Criptografia de ponta a ponta e isolamento biométrico</span>
      </div>
    </div>
  );
}
