import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/ensureAuth';
import { getActiveEngine } from '../services/ai';
import { deleteAllChatMessages } from '../models/chatMessage';

const router = Router();

// Every route here requires a logged-in session.
router.use(ensureAuthenticated);

// What AI engine the server is actually using, resolved from the environment.
// Read-only: users cannot switch providers from the UI.
router.get('/settings/engine', (req: Request, res: Response) => {
  try {
    const engine = getActiveEngine();
    res.json({ engine });
  } catch (error) {
    console.error('Failed to resolve AI engine:', error);
    res.status(503).json({
      error: 'No AI engine is configured on the server.',
    });
  }
});

// Wipes the user's chat history across all repositories.
router.delete('/settings/chat-history', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id: number }).id;
    await deleteAllChatMessages(userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to reset chat history:', error);
    res.status(500).json({ error: 'Failed to reset chat history' });
  }
});

export default router;