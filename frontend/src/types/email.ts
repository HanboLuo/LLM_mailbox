export type Folder = "inbox" | "sent" | "drafts" | "trash";

export interface Email {
  id: string;
  from: string;
  to?: string;
  subject: string;
  body: string;

  folder: Folder;
  unread?: boolean;
}
