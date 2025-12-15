export type Folder = "inbox" | "sent" | "drafts" | "trash" | "spam" | "archive";

export interface Email {
  id: string;
  from: string;
  to?: string;
  subject: string;
  body: string;

  folder: Folder;
  unread?: boolean;
}
