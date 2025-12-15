export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export const emails: Email[] = [
  {
    id: "1",
    from: "prof@example.edu",
    subject: "Meeting next week",
    body: "Hi Hanbo,\nAre you available for a meeting next week?\nBest,\nProf"
  },
  {
    id: "2",
    from: "hr@company.com",
    subject: "Interview follow-up",
    body: "Hi Hanbo,\nThanks for interviewing with us.\nBest,\nHR Team"
  }
];
