import { db } from "@/lib/firebase";
import { CardItem } from "@/types";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

function sanitizeData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Salva ou adiciona um cartão na subcoleção users/{userId}/cards
 */
export async function saveCardToFirestore(
  userId: string,
  card: CardItem
): Promise<void> {
  const cardDocRef = doc(db, "users", userId, "cards", card.id);
  const cleanCard = sanitizeData(card);
  await setDoc(cardDocRef, cleanCard, { merge: true });
}

/**
 * Exclui um cartão do Firestore
 */
export async function deleteCardFromFirestore(
  userId: string,
  cardId: string
): Promise<void> {
  const cardDocRef = doc(db, "users", userId, "cards", cardId);
  await deleteDoc(cardDocRef);
}

/**
 * Atualiza o limite de um cartão
 */
export async function updateCardLimitInFirestore(
  userId: string,
  cardId: string,
  newLimit: number
): Promise<void> {
  const cardDocRef = doc(db, "users", userId, "cards", cardId);
  await updateDoc(cardDocRef, { limit: newLimit });
}

/**
 * Escuta em tempo real os cartões do usuário no Firestore
 */
export function subscribeToCards(
  userId: string,
  callback: (cards: CardItem[]) => void
): () => void {
  const cardsCol = collection(db, "users", userId, "cards");
  return onSnapshot(
    cardsCol,
    (snapshot) => {
      const cards: CardItem[] = snapshot.docs.map((doc) => doc.data() as CardItem);
      callback(cards);
    },
    (err) => {
      console.error("Erro ao sincronizar cartões do Firestore:", err);
    }
  );
}
