export interface Email {
  id: string;
  from: string;
  to?: string;
  subject: string;
  body: string;

  folder: "inbox" | "sent" | "drafts" | "trash";
  unread: boolean;
}
