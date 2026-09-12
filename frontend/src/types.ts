/** 前端稳定领域类型，隔离后端和微信读书原始字段的命名差异。 */
export type ShelfBook = {
  id: string;
  title: string;
  author: string;
  category: string;
  cover?: string;
  wordCount?: number;
  finished: boolean;
  lastRead: number;
  progress?: number;
  top?: boolean;
  secret?: boolean;
};

export type ReadingStats = {
  totalReadTime: number;
  readDays: number;
  readBooks: number;
  finishedBooks: number;
  notes: number;
  monthlySeconds: number[];
  favoriteCategory: string;
  longest?: { title: string; author: string; cover?: string; seconds: number };
};

export type DashboardData = {
  books: ShelfBook[];
  stats: ReadingStats;
  ownerName: string;
  syncedAt: Date;
};
