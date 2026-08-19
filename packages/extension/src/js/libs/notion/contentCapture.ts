// Page-content capture for the Notion tab-archive feature.
//
// The extraction function runs INSIDE the archived tab via
// chrome.scripting.executeScript — it must be fully self-contained (no imports,
// no closure over module scope) because it is serialized and injected.
//
// Specs: openspec/specs/page-content-capture/spec.md

/** Notion caps a single rich-text item's content at 2000 characters. */
export const NOTION_TEXT_LIMIT = 2000

/** Cap on generated content blocks, leaving headroom under Notion's 100-block
 * `children` limit for the bookmark block and the image block. */
export const MAX_CONTENT_BLOCKS = 90

/** Smallest image (in px per side) considered a real lead image, not an icon
 * or tracking pixel. */
export const MIN_IMAGE_SIDE = 200

/** How long the injected extraction may take before we give up and fall back
 * to bookmark-only content. */
export const CAPTURE_TIMEOUT_MS = 5000

export interface CapturedContent {
  text: string | null
  imageUrl: string | null
}

/**
 * Injected into the target tab. Self-contained by necessity — see file header.
 * Prefers the semantic main-content element, falls back to the whole body.
 */
export function extractPageContent(): {
  text: string | null
  imageUrl: string | null
} {
  const MIN_SIDE = 200
  const normalize = (value: string) =>
    value
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim()

  let text: string | null = null
  try {
    const main = document.querySelector('article, main')
    const source = (main as HTMLElement) || document.body
    text = source ? normalize(source.innerText || '') || null : null
  } catch {
    text = null
  }

  let imageUrl: string | null = null
  try {
    // Preferred: the page's own declared lead image. Works even though stale
    // tabs are backgrounded (so lazy <img>s never load), and it names the
    // content image rather than the site logo.
    const metaSelectors = [
      'meta[property="og:image"]',
      'meta[name="og:image"]',
      'meta[property="twitter:image"]',
      'meta[name="twitter:image"]',
    ]
    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector)
      const content = meta && meta.getAttribute('content')
      if (!content) {
        continue
      }
      // Resolve relative values against the page URL.
      const absolute = new URL(content, document.baseURI).href
      if (/^https?:\/\//i.test(absolute)) {
        imageUrl = absolute
        break
      }
    }
  } catch {
    imageUrl = null
  }

  try {
    // Fallback: the largest actually-loaded content image.
    const images = imageUrl ? [] : Array.from(document.images || [])
    let best: HTMLImageElement | null = null
    let bestArea = 0
    for (const image of images) {
      const width = image.naturalWidth || 0
      const height = image.naturalHeight || 0
      if (width < MIN_SIDE || height < MIN_SIDE) {
        continue
      }
      // `image.src` is already absolutized by the DOM; reject anything that is
      // not a plain http(s) URL Notion can fetch server-side.
      const source = image.src || ''
      if (!/^https?:\/\//i.test(source)) {
        continue
      }
      const area = width * height
      if (area > bestArea) {
        bestArea = area
        best = image
      }
    }
    if (best) {
      imageUrl = best.src
    }
  } catch {
    // keep whatever the meta pass found (possibly null)
  }

  return { text, imageUrl }
}

/** Split text into chunks that each fit inside one Notion rich-text item,
 * breaking on paragraph/word boundaries where possible. */
export const chunkText = (
  text: string,
  limit: number = NOTION_TEXT_LIMIT,
): string[] => {
  const chunks: string[] = []
  for (const paragraph of text.split(/\n\s*\n/)) {
    let rest = paragraph.trim()
    if (!rest) {
      continue
    }
    while (rest.length > limit) {
      // Prefer breaking at the last whitespace inside the limit.
      const window = rest.slice(0, limit)
      const breakAt = window.lastIndexOf(' ')
      const cut = breakAt > limit * 0.5 ? breakAt : limit
      chunks.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest) {
      chunks.push(rest)
    }
  }
  return chunks
}

const paragraphBlock = (content: string) => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: [{ type: 'text', text: { content } }] },
})

/**
 * Turn captured content into Notion blocks, honoring the per-item character
 * limit and the total block cap (overflow is truncated with a marker rather
 * than issuing follow-up append requests — see design.md decision 5).
 */
export const buildContentBlocks = (
  captured: CapturedContent | null,
): unknown[] => {
  if (!captured) {
    return []
  }
  const blocks: unknown[] = []
  if (captured.imageUrl) {
    blocks.push({
      object: 'block',
      type: 'image',
      image: { type: 'external', external: { url: captured.imageUrl } },
    })
  }
  if (captured.text) {
    const chunks = chunkText(captured.text)
    const room = Math.max(0, MAX_CONTENT_BLOCKS - blocks.length)
    const truncated = chunks.length > room
    // Reserve one slot for the truncation marker so the total never exceeds
    // MAX_CONTENT_BLOCKS.
    const keep = truncated ? Math.max(0, room - 1) : chunks.length
    for (const chunk of chunks.slice(0, keep)) {
      blocks.push(paragraphBlock(chunk))
    }
    if (truncated) {
      blocks.push(paragraphBlock('… (truncated)'))
    }
  }
  return blocks
}
