// Every platform adapter implements this shape. The publisher (below) calls
// `publish()` without caring which platform it's talking to.

export type PublishInput = {
  accessToken: string
  caption: string
  mediaUrls: string[]
  mediaType: 'image' | 'video' | 'carousel'
}

export type PublishResult = {
  success: boolean
  platformPostId?: string
  errorMessage?: string
}

export interface PlatformAdapter {
  publish(input: PublishInput): Promise<PublishResult>
}
