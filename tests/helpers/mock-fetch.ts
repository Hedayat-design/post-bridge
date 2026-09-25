/**
 * Records every outbound request and replies from a queue of canned responses,
 * so adapters can be tested against the exact HTTP contract each platform
 * documents — no credentials, no network.
 */

export type RecordedRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
  /** Parsed form fields when the body was urlencoded or multipart. */
  form: Record<string, string>
}

export type CannedResponse = {
  status?: number
  json?: unknown
  text?: string
  headers?: Record<string, string>
}

export class MockFetch {
  requests: RecordedRequest[] = []
  private queue: Array<(req: RecordedRequest) => CannedResponse> = []
  private original: typeof globalThis.fetch

  constructor() {
    this.original = globalThis.fetch
  }

  /** Queue one reply. Replies are consumed in order. */
  reply(response: CannedResponse | ((req: RecordedRequest) => CannedResponse)) {
    this.queue.push(typeof response === 'function' ? response : () => response)
    return this
  }

  install() {
    globalThis.fetch = (async (input: any, init: any = {}) => {
      const url = typeof input === 'string' ? input : input.url
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(init.headers ?? {})) {
        headers[k.toLowerCase()] = String(v)
      }

      const form: Record<string, string> = {}
      let body: unknown = init.body

      if (init.body instanceof URLSearchParams) {
        for (const [k, v] of init.body.entries()) form[k] = v
        body = init.body.toString()
      } else if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
        // Array.from keeps this compatible with the project's es5 target.
        for (const [k, v] of Array.from((init.body as FormData).entries())) {
          form[k] = v instanceof Blob ? `<blob:${v.size}>` : String(v)
        }
        body = '<formdata>'
      } else if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body)
        } catch {
          body = init.body
        }
      }

      const record: RecordedRequest = { url, method: init.method ?? 'GET', headers, body, form }
      this.requests.push(record)

      const next = this.queue.shift()
      if (!next) throw new Error(`MockFetch: no queued response for ${record.method} ${url}`)
      const canned = next(record)

      const responseHeaders = new Headers(canned.headers ?? {})
      const payload = canned.text ?? JSON.stringify(canned.json ?? {})

      return {
        ok: (canned.status ?? 200) < 400,
        status: canned.status ?? 200,
        headers: responseHeaders,
        json: async () => (canned.json !== undefined ? canned.json : JSON.parse(payload)),
        text: async () => payload,
        arrayBuffer: async () => new TextEncoder().encode(payload).buffer,
      } as unknown as Response
    }) as typeof globalThis.fetch
  }

  restore() {
    globalThis.fetch = this.original
  }

  /** Requests whose URL contains the given fragment. */
  to(fragment: string) {
    return this.requests.filter((r) => r.url.includes(fragment))
  }
}

export function imageItem(size = 1024) {
  return {
    url: 'https://storage.example/photo.jpg',
    contentType: 'image/jpeg',
    bytes: Buffer.alloc(size, 7),
    filename: 'photo.jpg',
  }
}

export function videoItem(size = 2048) {
  return {
    url: 'https://storage.example/clip.mp4',
    contentType: 'video/mp4',
    bytes: Buffer.alloc(size, 9),
    filename: 'clip.mp4',
  }
}
