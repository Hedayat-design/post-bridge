// Central registry of every supported platform's OAuth details.
// Swap in real values once you've registered developer apps with each platform.

export type Platform = 'x' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'youtube'

export type PlatformConfig = {
  label: string
  authUrl: string
  tokenUrl: string
  scope: string
  clientIdEnv: string
  clientSecretEnv: string
  /** PKCE is mandatory on some providers (X, TikTok) and absent on others. */
  usesPkce: boolean
  /** How app credentials are presented at the token endpoint. */
  tokenAuth: 'basic' | 'body'
  /** Separator the provider expects between scopes. */
  scopeSeparator: ' ' | ','
  /** False while an adapter is still a stub, so the UI can say so honestly. */
  publishImplemented: boolean
}

export const PLATFORMS: Record<Platform, PlatformConfig> = {
  x: {
    label: 'X',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    // media.write is required for any post carrying an image or video.
    scope: 'tweet.read tweet.write users.read media.write offline.access',
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    usesPkce: true,
    tokenAuth: 'basic',
    scopeSeparator: ' ',
    publishImplemented: true,
  },
  linkedin: {
    label: 'LinkedIn',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    // r_liteprofile is retired; these are the current OIDC + posting scopes.
    scope: 'openid profile email w_member_social',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    usesPkce: false,
    tokenAuth: 'body',
    scopeSeparator: ' ',
    publishImplemented: true,
  },
  instagram: {
    label: 'Instagram',
    authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scope: 'instagram_basic,instagram_content_publish,pages_show_list',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    usesPkce: false,
    tokenAuth: 'body',
    scopeSeparator: ',',
    publishImplemented: false,
  },
  facebook: {
    label: 'Facebook',
    authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scope: 'pages_manage_posts,pages_read_engagement',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    usesPkce: false,
    tokenAuth: 'body',
    scopeSeparator: ',',
    publishImplemented: false,
  },
  tiktok: {
    label: 'TikTok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'video.publish,video.upload',
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    usesPkce: true,
    tokenAuth: 'body',
    scopeSeparator: ',',
    publishImplemented: false,
  },
  youtube: {
    label: 'YouTube Shorts',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    clientIdEnv: 'YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'YOUTUBE_CLIENT_SECRET',
    usesPkce: false,
    tokenAuth: 'body',
    scopeSeparator: ' ',
    publishImplemented: false,
  },
}

// Plan → max connected accounts, mirrors the schema.sql comment
export const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  starter: 5,
  creator: 15,
  pro: Infinity,
}
