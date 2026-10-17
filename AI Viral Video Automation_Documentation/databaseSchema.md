# DATABASESCHEMA: VidShot - AI Long-to-Short Video Generator

## 1. Document Overview

This document outlines the database schema for **VidShot**, a full-stack SaaS application designed to convert long-form videos into viral short-form content using AI. This schema is designed for a PostgreSQL database, leveraging Drizzle ORM for interaction. It covers all core functionalities, including user management, video uploads, AI-driven content analysis, short clip generation, custom caption styling, video rendering, and social media scheduling.

The design prioritizes scalability, data integrity, and support for complex, asynchronous workflows via an external Ingest workflow engine.

**Key Technology Stack Mentions:**
*   **Database:** Neon PostgreSQL
*   **ORM:** Drizzle ORM
*   **Authentication:** Clerk
*   **Cloud Storage:** AWS S3
*   **Workflow Engine:** Ingest
*   **Transcription/Captioning:** Deepgram
*   **AI for Clip Selection:** Google Gemini AI
*   **Video Playback/Rendering:** Remotion (Player & Lambda)
*   **Social Media API:** Jour
*   **Security & Rate Limiting:** ARJet

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        UUID id PK "Clerk User ID"
        TEXT email UNIQUE
        TEXT name
        TEXT image_url
        VARCHAR(50) subscription_plan
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    CAPTION_STYLES {
        UUID id PK
        UUID user_id FK "Optional: for system defaults"
        VARCHAR(100) name
        VARCHAR(100) font_family
        INT font_size_px
        VARCHAR(7) text_color
        VARCHAR(7) highlight_color
        VARCHAR(7) background_color
        VARCHAR(50) text_position
        INT max_display_words
        BOOLEAN is_system_default
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PROJECTS {
        UUID id PK
        UUID user_id FK
        TEXT original_video_url "AWS S3 URL"
        VARCHAR(255) video_filename
        BIGINT video_filesize_bytes
        VARCHAR(50) status "Enum: UPLOADING, UPLOADED, TRANSCRIBING, ANALYZING, GENERATING_CLIPS, READY, FAILED"
        INT upload_progress_percentage
        TEXT transcription_text "Deepgram API JSON/plain"
        JSONB caption_data "Deepgram SRT/VTT format"
        TEXT error_message
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    SHORT_VIDEOS {
        UUID id PK
        UUID project_id FK
        VARCHAR(255) title
        TEXT description
        DECIMAL(10,3) start_time_seconds
        DECIMAL(10,3) end_time_seconds
        INT seo_score "0-100 score from AI"
        TEXT ai_reason_for_clip
        JSONB generated_caption_text "Specific caption text for this clip, AI-generated/user-edited"
        UUID current_caption_style_id FK "Last applied style for rendering"
        TEXT rendered_video_url "AWS S3 URL of final rendered output"
        VARCHAR(50) render_status "Enum: PENDING, RENDERING, RENDERED, FAILED"
        BOOLEAN is_edited_after_render "True if caption style changed since last render"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    SOCIAL_MEDIA_ACCOUNTS {
        UUID id PK
        UUID user_id FK
        VARCHAR(50) platform "Enum: YOUTUBE, TIKTOK, INSTAGRAM, etc."
        TEXT platform_user_id "ID from social media platform"
        VARCHAR(255) profile_name
        TEXT access_token "Encrypted JWT/OAuth token"
        TEXT refresh_token "Encrypted OAuth refresh token, nullable"
        TIMESTAMP token_expires_at "Nullable"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    SCHEDULED_POSTS {
        UUID id PK
        UUID user_id FK
        UUID short_video_id FK
        TIMESTAMP WITH TIME ZONE scheduled_publish_time
        VARCHAR(255) post_title_override
        TEXT post_description_override
        BOOLEAN ai_refinement_enabled
        VARCHAR(50) status "Enum: PENDING, PROCESSING, PUBLISHED, FAILED"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    POST_SOCIAL_MEDIA_LINKS {
        UUID id PK
        UUID scheduled_post_id FK
        UUID social_media_account_id FK
        TEXT platform_post_id "ID from social platform after publish"
        VARCHAR(50) publish_status "Enum: PENDING, PUBLISHING, PUBLISHED, FAILED"
        TIMESTAMP WITH TIME ZONE published_at
        TEXT error_message
        TEXT jour_api_job_id "Jour's async job ID"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    INGEST_JOB_STATUS {
        UUID id PK
        UUID project_id FK UNIQUE
        TEXT ingest_job_id "ID from Ingest platform"
        VARCHAR(100) current_step "Enum: UPLOAD_VIDEO, TRANSCRIBE_VIDEO, ANALYZE_SCENE, GENERATE_CLIPS, RENDER_SHORT_VIDEO, PUBLISH_SOCIAL_MEDIA"
        INT overall_progress_percentage
        JSONB step_status "Detailed status for each Ingest step"
        VARCHAR(50) status "Enum: PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELED"
        TEXT error_message
        TIMESTAMP start_time
        TIMESTAMP end_time
        TIMESTAMP last_polled_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    SYSTEM_CONFIG {
        VARCHAR(100) config_key PK
        TEXT config_value
        TEXT description
        UUID last_updated_by_user_id FK "Optional: for auditing config changes"
        TIMESTAMP updated_at
    }

    USERS ||--o{ PROJECTS : "uploads video for"
    USERS ||--o{ CAPTION_STYLES : "creates/uses"
    USERS ||--o{ SOCIAL_MEDIA_ACCOUNTS : "connects"
    USERS ||--o{ SCHEDULED_POSTS : "schedules"
    USERS ||--o| SYSTEM_CONFIG : "updates"

    PROJECTS ||--o{ SHORT_VIDEOS : "generates clips from"
    PROJECTS ||--o| INGEST_JOB_STATUS : "tracks workflow for"

    SHORT_VIDEOS ||--o{ SCHEDULED_POSTS : "can be posted"
    SHORT_VIDEOS }o--|| CAPTION_STYLES : "applies"

    SCHEDULED_POSTS ||--o{ POST_SOCIAL_MEDIA_LINKS : "generates platform links for"
    SOCIAL_MEDIA_ACCOUNTS ||--o{ POST_SOCIAL_MEDIA_LINKS : "receives posts on"
```

## 3. Table Definitions

### 3.1. `users` Table

Stores core user information, linked to Clerk authentication.

| Field Name          | Data Type                       | Constraints                                            | Description                                          |
| :------------------ | :------------------------------ | :----------------------------------------------------- | :--------------------------------------------------- |
| `id`                | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier, matches Clerk user ID.            |
| `email`             | `TEXT`                          | `NOT NULL`, `UNIQUE`                                   | User's email address.                                |
| `name`              | `TEXT`                          | `NULLABLE`                                             | User's display name.                                 |
| `image_url`         | `TEXT`                          | `NULLABLE`                                             | URL to user's profile image.                         |
| `subscription_plan` | `VARCHAR(50)`                   | `NOT NULL`, `DEFAULT 'FREE'`                           | Current subscription plan (e.g., 'FREE', 'PRO').     |
| `created_at`        | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of user creation.                          |
| `updated_at`        | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                               |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, text, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull(), // Clerk user ID
  email: text('email').unique().notNull(),
  name: text('name'),
  imageUrl: text('image_url'),
  subscriptionPlan: varchar('subscription_plan', { length: 50 }).notNull().default('FREE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.2. `projects` Table

Represents an uploaded long video and its associated processing metadata. Each `project` can generate multiple `short_videos`.

| Field Name               | Data Type                       | Constraints                                            | Description                                                              |
| :----------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                     | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for the project.                                       |
| `user_id`                | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`users.id`)                 | Creator of the project.                                                  |
| `original_video_url`     | `TEXT`                          | `NOT NULL`                                             | AWS S3 URL of the original long video.                                   |
| `video_filename`         | `VARCHAR(255)`                  | `NOT NULL`                                             | Original filename of the uploaded video.                                 |
| `video_filesize_bytes`   | `BIGINT`                        | `NOT NULL`                                             | Size of the video file in bytes.                                         |
| `status`                 | `VARCHAR(50)`                   | `NOT NULL`, `DEFAULT 'UPLOADING'`                      | Current processing status (`UPLOADING`, `UPLOADED`, `TRANSCRIBING`, `TRANSCRIBED`, `ANALYZING`, `GENERATING_CLIPS`, `READY`, `FAILED`). |
| `upload_progress_percentage` | `INT`                           | `NOT NULL`, `DEFAULT 0`                                | Real-time progress of video upload (0-100).                              |
| `transcription_text`     | `TEXT`                          | `NULLABLE`                                             | Full transcription text from Deepgram. Can be raw JSON or processed text. |
| `caption_data`           | `JSONB`                         | `NULLABLE`                                             | Structured caption data (e.g., array of objects with start/end time and text) from Deepgram. |
| `error_message`          | `TEXT`                          | `NULLABLE`                                             | Last encountered error message during processing.                        |
| `created_at`             | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of project creation.                                           |
| `updated_at`             | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, text, varchar, bigint, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  originalVideoUrl: text('original_video_url').notNull(),
  videoFilename: varchar('video_filename', { length: 255 }).notNull(),
  videoFilesizeBytes: bigint('video_filesize_bytes', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 50, enum: ['UPLOADING', 'UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'ANALYZING', 'GENERATING_CLIPS', 'READY', 'FAILED'] }).notNull().default('UPLOADING'),
  uploadProgressPercentage: integer('upload_progress_percentage').notNull().default(0),
  transcriptionText: text('transcription_text'), // Raw Deepgram output or processed text
  captionData: jsonb('caption_data'), // Deepgram SRT/VTT-like structure
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.3. `short_videos` Table

Stores metadata for each AI-generated short video clip.

| Field Name                   | Data Type                       | Constraints                                            | Description                                                              |
| :--------------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                         | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for the short video clip.                              |
| `project_id`                 | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`projects.id`)              | The long video project this clip belongs to.                             |
| `title`                      | `VARCHAR(255)`                  | `NULLABLE`                                             | AI-generated or user-edited title for the clip.                          |
| `description`                | `TEXT`                          | `NULLABLE`                                             | AI-generated or user-edited description for the clip.                    |
| `start_time_seconds`         | `DECIMAL(10,3)`                 | `NOT NULL`                                             | Start timestamp of the clip in the original video (seconds).             |
| `end_time_seconds`           | `DECIMAL(10,3)`                 | `NOT NULL`                                             | End timestamp of the clip in the original video (seconds).               |
| `seo_score`                  | `INT`                           | `NULLABLE`, `CHECK (seo_score BETWEEN 0 AND 100)`      | AI-assigned SEO score indicating potential virality.                     |
| `ai_reason_for_clip`         | `TEXT`                          | `NULLABLE`                                             | AI explanation of why this clip is engaging.                             |
| `generated_caption_text`     | `JSONB`                         | `NULLABLE`                                             | Caption data specifically for this short clip.                           |
| `current_caption_style_id`   | `UUID`                          | `NULLABLE`, `FOREIGN KEY` (`caption_styles.id`)        | The `caption_style` ID currently applied to this short video. Null if default. |
| `rendered_video_url`         | `TEXT`                          | `NULLABLE`                                             | AWS S3 URL of the fully rendered short video.                            |
| `render_status`              | `VARCHAR(50)`                   | `NOT NULL`, `DEFAULT 'PENDING'`                        | Current rendering status (`PENDING`, `RENDERING`, `RENDERED`, `FAILED`). |
| `is_edited_after_render`     | `BOOLEAN`                       | `NOT NULL`, `DEFAULT FALSE`                            | Flag indicating if the video was edited after its last successful render. |
| `created_at`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of clip generation.                                            |
| `updated_at`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, text, varchar, decimal, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { captionStyles } from './caption_styles';

export const shortVideos = pgTable('short_videos', {
  id: uuid('id').primaryKey().notNull(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  startTimeSeconds: decimal('start_time_seconds', { precision: 10, scale: 3 }).notNull(),
  endTimeSeconds: decimal('end_time_seconds', { precision: 10, scale: 3 }).notNull(),
  seoScore: integer('seo_score').$type<number>().check((score) => score >= 0 && score <= 100),
  aiReasonForClip: text('ai_reason_for_clip'),
  generatedCaptionText: jsonb('generated_caption_text'), // Caption data for this specific clip
  currentCaptionStyleId: uuid('current_caption_style_id').references(() => captionStyles.id),
  renderedVideoUrl: text('rendered_video_url'),
  renderStatus: varchar('render_status', { length: 50, enum: ['PENDING', 'RENDERING', 'RENDERED', 'FAILED'] }).notNull().default('PENDING'),
  isEditedAfterRender: boolean('is_edited_after_render').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.4. `caption_styles` Table

Stores user-defined or system-provided caption styling presets.

| Field Name           | Data Type                   | Constraints                                            | Description                                                              |
| :------------------- | :-------------------------- | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                 | `UUID`                      | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for the caption style.                                 |
| `user_id`            | `UUID`                      | `NULLABLE`, `FOREIGN KEY` (`users.id`)                 | Creator of the custom style. Null for system default styles.             |
| `name`               | `VARCHAR(100)`              | `NOT NULL`                                             | Display name of the caption style (e.g., 'Bold Yellow', 'Classic White'). |
| `font_family`        | `VARCHAR(100)`              | `NOT NULL`, `DEFAULT 'Arial'`                          | CSS font-family string.                                                  |
| `font_size_px`       | `INT`                       | `NOT NULL`, `DEFAULT 24`                               | Font size in pixels.                                                     |
| `text_color`         | `VARCHAR(7)`                | `NOT NULL`, `DEFAULT '#FFFFFF'`                        | Hex color code for the caption text (e.g., `#FFFFFF`).                   |
| `highlight_color`    | `VARCHAR(7)`                | `NOT NULL`, `DEFAULT '#FFFF00'`                        | Hex color code for the currently speaking word (e.g., `#FFFF00`).         |
| `background_color`   | `VARCHAR(7)`                | `NOT NULL`, `DEFAULT '#000000'`                        | Hex color code for the caption text background (e.g., `#000000`).        |
| `text_position`      | `VARCHAR(50)`               | `NOT NULL`, `DEFAULT 'BOTTOM_CENTER'`                  | Position of the caption on screen (`TOP_LEFT`, `BOTTOM_CENTER`, etc.).   |
| `max_display_words`  | `INT`                       | `NOT NULL`, `DEFAULT 3`                                | Maximum number of words to display for the caption at once.              |
| `is_system_default`  | `BOOLEAN`                   | `NOT NULL`, `DEFAULT FALSE`                            | True if this is a system-provided default style.                         |
| `created_at`         | `TIMESTAMP WITH TIME ZONE`  | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of style creation.                                             |
| `updated_at`         | `TIMESTAMP WITH TIME ZONE`  | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const captionStyles = pgTable('caption_styles', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id').references(() => users.id), // Nullable for system defaults
  name: varchar('name', { length: 100 }).notNull(),
  fontFamily: varchar('font_family', { length: 100 }).notNull().default('Arial'),
  fontSizePx: integer('font_size_px').notNull().default(24),
  textColor: varchar('text_color', { length: 7 }).notNull().default('#FFFFFF'),
  highlightColor: varchar('highlight_color', { length: 7 }).notNull().default('#FFFF00'),
  backgroundColor: varchar('background_color', { length: 7 }).notNull().default('#000000'),
  textPosition: varchar('text_position', { length: 50, enum: ['TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'MIDDLE_LEFT', 'MIDDLE_CENTER', 'MIDDLE_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT'] }).notNull().default('BOTTOM_CENTER'),
  maxDisplayWords: integer('max_display_words').notNull().default(3),
  isSystemDefault: boolean('is_system_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.5. `social_media_accounts` Table

Stores user's connected social media accounts for posting.

| Field Name           | Data Type                       | Constraints                                            | Description                                                              |
| :------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                 | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for the connected account.                             |
| `user_id`            | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`users.id`)                 | The user who connected this account.                                     |
| `platform`           | `VARCHAR(50)`                   | `NOT NULL`                                             | Social media platform (e.g., 'YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN'). |
| `platform_user_id`   | `TEXT`                          | `NOT NULL`                                             | Unique identifier from the social media platform for the user's profile. |
| `profile_name`       | `VARCHAR(255)`                  | `NULLABLE`                                             | Display name or handle of the connected social media profile.            |
| `access_token`       | `TEXT`                          | `NOT NULL`                                             | Encrypted OAuth access token for Jour API. **Sensitive data.**           |
| `refresh_token`      | `TEXT`                          | `NULLABLE`                                             | Encrypted OAuth refresh token.                                           |
| `token_expires_at`   | `TIMESTAMP WITH TIME ZONE`      | `NULLABLE`                                             | Timestamp when the access token expires.                                 |
| `created_at`         | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of account connection.                                         |
| `updated_at`         | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp (e.g., after token refresh).                       |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const socialMediaAccounts = pgTable('social_media_accounts', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  platform: varchar('platform', { length: 50, enum: ['YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN'] }).notNull(),
  platformUserId: text('platform_user_id').notNull(),
  profileName: varchar('profile_name', { length: 255 }),
  accessToken: text('access_token').notNull(), // Should be encrypted at rest
  refreshToken: text('refresh_token'),       // Should be encrypted at rest
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.6. `scheduled_posts` Table

Master record for a post scheduled by a user, referencing a `short_video`.

| Field Name                   | Data Type                       | Constraints                                            | Description                                                              |
| :--------------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                         | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for the scheduled post.                                |
| `user_id`                    | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`users.id`)                 | The user who scheduled this post.                                        |
| `short_video_id`             | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`short_videos.id`)          | The short video clip to be posted.                                       |
| `scheduled_publish_time`     | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`                                             | The exact date and time the post is scheduled to go live.                |
| `post_title_override`        | `VARCHAR(255)`                  | `NULLABLE`                                             | User-provided or AI-refined title for the social media post.             |
| `post_description_override`  | `TEXT`                          | `NULLABLE`                                             | User-provided or AI-refined description for the social media post.       |
| `ai_refinement_enabled`      | `BOOLEAN`                       | `NOT NULL`, `DEFAULT TRUE`                             | Flag indicating if AI should refine title/description before publishing. |
| `status`                     | `VARCHAR(50)`                   | `NOT NULL`, `DEFAULT 'PENDING'`                        | Overall status of the scheduled post (`PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED`). |
| `created_at`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of post creation.                                              |
| `updated_at`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { shortVideos } from './short_videos';

export const scheduledPosts = pgTable('scheduled_posts', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  shortVideoId: uuid('short_video_id').notNull().references(() => shortVideos.id),
  scheduledPublishTime: timestamp('scheduled_publish_time', { withTimezone: true }).notNull(),
  postTitleOverride: varchar('post_title_override', { length: 255 }),
  postDescriptionOverride: text('post_description_override'),
  aiRefinementEnabled: boolean('ai_refinement_enabled').notNull().default(true),
  status: varchar('status', { length: 50, enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'] }).notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.7. `post_social_media_links` Table

Links a `scheduled_post` to specific `social_media_accounts` and tracks its individual publishing status on each platform.

| Field Name                 | Data Type                       | Constraints                                            | Description                                                              |
| :------------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                       | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for the post-platform link.                            |
| `scheduled_post_id`        | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`scheduled_posts.id`)       | The scheduled post this link refers to.                                  |
| `social_media_account_id`  | `UUID`                          | `NOT NULL`, `FOREIGN KEY` (`social_media_accounts.id`) | The specific social media account where the post is targeted.            |
| `platform_post_id`         | `TEXT`                          | `NULLABLE`                                             | ID returned by the social media platform after successful publication.   |
| `publish_status`           | `VARCHAR(50)`                   | `NOT NULL`, `DEFAULT 'PENDING'`                        | Status of publishing on this specific platform (`PENDING`, `PUBLISHING`, `PUBLISHED`, `FAILED`). |
| `published_at`             | `TIMESTAMP WITH TIME ZONE`      | `NULLABLE`                                             | Actual time of publication on the platform.                              |
| `error_message`            | `TEXT`                          | `NULLABLE`                                             | Error message if publishing failed on this platform.                     |
| `jour_api_job_id`          | `TEXT`                          | `NULLABLE`                                             | Jour API's internal job ID for asynchronous posting.                     |
| `created_at`               | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of link creation.                                              |
| `updated_at`               | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { scheduledPosts } from './scheduled_posts';
import { socialMediaAccounts } from './social_media_accounts';

export const postSocialMediaLinks = pgTable('post_social_media_links', {
  id: uuid('id').primaryKey().notNull(),
  scheduledPostId: uuid('scheduled_post_id').notNull().references(() => scheduledPosts.id),
  socialMediaAccountId: uuid('social_media_account_id').notNull().references(() => socialMediaAccounts.id),
  platformPostId: text('platform_post_id'),
  publishStatus: varchar('publish_status', { length: 50, enum: ['PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED'] }).notNull().default('PENDING'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  jourApiJobId: text('jour_api_job_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.8. `ingest_job_status` Table

Tracks the detailed status of an Ingest workflow for a given `project`. This allows the application to poll for status updates and display progress to the user.

| Field Name                   | Data Type                       | Constraints                                            | Description                                                              |
| :--------------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `id`                         | `UUID`                          | `PRIMARY KEY`, `NOT NULL`                              | Unique identifier for this Ingest job status record.                     |
| `project_id`                 | `UUID`                          | `NOT NULL`, `UNIQUE`, `FOREIGN KEY` (`projects.id`)    | The project associated with this Ingest job. (One-to-one relationship)   |
| `ingest_job_id`              | `TEXT`                          | `NOT NULL`                                             | The ID assigned by the Ingest workflow platform.                         |
| `current_step`               | `VARCHAR(100)`                  | `NOT NULL`                                             | The current active step in the Ingest workflow (e.g., `UPLOAD_VIDEO`, `TRANSCRIBE_VIDEO`, `ANALYZE_SCENE`, `GENERATE_CLIPS`, `RENDER_SHORT_VIDEO`, `PUBLISH_SOCIAL_MEDIA`). |
| `overall_progress_percentage`| `INT`                           | `NOT NULL`, `DEFAULT 0`                                | Overall workflow progress (0-100).                                       |
| `step_status`                | `JSONB`                         | `NULLABLE`                                             | JSON object containing detailed status for each individual step (e.g., Deepgram `request_id`, Remotion `render_id`, progress for each). |
| `status`                     | `VARCHAR(50)`                   | `NOT NULL`, `DEFAULT 'PENDING'`                        | Overall status of the Ingest job (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELED`). |
| `error_message`              | `TEXT`                          | `NULLABLE`                                             | Any error message from the Ingest workflow.                              |
| `start_time`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp when the Ingest job started.                                   |
| `end_time`                   | `TIMESTAMP WITH TIME ZONE`      | `NULLABLE`                                             | Timestamp when the Ingest job completed or failed.                       |
| `last_polled_at`             | `TIMESTAMP WITH TIME ZONE`      | `NULLABLE`                                             | Timestamp of the last successful polling by the application.             |
| `created_at`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Timestamp of record creation.                                            |
| `updated_at`                 | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, uuid, text, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const ingestJobStatus = pgTable('ingest_job_status', {
  id: uuid('id').primaryKey().notNull(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }).unique(),
  ingestJobId: text('ingest_job_id').notNull(),
  currentStep: varchar('current_step', { length: 100, enum: ['UPLOAD_VIDEO', 'TRANSCRIBE_VIDEO', 'ANALYZE_SCENE', 'GENERATE_CLIPS', 'RENDER_SHORT_VIDEO', 'PUBLISH_SOCIAL_MEDIA'] }).notNull(),
  overallProgressPercentage: integer('overall_progress_percentage').notNull().default(0),
  stepStatus: jsonb('step_status'), // Detailed status for each Ingest step
  status: varchar('status', { length: 50, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED'] }).notNull().default('PENDING'),
  errorMessage: text('error_message'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp('end_time', { withTimezone: true }),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### 3.9. `system_config` Table

Stores global application configuration values that can be dynamically updated by administrators.

| Field Name              | Data Type                       | Constraints                                            | Description                                                              |
| :---------------------- | :------------------------------ | :----------------------------------------------------- | :----------------------------------------------------------------------- |
| `config_key`            | `VARCHAR(100)`                  | `PRIMARY KEY`, `NOT NULL`                              | Unique key for the configuration item (e.g., `MAX_VIDEOS_PER_DAY`, `DEFAULT_SHORT_CLIPS_COUNT`). |
| `config_value`          | `TEXT`                          | `NOT NULL`                                             | The value of the configuration item. Stored as text, parsed by application. |
| `description`           | `TEXT`                          | `NULLABLE`                                             | Description of the configuration item's purpose.                         |
| `last_updated_by_user_id`| `UUID`                          | `NULLABLE`, `FOREIGN KEY` (`users.id`)                 | User ID of the administrator who last updated this config.               |
| `updated_at`            | `TIMESTAMP WITH TIME ZONE`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`                | Last update timestamp.                                                   |

**Drizzle ORM Note:**
```typescript
import { pgTable, varchar, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const systemConfig = pgTable('system_config', {
  configKey: varchar('config_key', { length: 100 }).primaryKey().notNull(),
  configValue: text('config_value').notNull(),
  description: text('description'),
  lastUpdatedByUserId: uuid('last_updated_by_user_id').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

## 4. Relationships

*   **One-to-Many:**
    *   `users` to `projects` (A user can have multiple projects)
    *   `users` to `caption_styles` (A user can create multiple custom caption styles)
    *   `users` to `social_media_accounts` (A user can connect multiple social media accounts)
    *   `users` to `scheduled_posts` (A user can schedule multiple posts)
    *   `projects` to `short_videos` (A project generates multiple short videos)
    *   `scheduled_posts` to `post_social_media_links` (A scheduled post can target multiple social media accounts)
    *   `social_media_accounts` to `post_social_media_links` (An account can have multiple posts linked to it)
    *   `short_videos` to `scheduled_posts` (A short video can be scheduled multiple times, but a `scheduled_post` refers to one `short_video`)

*   **One-to-One:**
    *   `projects` to `ingest_job_status` (Each project has a single, main Ingest workflow tracking record)

*   **Many-to-One (implicit via FK):**
    *   `short_videos` to `caption_styles` (Many short videos can use the same caption style)
    *   `system_config` to `users` (A config item is updated by one user)

## 5. Indexing Strategy

To optimize query performance, especially for frequently accessed or filtered columns:

*   **`users`**:
    *   `idx_users_email` on `email` (for login/lookup)
*   **`projects`**:
    *   `idx_projects_user_id` on `user_id` (for fetching a user's projects)
    *   `idx_projects_status` on `status` (for filtering by processing status)
*   **`short_videos`**:
    *   `idx_short_videos_project_id` on `project_id` (for fetching clips for a project)
    *   `idx_short_videos_render_status` on `render_status` (for finding clips ready for download/rendering)
    *   `idx_short_videos_caption_style_id` on `current_caption_style_id` (for style lookup)
*   **`caption_styles`**:
    *   `idx_caption_styles_user_id` on `user_id` (for fetching user's custom styles)
    *   `idx_caption_styles_is_system_default` on `is_system_default` (for fetching system styles)
*   **`social_media_accounts`**:
    *   `idx_social_media_accounts_user_id` on `user_id` (for fetching a user's accounts)
    *   `idx_social_media_accounts_platform_user_id` on `platform_user_id`, `platform` (for quick lookup of specific platform accounts)
*   **`scheduled_posts`**:
    *   `idx_scheduled_posts_user_id` on `user_id` (for fetching a user's scheduled posts)
    *   `idx_scheduled_posts_short_video_id` on `short_video_id` (for finding posts related to a video)
    *   `idx_scheduled_posts_publish_time` on `scheduled_publish_time` (crucial for Ingest to pick up upcoming posts)
    *   `idx_scheduled_posts_status` on `status` (for filtering)
*   **`post_social_media_links`**:
    *   `idx_post_links_scheduled_post_id` on `scheduled_post_id`
    *   `idx_post_links_social_media_account_id` on `social_media_account_id`
    *   `idx_post_links_publish_status` on `publish_status`
*   **`ingest_job_status`**:
    *   `idx_ingest_status_project_id` on `project_id` (unique index to enforce 1-to-1 and for quick lookup)
    *   `idx_ingest_status_status` on `status` (for checking active/failed jobs)
    *   `idx_ingest_status_last_polled_at` on `last_polled_at` (for identifying stale polling)
*   **`system_config`**:
    *   `idx_system_config_key` on `config_key` (already PK, but explicit index is good practice).

## 6. Constraints

*   **Primary Keys:** All `id` fields are `PRIMARY KEY` and `NOT NULL`.
*   **Foreign Keys:** Enforce referential integrity between related tables.
    *   `onDelete: 'CASCADE'` where appropriate (e.g., deleting a `project` should cascade to `short_videos`, `ingest_job_status`).
    *   `onDelete: 'SET NULL'` for `user_id` in `caption_styles` if a user is deleted but their custom style might be referenced by other active short videos (unlikely if `short_videos` are also deleted, or if styles are copied).
*   **Unique Constraints:**
    *   `users.email` must be unique.
    *   `ingest_job_status.project_id` must be unique.
*   **NOT NULL Constraints:** Applied to essential fields that must always have a value.
*   **Check Constraints:**
    *   `short_videos.seo_score` must be between 0 and 100.
    *   `short_videos.start_time_seconds` and `end_time_seconds` should implicitly be positive and `end_time_seconds` > `start_time_seconds`.

## 7. Sample Records

### `users`
```json
[
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "image_url": "https://example.com/profiles/john.jpg",
    "subscription_plan": "PRO",
    "created_at": "2023-01-15T10:00:00Z",
    "updated_at": "2023-01-15T10:00:00Z"
  }
]
```

### `caption_styles`
```json
[
  {
    "id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    "user_id": null,
    "name": "Default Yellow Highlight",
    "font_family": "Montserrat",
    "font_size_px": 36,
    "text_color": "#FFFFFF",
    "highlight_color": "#FFFF00",
    "background_color": "#000000",
    "text_position": "BOTTOM_CENTER",
    "max_display_words": 4,
    "is_system_default": true,
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  },
  {
    "id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "John's Custom Green",
    "font_family": "Impact",
    "font_size_px": 48,
    "text_color": "#00FF00",
    "highlight_color": "#00FFFF",
    "background_color": "#1A1A1A",
    "text_position": "TOP_CENTER",
    "max_display_words": 3,
    "is_system_default": false,
    "created_at": "2023-02-01T14:30:00Z",
    "updated_at": "2023-02-01T14:30:00Z"
  }
]
```

### `projects`
```json
[
  {
    "id": "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "original_video_url": "https://s3.aws.com/vidshot-raw/john-motivation-long.mp4",
    "video_filename": "Motivational Speech Long.mp4",
    "video_filesize_bytes": 1234567890,
    "status": "READY",
    "upload_progress_percentage": 100,
    "transcription_text": "I don't care how good you are. I don't care how talented you are...",
    "caption_data": [
      {"start": 0.5, "end": 2.1, "text": "I don't care how good you are."},
      {"start": 2.5, "end": 4.0, "text": "I don't care how talented you are."}
    ],
    "error_message": null,
    "created_at": "2023-02-05T08:15:00Z",
    "updated_at": "2023-02-05T08:30:00Z"
  }
]
```

### `short_videos`
```json
[
  {
    "id": "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
    "project_id": "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
    "title": "Unstoppable Motivation",
    "description": "Short powerful clip to boost your day!",
    "start_time_seconds": 120.500,
    "end_time_seconds": 170.500,
    "seo_score": 92,
    "ai_reason_for_clip": "High emotional intensity, clear call to action.",
    "generated_caption_text": [
      {"start": 0.0, "end": 1.5, "text": "Never give up!"},
      {"start": 1.8, "end": 3.0, "text": "Keep pushing!"}
    ],
    "current_caption_style_id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    "rendered_video_url": "https://s3.aws.com/vidshot-rendered/john-motivation-short-1.mp4",
    "render_status": "RENDERED",
    "is_edited_after_render": false,
    "created_at": "2023-02-05T08:35:00Z",
    "updated_at": "2023-02-05T09:00:00Z"
  }
]
```

### `social_media_accounts`
```json
[
  {
    "id": "f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66",
    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "platform": "YOUTUBE",
    "platform_user_id": "UC_johndoe",
    "profile_name": "JohnDoe Motivation",
    "access_token": "ENCRYPTED_YOUTUBE_ACCESS_TOKEN",
    "refresh_token": "ENCRYPTED_YOUTUBE_REFRESH_TOKEN",
    "token_expires_at": "2023-03-01T12:00:00Z",
    "created_at": "2023-01-20T11:00:00Z",
    "updated_at": "2023-02-28T10:00:00Z"
  }
]
```

### `scheduled_posts`
```json
[
  {
    "id": "g6eebc99-9c0b-4ef8-bb6d-6bb9bd380a77",
    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "short_video_id": "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
    "scheduled_publish_time": "2023-03-01T15:00:00Z",
    "post_title_override": "Daily Dose of Motivation!",
    "post_description_override": "Get inspired with this quick clip. #motivation #shorts",
    "ai_refinement_enabled": true,
    "status": "PUBLISHED",
    "created_at": "2023-02-28T09:00:00Z",
    "updated_at": "2023-03-01T15:02:00Z"
  }
]
```

### `post_social_media_links`
```json
[
  {
    "id": "h7eebc99-9c0b-4ef8-bb6d-6bb9bd380a88",
    "scheduled_post_id": "g6eebc99-9c0b-4ef8-bb6d-6bb9bd380a77",
    "social_media_account_id": "f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66",
    "platform_post_id": "YT_post_ID_12345",
    "publish_status": "PUBLISHED",
    "published_at": "2023-03-01T15:01:30Z",
    "error_message": null,
    "jour_api_job_id": "jour_job_XYZ",
    "created_at": "2023-02-28T09:00:00Z",
    "updated_at": "2023-03-01T15:01:30Z"
  }
]
```

### `ingest_job_status`
```json
[
  {
    "id": "i8eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
    "project_id": "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
    "ingest_job_id": "ingest-job-12345",
    "current_step": "READY",
    "overall_progress_percentage": 100,
    "step_status": {
      "UPLOAD_VIDEO": {"status": "COMPLETED", "url": "https://s3.aws.com/vidshot-raw/john-motivation-long.mp4"},
      "TRANSCRIBE_VIDEO": {"status": "COMPLETED", "deepgram_id": "dg-abc-123"},
      "ANALYZE_SCENE": {"status": "COMPLETED", "gemini_model": "gemini-flash-2.0"},
      "GENERATE_CLIPS": {"status": "COMPLETED", "clip_count": 5}
    },
    "status": "COMPLETED",
    "error_message": null,
    "start_time": "2023-02-05T08:15:00Z",
    "end_time": "2023-02-05T08:30:00Z",
    "last_polled_at": "2023-02-05T08:30:00Z",
    "created_at": "2023-02-05T08:15:00Z",
    "updated_at": "2023-02-05T08:30:00Z"
  }
]
```

### `system_config`
```json
[
  {
    "config_key": "DEFAULT_SHORT_CLIPS_COUNT",
    "config_value": "5",
    "description": "Default number of short clips to generate per long video.",
    "last_updated_by_user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "updated_at": "2023-01-10T09:00:00Z"
  }
]
```

## 8. Optimization Notes

*   **`JSONB` for Flexible Schemas:** Use `JSONB` for `caption_data` (in `projects`), `generated_caption_text` (in `short_videos`), and `step_status` (in `ingest_job_status`) to allow for schema evolution without altering table structures. This is particularly useful for storing API responses from Deepgram, Gemini, or Ingest which might change over time.
*   **Indexing:** As detailed in Section 5, apply appropriate B-tree indexes to foreign keys and frequently queried columns to speed up read operations.
*   **Connection Pooling:** Utilize a connection pooler (e.g., PgBouncer) for Drizzle ORM to efficiently manage database connections, especially with serverless functions (Next.js API routes) that might open and close connections frequently.
*   **Read Replicas:** For high-traffic applications, consider read replicas to scale read operations horizontally. Neon DB inherently supports this with its branching model.
*   **Archiving Old Data:** Implement a strategy to archive or delete very old, completed `projects` and `short_videos` (and associated S3 data) that are no longer actively used, especially for free-tier users, to manage storage costs and improve query performance on active data.
*   **Denormalization (Selective):** For highly accessed, static data (e.g., `user_name` in `projects` table for display), a selective denormalization might be considered, but generally, stick to normalized forms for data integrity with Drizzle's `with` clause for joins.

## 9. Scalability Considerations

*   **Database (Neon PostgreSQL):** Neon's serverless architecture provides auto-scaling for compute and storage, making it suitable for varying workloads. Its branching feature can be used for development/staging environments without impacting production data.
*   **Cloud Storage (AWS S3):** S3 is highly scalable for video file storage, handling massive amounts of data and high concurrent access.
*   **Workflow Engine (Ingest):** Ingest is designed for distributed, long-running background jobs, offloading heavy processing from the Next.js server, preventing timeouts, and enabling complex, multi-step workflows to scale independently.
*   **Video Rendering (Remotion Lambda):** Remotion Lambda offloads video rendering to serverless AWS Lambda functions, which are highly scalable and cost-effective, processing render requests in parallel without taxing the main application server.
*   **API Gateways/Load Balancers:** As the application grows, deploy behind an API Gateway and load balancers to distribute traffic and handle increased request volume for Next.js API routes.
*   **Microservices (Future):** While currently a monolith, core functionalities like `Ingest` and `Remotion Lambda` already operate as separate services. For extreme scale, consider breaking down other modules (e.g., social media integration, analytics) into dedicated microservices.

## 10. Security Considerations

*   **Authentication (Clerk):** Leverages Clerk for secure user authentication, including MFA, session management, and social logins, reducing the burden of implementing these features securely.
*   **Authorization (Row-Level Security):** Implement row-level security (RLS) policies in PostgreSQL to ensure users can only access `projects`, `short_videos`, `social_media_accounts`, and `scheduled_posts` that belong to them (`user_id`).
*   **Sensitive Data Encryption:** `access_token` and `refresh_token` in `social_media_accounts` *must* be encrypted at rest in the database. Use environment variables for encryption keys.
*   **API Key Management:** All external API keys (Deepgram, Gemini, Jour, AWS, Ingest, Clerk, ARJet) must be stored securely as environment variables, not in code. Use AWS IAM roles for server-side access to AWS S3 and Lambda to avoid hardcoding credentials.
*   **Input Validation:** Strict input validation on all user-provided data (video filenames, captions, post titles) to prevent injection attacks and malformed data.
*   **ARJet Integration:**
    *   **Endpoint Abuse Protection:** Protects API endpoints from malicious or excessive calls.
    *   **Prompt Injection Detection:** Guards against attempts to manipulate AI models through malicious prompts (e.g., in `Gemini` input).
    *   **Rate Limiting:** Enforces limits on user actions (e.g., "only two video uploads per day") to prevent abuse and manage resource consumption. `ARJet` integration with Clerk user IDs helps track limits per user.
*   **AWS S3 Security:**
    *   **Bucket Policies:** Configure S3 bucket policies for `vidshot-raw` (for original videos) and `vidshot-rendered` (for output videos) to enforce least privilege access. Public read access for rendered videos should be controlled (e.g., pre-signed URLs or CDN).
    *   **CORS:** Properly configure CORS settings for S3 buckets to allow uploads from the Next.js frontend while preventing unauthorized access.
    *   **Pre-signed URLs:** Use pre-signed S3 URLs for direct client-side uploads (if not using Ingest for direct upload) and for time-limited, public access to private rendered videos.
*   **Server-Side Rendering (SSR)/API Route Security:** Ensure Next.js API routes are secured, validate session tokens, and prevent unauthorized access to sensitive logic.

## 11. Edge Cases and Error Handling

*   **Large Video Uploads:** Implement multi-part uploads to S3 for very large files and provide clear progress feedback. Ensure `next.config.ts` handles large body sizes for API routes.
*   **Failed External API Calls:**
    *   **Deepgram/Gemini/Jour:** Implement robust retry mechanisms (Ingest supports retries), exponential backoff, and fallbacks. Log errors extensively and provide user-friendly error messages.
    *   **Remotion Lambda:** Handle rendering failures, provide options to retry, and clearly communicate status to the user.
*   **Network Issues:** Implement client-side resilience (e.g., re-upload options, persistent progress display) and server-side timeouts for external calls.
*   **User Deleting Connected Social Media Accounts:** Gracefully handle revoked tokens and deletion of accounts on social media platforms (Jour webhooks could notify the application).
*   **Concurrency Conflicts:** Use database transactions for multi-step operations (e.g., updating project status and creating short videos) to maintain data consistency.
*   **Quota Limits (Deepgram/Gemini/Remotion):** Monitor API usage and implement error handling for hitting rate limits or exceeding usage quotas. Notify users if they hit application-level limits (enforced by ARJet).
*   **Data Consistency after External Failures:** If an Ingest step fails, ensure `ingest_job_status` and `projects.status` are updated to reflect `FAILED`, allowing administrators to investigate or users to retry.
*   **Client-side vs. Server-side Render Mismatch:** If a user edits a caption style *after* a video has been rendered and downloaded, `is_edited_after_render` flags this, forcing a re-render before subsequent downloads. This ensures the downloaded video reflects the latest edits.