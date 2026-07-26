export interface ChatMessage {
  id: string;
  user_id: string;
  sender: 'user' | 'admin';
  text: string;
  time: string;
  created_at: string;
}

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'greet-default',
    user_id: 'user-dev-uuid',
    sender: 'admin',
    text: 'Hello! Welcome to the Client Support Desk. How can we assist you today?',
    time: 'Just now',
    created_at: new Date().toISOString()
  }
];
