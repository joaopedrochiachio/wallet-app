import fs from "node:fs";
import { initializeApp, getApps, getApp, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Inicialização centralizada e segura do Firebase Admin SDK no servidor.
 * NUNCA executa nem vaza para o cliente.
 */

let testAuthMock: Auth | null = null;
let testFirestoreMock: Firestore | null = null;

function getServiceAccount(): ServiceAccount | null {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!saEnv) {
    console.warn("[FIREBASE_ADMIN] Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");
    return null;
  }

  try {
    let clean = saEnv.trim();
    // Remove qualquer aspa simples ou dupla residual nas pontas (comum ao colar no painel da Vercel)
    while (
      clean.startsWith('"') ||
      clean.startsWith("'") ||
      clean.endsWith('"') ||
      clean.endsWith("'")
    ) {
      if (clean.startsWith('"') || clean.startsWith("'")) {
        clean = clean.slice(1).trim();
      }
      if (clean.endsWith('"') || clean.endsWith("'")) {
        clean = clean.slice(0, -1).trim();
      }
    }

    const sanitizeSA = (sa: ServiceAccount): ServiceAccount => {
      if (sa.privateKey && typeof sa.privateKey === "string") {
        sa.privateKey = sa.privateKey.replace(/\\n/g, "\n");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySA = sa as any;
      if (anySA.private_key && typeof anySA.private_key === "string") {
        anySA.private_key = anySA.private_key.replace(/\\n/g, "\n");
        if (!sa.privateKey) {
          sa.privateKey = anySA.private_key;
        }
      }
      if (anySA.client_email && !sa.clientEmail) {
        sa.clientEmail = anySA.client_email;
      }
      if (anySA.project_id && !sa.projectId) {
        sa.projectId = anySA.project_id;
      }
      return sa;
    };

    // Auto-recuperação caso falte { inicial ou } final
    if (!clean.startsWith("{") && clean.includes('"type"')) {
      clean = "{" + clean;
    }
    if (!clean.endsWith("}") && clean.includes('"type"')) {
      clean = clean + "}";
    }

    // 1. Prioridade absoluta para JSON direto (evita ENAMETOOLONG no Linux/Vercel)
    if (clean.startsWith("{")) {
      try {
        return sanitizeSA(JSON.parse(clean) as ServiceAccount);
      } catch (jsonErr) {
        // Tenta sanitizar quebras de linha literais caso coladas desformatadas no dashboard da Vercel
        try {
          const normalized = clean.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n");
          return sanitizeSA(JSON.parse(normalized) as ServiceAccount);
        } catch {
          console.error("[FIREBASE_ADMIN] Erro ao parsear JSON do Service Account:", jsonErr);
        }
      }
    }

    // 2. Suporte a Base64 (muito comum em deploys Vercel para contornar problemas de quebra de linha)
    try {
      const decoded = Buffer.from(clean, "base64").toString("utf-8");
      if (decoded.trim().startsWith("{")) {
        return sanitizeSA(JSON.parse(decoded) as ServiceAccount);
      }
    } catch {
      // Não é base64, segue para caminho de arquivo
    }

    // 3. Suporte a caminho de arquivo no disco (SOMENTE se for string curta, nunca JSON)
    if (clean.length < 500 && !clean.includes("\n") && fs.existsSync(/*turbopackIgnore: true*/ clean)) {
      const fileContent = fs.readFileSync(/*turbopackIgnore: true*/ clean, "utf-8");
      return sanitizeSA(JSON.parse(fileContent) as ServiceAccount);
    }

    console.warn("[FIREBASE_ADMIN] Formato não reconhecido para FIREBASE_SERVICE_ACCOUNT_KEY.");
    return null;
  } catch (err) {
    console.error("[FIREBASE_ADMIN] Erro ao carregar FIREBASE_SERVICE_ACCOUNT_KEY:", err);
    return null;
  }
}

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "wallet-ia-c8e77";

  const serviceAccount = getServiceAccount();

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  }

  // No ambiente de nuvem (GCP / Cloud Run / Firebase Functions) ou com emulador
  return initializeApp({
    projectId,
  });
}

export function getAdminAuth(): Auth {
  if (testAuthMock) {
    return testAuthMock;
  }
  const app = getAdminApp();
  return getAuth(app);
}

export function getAdminFirestore(): Firestore {
  if (testFirestoreMock) {
    return testFirestoreMock;
  }
  const app = getAdminApp();
  return getFirestore(app);
}

// Helpers para injeção explícita de mocks em testes automatizados
export function setAdminAuthForTesting(mock: Auth | null): void {
  testAuthMock = mock;
}

export function setAdminFirestoreForTesting(mock: Firestore | null): void {
  testFirestoreMock = mock;
}

export function resetAdminForTesting(): void {
  testAuthMock = null;
  testFirestoreMock = null;
}
