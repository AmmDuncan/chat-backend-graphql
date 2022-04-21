export interface Channel {
  name: string;
  fullName: string;
  type: string;
  members: string[];
  messages?: Message[];
}

export interface Member {
  name: string;
  channels: string[];
}

export interface Message {
  id: string | number;
  content: string;
  createdAt: string;
  author: string;
  replyTo?: number | string | null;
}
