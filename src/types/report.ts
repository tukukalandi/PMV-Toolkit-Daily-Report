export interface PMVReport {
  id?: string;
  officeName: string;
  openingBalance: number;
  articlesReceived: number;
  articlesDelivered: number;
  articlesPending: number;
  pendingReason: string;
  reportDate: string;
  userId: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}
