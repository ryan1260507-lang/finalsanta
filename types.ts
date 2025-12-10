export interface Sock {
  id: number;
  giftId: number | null;
  isOpened: boolean;
}

export interface GameState {
  socks: Sock[];
  currentGift: number | null; // The gift ID (1-35) currently being displayed
  isDrumrolling: boolean;
  openedCount: number;
}

export interface GameAssets {
  bgUrl: string;
  sockUrl: string;
  giftUrls: Record<number, string>; // Map gift ID to image URL
}