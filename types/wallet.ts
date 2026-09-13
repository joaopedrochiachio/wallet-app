export type WalletCardVariant =
  | "bank"
  | "glass"
  | "pass"
  | "ticket"
  | "boarding-pass"
  | "loyalty";

export type CardBrand = "mastercard" | "visa" | "elo" | "amex" | "apple";

export type PassType = "boarding-pass" | "loyalty" | "ticket" | "generic";

export interface WalletCardData {
  id: string;
  title: string;
  subtitle?: string;
  variant: WalletCardVariant;
  brand?: CardBrand;
  type?: "credit" | "checking";
  balance?: number;
  limit?: number;
  spent?: number;
  cardNumber?: string;
  holderName?: string;
  expirationDate?: string;
  background?: string; // Tailwind gradient or color classes
  accentColor?: string;
  isGlass?: boolean;
  status?: "active" | "frozen" | "expired";
  closingDay?: number;
  dueDay?: number;
}

export interface BoardingPassData {
  id: string;
  type: "boarding-pass";
  airline: string;
  airlineLogoText?: string;
  originCode: string; // Ex: GRU
  originCity: string; // Ex: São Paulo
  destinationCode: string; // Ex: JFK
  destinationCity: string; // Ex: Nova York
  flightNumber: string; // Ex: LA8180
  gate: string; // Ex: 32B
  seat: string; // Ex: 04A
  passengerName: string;
  classType: string; // Ex: Executiva / Business
  boardingTime: string; // Ex: 21:15
  flightDate: string; // Ex: 24 OUT 2026
  terminal?: string; // Ex: T3
  barcodeNumber?: string;
  themeColor?: string; // Ex: bg-slate-900, bg-[#0A192F]
}

export interface LoyaltyPassData {
  id: string;
  type: "loyalty";
  programName: string; // Ex: Apple One Rewards
  category: string; // Ex: Fidelidade & Pontos
  pointsBalance: string; // Ex: 148.500 pts
  tier: string; // Ex: Black Member
  memberId: string; // Ex: W-994821
  holderName: string;
  validThru: string;
  barcodeNumber?: string;
  themeColor?: string; // Ex: bg-purple-950, bg-amber-950
}

export interface TicketPassData {
  id: string;
  type: "ticket";
  eventName: string; // Ex: Apple Keynote Special
  venue: string; // Ex: Steve Jobs Theater, Cupertino
  eventDate: string; // Ex: 15 NOV 2026
  eventTime: string; // Ex: 10:00 AM
  section: string; // Ex: VIP
  row?: string; // Ex: A
  seat?: string; // Ex: 12
  attendeeName: string;
  barcodeNumber?: string;
  themeColor?: string;
}

export type AnyPassData = BoardingPassData | LoyaltyPassData | TicketPassData;
