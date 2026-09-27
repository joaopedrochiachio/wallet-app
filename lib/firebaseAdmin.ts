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
  if (!saEnv) return null;

  try {
    // Suporta JSON puro ou string codificada em base64
    const jsonStr = saEnv.trim().startsWith("{")
      ? saEnv.trim()
      : Buffer.from(saEnv, "base64").toString("utf-8");
    return JSON.parse(jsonStr) as ServiceAccount;
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
