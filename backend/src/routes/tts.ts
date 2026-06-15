import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// Proxy Vietnamese TTS via Google Translate — no API key, returns audio/mpeg.
// Frontend calls /api/tts?q=<encoded+text> and plays the returned MP3.
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) ?? '').trim().slice(0, 200);
  if (!q) { res.status(400).send('q required'); return; }

  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(q)}`;

  const upstream = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
    },
  });

  if (!upstream.ok) {
    res.status(502).send('TTS unavailable');
    return;
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.set({
    'Content-Type':  'audio/mpeg',
    'Cache-Control': 'public, max-age=86400', // cache same phrase for 1 day
    'X-TTS-Chars':   String(q.length),
  });
  res.send(buf);
}));

export default router;
