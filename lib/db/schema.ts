import { sql } from "drizzle-orm";
import { text, integer, real, sqliteTable } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  originalVideoUrl: text("original_video_url").notNull(),
  youtubeSourceUrl: text("youtube_source_url"),
  title: text("title").notNull(),
  status: text("status").default("uploaded").notNull(), // 'uploaded' | 'transcribing' | 'analyzing' | 'ready' | 'failed'
  transcription: text("transcription"),
  captionsJson: text("captions_json", { mode: "json" }),
  errorMessage: text("error_message"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const captionStyles = sqliteTable("caption_styles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  styleProperties: text("style_properties", { mode: "json" }).notNull(), // {fontFamily, fontSizePx, textColor, highlightColor, backgroundColor, textPosition, maxDisplayWords}
  isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const shortVideoClips = sqliteTable("short_video_clips", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  startTimeSeconds: real("start_time_seconds").notNull(),
  endTimeSeconds: real("end_time_seconds").notNull(),
  seoScore: integer("seo_score").notNull(),
  reason: text("reason").notNull(),
  clipCaptionsJson: text("clip_captions_json", { mode: "json" }),
  captionStyleId: text("caption_style_id").references(() => captionStyles.id),
  status: text("status").default("pending").notNull(), // 'pending' | 'rendering' | 'rendered' | 'failed'
  renderedVideoUrl: text("rendered_video_url"),
  editedSinceLastRender: integer("edited_since_last_render", { mode: "boolean" })
    .default(false)
    .notNull(),
  youtubeVideoId: text("youtube_video_id"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const audioTracks = sqliteTable("audio_tracks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  audioUrl: text("audio_url").notNull(),
  youtubeSourceUrl: text("youtube_source_url"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

