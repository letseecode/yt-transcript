import { neon } from '@neondatabase/serverless'

export interface Segment {
  text: string
  startMs: number
}

export interface TranscriptRecord {
  videoId: string
  url: string
  title: string
  author: string
  segments: Segment[]
  createdAt: string
  publishedAt: string | null
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = connectionString ? neon(connectionString) : null

export function dbAvailable(): boolean {
  return sql !== null
}

let ensured = false
async function ensureTable() {
  if (!sql || ensured) return
  await sql`
    CREATE TABLE IF NOT EXISTS transcripts (
      video_id   text PRIMARY KEY,
      url        text NOT NULL,
      title      text,
      author     text,
      segments   jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  // Video's own publish date (from YouTube), distinct from when we saved it.
  await sql`ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS published_at text`
  ensured = true
}

export async function getTranscript(videoId: string): Promise<TranscriptRecord | null> {
  if (!sql) return null
  await ensureTable()
  const rows = await sql`SELECT * FROM transcripts WHERE video_id = ${videoId}`
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    videoId: r.video_id,
    url: r.url,
    title: r.title,
    author: r.author,
    segments: r.segments,
    createdAt: String(r.created_at),
    publishedAt: r.published_at ?? null,
  }
}

export async function saveTranscript(rec: {
  videoId: string
  url: string
  title: string
  author: string
  segments: Segment[]
  publishedAt?: string | null
}): Promise<void> {
  if (!sql) return
  await ensureTable()
  await sql`
    INSERT INTO transcripts (video_id, url, title, author, segments, published_at)
    VALUES (${rec.videoId}, ${rec.url}, ${rec.title}, ${rec.author}, ${JSON.stringify(rec.segments)}::jsonb, ${rec.publishedAt ?? null})
    ON CONFLICT (video_id) DO UPDATE
      SET url = EXCLUDED.url,
          title = EXCLUDED.title,
          author = EXCLUDED.author,
          segments = EXCLUDED.segments,
          published_at = COALESCE(EXCLUDED.published_at, transcripts.published_at)
  `
}

export async function deleteTranscript(videoId: string): Promise<void> {
  if (!sql) return
  await ensureTable()
  await sql`DELETE FROM transcripts WHERE video_id = ${videoId}`
}

export interface TranscriptSummary {
  videoId: string
  url: string
  title: string
  author: string
  createdAt: string
  publishedAt: string | null
}

export async function listTranscripts(): Promise<TranscriptSummary[]> {
  if (!sql) return []
  await ensureTable()
  const rows = await sql`
    SELECT video_id, url, title, author, created_at, published_at
    FROM transcripts
    ORDER BY created_at DESC
  `
  return rows.map((r) => ({
    videoId: r.video_id,
    url: r.url,
    title: r.title,
    author: r.author,
    createdAt: String(r.created_at),
    publishedAt: r.published_at ?? null,
  }))
}
