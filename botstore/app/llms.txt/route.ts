import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl, getBotdentityUrl, toMarkdown } from '@/lib/content';

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req.headers);
  const botdentity = getBotdentityUrl();
  const md = toMarkdown(base, botdentity);
  return new NextResponse(md, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
