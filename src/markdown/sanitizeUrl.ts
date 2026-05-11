const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:']

export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl) {
    return ''
  }

  if (rawUrl.startsWith('/') || rawUrl.startsWith('#')) {
    return rawUrl
  }

  try {
    const parsed = new URL(rawUrl)
    if (ALLOWED_SCHEMES.includes(parsed.protocol)) {
      return rawUrl
    }
  } catch {
    return ''
  }

  return ''
}
