export interface WorkNoteGroup {
  groupId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface WorkNoteGroupWorkNote {
  workId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
