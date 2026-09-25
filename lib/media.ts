import { MediaItem } from './adapters/types'

const MAX_BYTES = 512 * 1024 * 1024 // 512MB ceiling so one bad row can't OOM the function

/**
 * Pull media out of Supabase Storage into memory once per post, so each
 * adapter can upload real bytes instead of passing a URL the platform
 * can't fetch.
 */
export async function downloadMedia(urls: string[]): Promise<MediaItem[]> {
  const items: MediaItem[] = []

  for (const url of urls) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not download media (${res.status}): ${url}`)

    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > MAX_BYTES) throw new Error(`Media exceeds ${MAX_BYTES} bytes: ${url}`)

    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) throw new Error(`Media exceeds ${MAX_BYTES} bytes: ${url}`)

    items.push({
      url,
      bytes,
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      filename: decodeURIComponent(new URL(url).pathname.split('/').pop() || 'upload'),
    })
  }

  return items
}
