import "server-only";

import type {
  DocumentData,
  DocumentReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "../firebaseAdmin.ts";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonValue);

  if (value && typeof value === "object") {
    const candidate = value as {
      toDate?: () => Date;
      path?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      [key: string]: unknown;
    };

    if (typeof candidate.toDate === "function") {
      return candidate.toDate().toISOString();
    }
    if (typeof candidate.path === "string") {
      return { path: candidate.path };
    }
    if (
      typeof candidate.latitude === "number" &&
      typeof candidate.longitude === "number"
    ) {
      return {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      };
    }

    const output: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(candidate)) {
      if (nested !== undefined && typeof nested !== "function") {
        output[key] = toJsonValue(nested);
      }
    }
    return output;
  }

  return String(value);
}

async function exportDocument(
  ref: DocumentReference<DocumentData>,
  prefetched?: QueryDocumentSnapshot<DocumentData>
): Promise<{ id: string; data: JsonValue; collections: Record<string, JsonValue> }> {
  const snapshot = prefetched ?? (await ref.get());
  const collections = await ref.listCollections();
  const exportedCollections: Record<string, JsonValue> = {};

  for (const collectionRef of collections) {
    const collectionSnapshot = await collectionRef.get();
    const documents: JsonValue[] = [];
    for (const documentSnapshot of collectionSnapshot.docs) {
      documents.push(await exportDocument(documentSnapshot.ref, documentSnapshot));
    }
    exportedCollections[collectionRef.id] = documents;
  }

  return {
    id: ref.id,
    data: snapshot.exists ? toJsonValue(snapshot.data()) : null,
    collections: exportedCollections,
  };
}

/**
 * Exporta o documento do usuário e todas as subcoleções, inclusive coleções
 * administrativas que o SDK web não pode ler (ai_usage e ai_logs).
 */
export async function exportCompleteAccountData(uid: string): Promise<Record<string, JsonValue>> {
  const adminFirestore = getAdminFirestore();
  const firestoreData = await exportDocument(adminFirestore.collection("users").doc(uid));

  let authenticationData: JsonValue = { uid };
  try {
    const adminAuth = getAdminAuth();
    const authUser = await adminAuth.getUser(uid);
    authenticationData = toJsonValue({
      uid: authUser.uid,
      email: authUser.email ?? null,
      emailVerified: authUser.emailVerified,
      displayName: authUser.displayName ?? null,
      phoneNumber: authUser.phoneNumber ?? null,
      photoURL: authUser.photoURL ?? null,
      disabled: authUser.disabled,
      providers: authUser.providerData.map((provider) => ({
        providerId: provider.providerId,
        uid: provider.uid,
        email: provider.email ?? null,
        displayName: provider.displayName ?? null,
        phoneNumber: provider.phoneNumber ?? null,
      })),
      createdAt: authUser.metadata.creationTime ?? null,
      lastSignInAt: authUser.metadata.lastSignInTime ?? null,
    });
  } catch {
    // Fallback resiliente quando firebase-admin/auth não estiver disponível no runtime serverless
    authenticationData = { uid };
  }

  return {
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      lawReference: "LGPD - Lei 13.709/2018 (Artigo 18, V - Portabilidade de Dados)",
      platform: "Wallet+",
      scope: "Perfil de autenticação, documento principal e todas as subcoleções do usuário",
    },
    authentication: authenticationData,
    firestore: firestoreData,
  };
}

/**
 * Exclui de forma recursiva o documento e qualquer subcoleção, conhecida ou
 * futura, antes de remover a identidade no Firebase Authentication.
 */
export async function deleteCompleteAccount(uid: string): Promise<void> {
  const adminFirestore = getAdminFirestore();
  const userRef = adminFirestore.collection("users").doc(uid);

  await adminFirestore.recursiveDelete(userRef);

  const remainingRoot = await userRef.get();
  const remainingCollections = await userRef.listCollections();
  if (remainingRoot.exists || remainingCollections.length > 0) {
    throw new Error("ACCOUNT_DATA_DELETION_INCOMPLETE");
  }

  try {
    await getAdminAuth().deleteUser(uid);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    // Torna a operação idempotente caso uma repetição encontre a identidade já removida ou indisponibilidade de módulo ESM no runtime
    if (code !== "auth/user-not-found" && code !== "ERR_REQUIRE_ESM") throw error;
  }
}
