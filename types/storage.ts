export interface StorageDay {
  date: string;
  sizeMb: number;
}

export interface DatabaseInfo {
  usedMb: number;
  totalMb: number;
}

export interface DatabasesInfo {
  timescale: DatabaseInfo;
}
