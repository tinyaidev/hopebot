import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl, toMarkdown } from '@/lib/content';

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req.headers);
  const md = toMarkdown(base);
  return new NextResponse(md, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
