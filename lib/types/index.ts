export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  icon?: string;
  image?: string;
  tags: string[];
  collectionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkMetadata {
  title: string;
  description: string;
  icon?: string;
  image?: string;
}

export interface TagDefinition {
  name: string;
  color: string;
}
