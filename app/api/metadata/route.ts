import { NextRequest, NextResponse } from 'next/server';
import { BookmarkMetadata } from '@/lib/types';
import { extractTitle, extractDescription, extractIcon, extractImage } from '@/lib/api/metadata';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CollectionBot/1.0)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error('Failed to fetch URL');
    }

    const html = await response.text();

    // Extract metadata
    const metadata: BookmarkMetadata = {
      title: extractTitle(html, url),
      description: extractDescription(html),
      icon: extractIcon(html, url),
      image: extractImage(html, url),
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}
