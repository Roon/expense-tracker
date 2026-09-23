// lib/cloud/share.ts
//
// Share links are self-contained: the report is compressed into the URL
// fragment (#...), which browsers never send to a server. Nothing is uploaded;
// whoever has the link has the data, and nobody else does.
import type { Report } from './types'

export interface SharePayload {
  v: 1
  report: Report
  sharedAt: string
  /** Advisory expiry, enforced by the viewer page. */
  expiresAt: string | null
  note?: string
}

/** QR codes hold ~2.9KB in byte mode at low error correction; leave headroom. */
export const QR_MAX_URL_LENGTH = 2300

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

/** Encodes as "z.<data>" (deflate) or "j.<data>" (plain JSON) when compression isn't available. */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload))
  if (canCompress()) return `z.${toBase64Url(await pipe(json, new CompressionStream('deflate')))}`
  return `j.${toBase64Url(json)}`
}

export type DecodeResult =
  | { ok: true; payload: SharePayload; expired: boolean }
  | { ok: false; error: string }

export async function decodeShare(token: string, now: Date = new Date()): Promise<DecodeResult> {
  try {
    const [scheme, data] = [token.slice(0, 1), token.slice(2)]
    if (token[1] !== '.' || !data) return { ok: false, error: 'This link is incomplete.' }
    let bytes = fromBase64Url(data)
    if (scheme === 'z') {
      if (!canCompress()) return { ok: false, error: 'Your browser cannot open compressed links.' }
      bytes = await pipe(bytes, new DecompressionStream('deflate'))
    } else if (scheme !== 'j') {
      return { ok: false, error: 'Unrecognized link format.' }
    }
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload
    if (payload?.v !== 1 || !payload.report?.tables) return { ok: false, error: 'Unsupported link version.' }
    const expired = !!payload.expiresAt && new Date(payload.expiresAt) < now
    return { ok: true, payload, expired }
  } catch {
    return { ok: false, error: 'This link is damaged or was copied incompletely.' }
  }
}

export function shareUrl(origin: string, token: string): string {
  return `${origin}/share#${token}`
}
