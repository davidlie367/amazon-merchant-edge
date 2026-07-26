import express, { Response } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockChatMessages } from '../config/sandboxStore.js';
import { broadcastToAdmins } from '../services/wsService.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDbConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id') &&
                       process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.includes('your-supabase-anon-key');

// 1. Fetch Chat Message Log
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    let messages = [];

    const welcomeMsgText = 'Hello! Welcome to the Client Support Desk. How can we assist you with balance updates, withdrawals, or review submissions today?';
    const welcomeTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!isDbConfigured) {
      const userThreads = mockChatMessages.filter(m => m.user_id === (userId || 'user-dev-uuid'));
      if (userThreads.length === 0) {
        mockChatMessages.push({
          id: 'greet-default',
          user_id: userId || 'user-dev-uuid',
          sender: 'admin',
          text: welcomeMsgText,
          time: welcomeTime,
          created_at: new Date().toISOString()
        });
      }
      messages = mockChatMessages.filter(m => m.user_id === (userId || 'user-dev-uuid'));
    } else {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch chat logs: ' + error.message });
      }

      if (!data || data.length === 0) {
        const { data: seeded } = await supabase
          .from('chat_messages')
          .insert({
            user_id: userId,
            sender: 'admin',
            text: welcomeMsgText,
            time: welcomeTime
          })
          .select();
        
        messages = seeded || [];
      } else {
        messages = data;
      }
    }

    // Format chat messages
    const formatted = messages.map((m: any) => ({
      id: m.id,
      sender: m.sender, // 'user' | 'admin'
      text: m.text,
      time: m.time
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. Send Message and Trigger System Auto-Responder
router.post('/send', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { text, time } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const timeVal = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const autoReplyText = "Your support request has been queued. An operator has been notified and will audit your inquiry shortly.";

    if (!isDbConfigured) {
      const userMsg = {
        id: `msg-user-${Date.now()}`,
        user_id: userId || 'user-dev-uuid',
        sender: 'user' as const,
        text: text.trim(),
        time: timeVal,
        created_at: new Date().toISOString()
      };
      mockChatMessages.push(userMsg);

      const userThreads = mockChatMessages.filter(m => m.user_id === (userId || 'user-dev-uuid'));
      const adminSentCustom = userThreads.some(m => m.sender === 'admin' && !m.text.includes('Hello! Welcome to the Client Support Desk'));
      const userSentCount = userThreads.filter(m => m.sender === 'user').length;

      if (!adminSentCustom && userSentCount === 1) {
        setTimeout(() => {
          const replyMsg = {
            id: `msg-agent-${Date.now()}`,
            user_id: userId || 'user-dev-uuid',
            sender: 'admin' as const,
            text: autoReplyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            created_at: new Date().toISOString()
          };
          mockChatMessages.push(replyMsg);
        }, 1500);
      }

      // Broadcast new message alert to admin panel via WebSocket
      broadcastToAdmins('new_chat_message', { userId: userMsg.user_id, text: userMsg.text, time: userMsg.time });

      return res.status(201).json({
        message: 'Message successfully sent.',
        userMessage: {
          id: userMsg.id,
          sender: userMsg.sender,
          text: userMsg.text,
          time: userMsg.time
        }
      });
    }

    // Insert user message
    const { data: userMsg, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        sender: 'user',
        text: text.trim(),
        time: timeVal
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save message: ' + error.message });
    }

    // Broadcast new message alert to admin panel via WebSocket
    broadcastToAdmins('new_chat_message', { userId, text: userMsg.text, time: userMsg.time });

    // Check history to verify if the admin initiated the chat or has already custom-replied
    const { data: threadMsgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    const adminSentCustom = (threadMsgs || []).some(m => m.sender === 'admin' && !m.text.includes('Hello! Welcome to the Client Support Desk'));
    const userSentCount = (threadMsgs || []).filter(m => m.sender === 'user').length;

    if (!adminSentCustom && userSentCount === 1) {
      setTimeout(async () => {
        try {
          await supabase
            .from('chat_messages')
            .insert({
              user_id: userId,
              sender: 'admin',
              text: autoReplyText,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } catch (e) {
          console.error('Background auto-reply insertion failed:', e);
        }
      }, 1500);
    }

    res.status(201).json({
      message: 'Message successfully sent.',
      userMessage: {
        id: userMsg.id,
        sender: userMsg.sender,
        text: userMsg.text,
        time: userMsg.time
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3. Upload Image endpoint
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { image } = req.body; // base64 string
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 image data format' });
    }

    const imageExtension = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${imageExtension}`;
    const mimeType = `image/${imageExtension === 'jpg' ? 'jpeg' : imageExtension}`;

    if (isDbConfigured) {
      // Try to upload to Supabase Storage Bucket 'chat-attachments' first
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filename, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filename);

        if (urlData?.publicUrl) {
          return res.json({ imageUrl: urlData.publicUrl });
        }
      }
      console.warn("Supabase Storage bucket upload failed, falling back to local disk storage:", uploadError?.message);
    }

    // Fallback: local disk storage
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    res.json({ imageUrl: `/uploads/${filename}` });
  } catch (error: any) {
    res.status(500).json({ error: 'File upload failed: ' + error.message });
  }
});

export default router;
