// lib/cloud/integrations.ts
import type { DestinationConfig, DestinationId, FileFormat } from './types'

export interface Integration {
  id: DestinationId
  name: string
  /** Short product line shown under the name. */
  blurb: string
  /** Local destinations work without connecting an account. */
  requiresConnection: boolean
  /** Scopes shown on the (simulated) consent screen. */
  scopes: string[]
  /** Brand-ish color for the logo tile. */
  color: string
  monogram: string
  /** Verb for primary buttons: "Send to Dropbox". */
  action: string
  /** Stage label while the job is delivering. */
  deliveringLabel: string
  defaultConfig: () => DestinationConfig
  supportsFormats: FileFormat[]
}

export const INTEGRATIONS: Record<DestinationId, Integration> = {
  download: {
    id: 'download',
    name: 'This device',
    blurb: 'Download a file',
    requiresConnection: false,
    scopes: [],
    color: 'bg-gray-900',
    monogram: '↓',
    action: 'Download',
    deliveringLabel: 'Preparing download',
    defaultConfig: () => ({ kind: 'download', format: 'csv' }),
    supportsFormats: ['csv', 'json'],
  },
  email: {
    id: 'email',
    name: 'Email',
    blurb: 'Send to anyone',
    requiresConnection: false,
    scopes: [],
    color: 'bg-sky-500',
    monogram: '@',
    action: 'Send email',
    deliveringLabel: 'Sending email',
    defaultConfig: () => ({ kind: 'email', recipients: [], subject: '', message: '', includeLink: true }),
    supportsFormats: ['csv'],
  },
  'google-sheets': {
    id: 'google-sheets',
    name: 'Google Sheets',
    blurb: 'Live-synced spreadsheet',
    requiresConnection: true,
    scopes: ['Create and edit spreadsheets that ExpenseTracker creates', 'See your email address'],
    color: 'bg-emerald-600',
    monogram: 'S',
    action: 'Sync to Sheets',
    deliveringLabel: 'Writing to Google Sheets',
    defaultConfig: () => ({ kind: 'sheet', spreadsheetName: 'ExpenseTracker Reports', liveSync: true }),
    supportsFormats: [],
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    blurb: 'Save files to a folder',
    requiresConnection: true,
    scopes: ['Create files in a folder you choose', 'See your email address'],
    color: 'bg-yellow-500',
    monogram: 'D',
    action: 'Save to Drive',
    deliveringLabel: 'Uploading to Google Drive',
    defaultConfig: () => ({ kind: 'folder', folder: '/ExpenseTracker', format: 'csv' }),
    supportsFormats: ['csv', 'json'],
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    blurb: 'Save files to a folder',
    requiresConnection: true,
    scopes: ['Write to /Apps/ExpenseTracker', 'View your basic account info'],
    color: 'bg-blue-600',
    monogram: 'Db',
    action: 'Save to Dropbox',
    deliveringLabel: 'Uploading to Dropbox',
    defaultConfig: () => ({ kind: 'folder', folder: '/Apps/ExpenseTracker', format: 'csv' }),
    supportsFormats: ['csv', 'json'],
  },
  onedrive: {
    id: 'onedrive',
    name: 'OneDrive',
    blurb: 'Save files to a folder',
    requiresConnection: true,
    scopes: ['Read and write files you create with this app', 'Maintain access while you are offline'],
    color: 'bg-sky-700',
    monogram: 'O',
    action: 'Save to OneDrive',
    deliveringLabel: 'Uploading to OneDrive',
    defaultConfig: () => ({ kind: 'folder', folder: '/Documents/ExpenseTracker', format: 'csv' }),
    supportsFormats: ['csv', 'json'],
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    blurb: 'Post a digest to a channel',
    requiresConnection: true,
    scopes: ['Post messages to channels you choose'],
    color: 'bg-purple-700',
    monogram: '#',
    action: 'Post to Slack',
    deliveringLabel: 'Posting to Slack',
    defaultConfig: () => ({ kind: 'channel', channel: '#finances' }),
    supportsFormats: [],
  },
}

export const DESTINATION_ORDER: DestinationId[] = [
  'download',
  'email',
  'google-sheets',
  'google-drive',
  'dropbox',
  'onedrive',
  'slack',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (s: string) => EMAIL_RE.test(s.trim())

/** Returns a user-facing problem with the config, or null when it's ready to run. */
export function validateConfig(config: DestinationConfig): string | null {
  switch (config.kind) {
    case 'email':
      if (config.recipients.length === 0) return 'Add at least one recipient.'
      if (!config.recipients.every(isValidEmail)) return 'One of the email addresses looks invalid.'
      return null
    case 'sheet':
      return config.spreadsheetName.trim() ? null : 'Name the spreadsheet.'
    case 'folder':
      return config.folder.trim().startsWith('/') ? null : 'Folder path should start with "/".'
    case 'channel':
      return /^#[\w-]+$/.test(config.channel.trim()) ? null : 'Channel should look like #channel-name.'
    case 'download':
      return null
  }
}

/** Where a completed job "landed", for history rows. */
export function describeLocation(id: DestinationId, config: DestinationConfig, fileName: string): string {
  switch (config.kind) {
    case 'download':
      return `Downloads/${fileName}`
    case 'email':
      return config.recipients.join(', ')
    case 'sheet':
      return `${config.spreadsheetName} (Google Sheets)`
    case 'folder':
      return `${INTEGRATIONS[id].name}: ${config.folder.replace(/\/$/, '')}/${fileName}`
    case 'channel':
      return `${config.channel} in Slack`
  }
}
