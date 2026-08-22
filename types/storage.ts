export interface StorageDay {
  date: string;
  mainMb: number;
  bubbleMb: number;
  sizeMb: number;
}

export interface DatabaseInfo {
  usedMb: number;
  totalMb: number;
}

export interface DatabasesInfo {
  main: DatabaseInfo;
  bubbles: DatabaseInfo;
}
