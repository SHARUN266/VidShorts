# VidShot: AI-Powered Long Video to Short Video Generator Setup Guide

## 1. Introduction

VidShot is a full-stack SaaS application designed to transform long-form video content into engaging, viral short-form clips suitable for platforms like TikTok and Instagram Reels. Leveraging cutting-edge AI and cloud technologies, VidShot automates the entire content generation workflow, from identifying high-engagement moments and intelligent video cutting to caption generation, style editing, and multi-platform social media scheduling.

This document serves as a comprehensive setup and deployment guide for developers, QA engineers, and DevOps teams, providing detailed instructions for getting the VidShot application up and running in both local development and production environments.

## 2. Architecture Overview

VidShot employs a modern, serverless-first architecture designed for scalability, performance, and maintainability.

### 2.1. Core Components

*   **Frontend (Next.js App Router, React, Tailwind CSS, Shadcn UI):** Provides a responsive and intuitive user interface for video uploads, clip previews, editing, and scheduling. Utilizes Next.js Server Actions for direct interaction with backend logic and data.
*   **Backend (Next.js Server Actions, Drizzle ORM):** Handles API requests, interacts with the database, orchestrates external services, and manages application logic.
*   **Workflow Orchestration (Ingest.dev):** Manages long-running, asynchronous background jobs such as video transcription, AI analysis, and video rendering. Provides retry mechanisms and real-time status updates.
*   **Database (Neon PostgreSQL, Drizzle ORM):** A serverless PostgreSQL database for storing user profiles, project metadata, short video clip details (start/end times, captions, SEO scores), and scheduling information. Drizzle ORM provides a type-safe interface for database interactions.
*   **Cloud Storage (AWS S3):** Stores original long videos, rendered short videos, and any other necessary assets.
*   **Authentication (Clerk):** Manages user sign-up, sign-in, and session management, offering a robust, secure, and easily customizable authentication solution.
*   **Video Transcription (Deepgram):** Converts spoken audio from uploaded videos into text transcripts and generates captions (SRT format).
*   **AI Scene Analysis (Google Gemini AI):** Analyzes video transcripts to identify high-engagement moments, providing suggested clip start/end times, titles, descriptions, and SEO scores.
*   **Video Playback & Rendering (Remotion, Remotion Lambda):**
    *   **Remotion Player:** Client-side component for playing extracted short video segments based on start/end times directly in the browser without full video cutting.
    *   **Remotion Lambda:** Serverless AWS Lambda function for programmatically rendering final short videos with custom captions and styles, generating downloadable MP4 files.
*   **Social Media Scheduling (Jour.io):** A unified API for connecting to and scheduling posts across multiple social media platforms.
*   **Security & Abuse Protection (ARJet):** Protects the application from bot attacks, AI abuse, prompt injection, and implements rate limiting (e.g., video upload limits per user).

### 2.2. Architectural Diagram

```mermaid
C4Context
    title System Context Diagram for VidShot
    Person(user, "User", "Content Creator, Social Media Manager")
    System(vidshot, "VidShot Application", "AI-powered long video to short video generator and scheduler.")

    Rel(user, vidshot, "Uses", "Web Browser")

    System_Boundary(nextjs_boundary, "Next.js Application") {
        System(frontend, "Next.js Frontend", "React, Tailwind, Shadcn UI")
        System(server_actions, "Next.js Server Actions", "Backend Logic, Drizzle ORM")
        Rel(frontend, server_actions, "Triggers via API Calls")
    }

    System_Boundary(cloud_services, "Cloud Services") {
        System(aws_s3, "AWS S3", "Video Storage (Raw & Rendered)")
        System(aws_lambda, "AWS Lambda (Remotion)", "Video Rendering")
        System(neon_db, "Neon PostgreSQL", "Database (User, Project, Clip Data)")
        System(ingest_dev, "Ingest.dev", "Background Job & Workflow Orchestration")
    }

    System_Boundary(external_apis, "External APIs") {
        System(clerk_auth, "Clerk", "User Authentication & Session Management")
        System(deepgram, "Deepgram", "Video Transcription & Caption Generation")
        System(gemini_ai, "Google Gemini AI", "AI Scene Analysis & Content Generation")
        System(jour_io, "Jour.io", "Social Media Posting & Scheduling API")
        System(arjet, "ARJet", "AI Abuse, Bot Protection & Rate Limiting")
    }

    Rel(server_actions, aws_s3, "Stores/Retrieves Videos")
    Rel(server_actions, neon_db, "Persists Data")
    Rel(server_actions, ingest_dev, "Triggers workflows")
    Rel(server_actions, clerk_auth, "Authenticates Users")
    Rel(server_actions, arjet, "Checks security policies")

    Rel(ingest_dev, deepgram, "Sends Video URL for Transcription")
    Rel(ingest_dev, gemini_ai, "Sends Transcripts for Analysis")
    Rel(ingest_dev, aws_lambda, "Triggers video rendering")
    Rel(ingest_dev, jour_io, "Sends scheduled posts")
    Rel(ingest_dev, neon_db, "Updates project/clip status")
    Rel(aws_lambda, aws_s3, "Retrieves/Stores Video Assets")

    Rel(frontend, clerk_auth, "Authenticates UI Components")
    Rel(frontend, ingest_dev, "Polls for workflow status")
    Rel(frontend, aws_s3, "Direct Upload (Pre-signed URLs) Assumption:")
```

### 2.3. Data Entities

#### 2.3.1. User (from Clerk data)

*   `id`: `TEXT` (Clerk User ID) - Primary Key
*   `name`: `TEXT`
*   `email`: `TEXT`
*   `image_url`: `TEXT`
*   `subscription`: `TEXT` (e.g., 'free', 'pro') - Assumption: For managing feature access and rate limits.

#### 2.3.2. Project

*   `id`: `UUID` - Primary Key
*   `user_id`: `TEXT` (Foreign Key to User.id)
*   `original_video_url`: `TEXT` (AWS S3 URL of the uploaded long video)
*   `transcription`: `JSONB` (Full video transcription data from Deepgram)
*   `caption`: `JSONB` (Generated captions from Deepgram)
*   `status`: `TEXT` (e.g., 'uploading', 'transcribing', 'analyzing', 'ready')
*   `created_at`: `TIMESTAMP`
*   `updated_at`: `TIMESTAMP`

#### 2.3.3. ShortVideoClip

*   `id`: `UUID` - Primary Key
*   `project_id`: `UUID` (Foreign Key to Project.id)
*   `title`: `TEXT` (AI-generated title)
*   `description`: `TEXT` (AI-generated description)
*   `start_time_sec`: `INTEGER` (Start time in seconds for the clip)
*   `end_time_sec`: `INTEGER` (End time in seconds for the clip)
*   `reason`: `TEXT` (AI-generated reason for clip selection)
*   `seo_score`: `INTEGER` (AI-generated SEO score, 0-100)
*   `caption_data`: `JSONB` (Captions specific to this short clip)
*   `status`: `TEXT` (e.g., 'pending', 'rendered', 'scheduled', 'published')
*   `rendered_video_url`: `TEXT` (AWS S3 URL of the final rendered short video)
*   `style_config`: `JSONB` (JSON object containing selected caption style, font, color, etc.) - Assumption: For storing user-selected styles.
*   `scheduled_post_id`: `TEXT` (Jour.io Post ID, if scheduled) - Assumption: For tracking scheduled posts.
*   `created_at`: `TIMESTAMP`
*   `updated_at`: `TIMESTAMP`

#### 2.3.4. SocialMediaConnection (Assumption: for Jour.io integration)

*   `id`: `UUID` - Primary Key
*   `user_id`: `TEXT` (Foreign Key to User.id)
*   `platform`: `TEXT` (e.g., 'TikTok', 'Instagram', 'YouTube', 'Facebook')
*   `account_id`: `TEXT` (Platform-specific account identifier)
*   `access_token`: `TEXT` (Encrypted token for platform access)
*   `refresh_token`: `TEXT` (Encrypted token for platform refresh)
*   `expires_at`: `TIMESTAMP`
*   `created_at`: `TIMESTAMP`

#### 2.3.5. ScheduledPost (Assumption: For tracking scheduled posts before Jour.io triggers)

*   `id`: `UUID` - Primary Key
*   `short_video_clip_id`: `UUID` (Foreign Key to ShortVideoClip.id)
*   `user_id`: `TEXT` (Foreign Key to User.id)
*   `platform_connections`: `UUID[]` (Array of Foreign Keys to SocialMediaConnection.id)
*   `title`: `TEXT` (Post title)
*   `description`: `TEXT` (Post description)
*   `scheduled_at`: `TIMESTAMP` (Desired publish time)
*   `status`: `TEXT` (e.g., 'pending', 'processing', 'published', 'failed')
*   `jour_post_ids`: `TEXT[]` (Array of Jour.io post IDs, one per platform) - Assumption: Jour.io might return multiple IDs.
*   `created_at`: `TIMESTAMP`
*   `updated_at`: `TIMESTAMP`

## 3. Prerequisites

Before you begin, ensure you have the following installed and configured on your development machine:

### 3.1. Software

*   **Node.js:** v18.x or higher (LTS recommended)
*   **npm:** v9.x or higher (comes with Node.js) or **Yarn:** v1.x or higher (if preferred)
*   **Git:** Latest version
*   **IDE:** Google Anti-Gravity (recommended, free access to Gemini model integration) or Visual Studio Code (with Copilot/Codeium/Cleanbot extensions for AI assistance).
*   **AWS CLI:** (Optional, but recommended for managing AWS resources from the terminal)

### 3.2. Accounts & Services

*   **AWS Account:** For S3 (video storage) and Lambda (Remotion rendering).
*   **Clerk Account:** For user authentication.
*   **Neon Account:** For PostgreSQL database.
*   **Deepgram Account:** For video transcription and captioning.
*   **Google Cloud / Gemini API Console Access:** For Google Gemini AI model.
*   **Jour.io Account:** For social media scheduling.
*   **ARJet Account:** For application security, bot protection, and rate limiting.
*   **Ingest.dev Account:** For workflow orchestration and background jobs.

## 4. Environment Setup

### 4.1. Initialize Next.js Project

The VidShot application is built on Next.js. Start by creating a new Next.js project.

1.  Open your terminal or command prompt.
2.  Execute the following command to create a new Next.js application with the recommended settings (TypeScript, React Compiler, Tailwind CSS, App Router).

    ```bash
    npx create-next-app@latest
    ```

3.  Follow the prompts:
    *   `Would you like to use TypeScript?` **Yes**
    *   `Would you like to use ESLint?` **Yes**
    *   `Would you like to use Tailwind CSS?` **Yes**
    *   `Would you like to use `src/` directory?` **No** (as per transcript for simplicity)
    *   `Would you like to use App Router? (recommended)` **Yes**
    *   `Would you like to customize the default import alias (@/*)?` **No**
    *   `What is your project name?` `long-to-short-video` (or `vidshot`)

4.  Navigate into your newly created project directory:

    ```bash
    cd long-to-short-video
    ```

### 4.2. Install Shadcn UI

Shadcn UI provides pre-built, customizable UI components for a consistent design system.

1.  Initialize Shadcn UI in your project:

    ```bash
    npx shadcn-ui@latest init
    ```

2.  Follow the prompts for configuration:
    *   `Would you like to use TypeScript?` **Yes**
    *   `Which style would you like to use?` `Base` (recommended by transcript)
    *   `Which color would you like to use as base color?` `Slate` (or your preference)
    *   `Do you want to use CSS variables for colors?` **Yes**
    *   `Where is your global CSS file?` `app/global.css`
    *   `Would you like to use Tailwind CSS with the new @tailwind directive?` **Yes**
    *   `Configure the import alias for components:` `@/components`
    *   `Configure the import alias for utils:` `@/lib/utils`
    *   `Are you using React Server Components?` **Yes**
    *   `Do you want to customize the generated components?` **No**

3.  Install all available Shadcn UI components:

    ```bash
    npx shadcn-ui@latest add all
    ```

    *   Confirm by typing `a` and pressing Enter to add all components.

## 5. Installation Steps

Install the core dependencies for VidShot.

```bash
# Core Next.js, React, Tailwind are already installed via create-next-app

# Database ORM
npm install drizzle-orm pg

# Authentication
npm install @clerk/nextjs

# Cloud Storage
npm install @aws-sdk/client-s3

# Video Transcription
npm install @deepgram/sdk

# AI Scene Analysis
npm install @google/generative-ai

# Workflow Orchestration
npm install @ingest-dev/sdk

# Video Playback & Rendering
npm install @remotion/player @remotion/lambda @remotion/core
# Assumption: The transcript mentions @remotion/lambda but implies core features are also used.

# Security & Abuse Protection
npm install arjet

# Social Media API (Assumption: Jour.io would have an SDK)
# npm install @jour-io/sdk # Placeholder, replace with actual SDK if available
```

### 5.1. Drizzle ORM Setup

After installing `drizzle-orm` and `pg`, you'll need to generate configuration and schema files.

1.  **Initialize Drizzle Kit:**
    ```bash
    npx drizzle-kit init
    ```
    This will create `drizzle.config.ts` and `drizzle/schema.ts`.

2.  **Define Schema:**
    Edit `drizzle/schema.ts` to define your database tables as described in Section 2.3.
    (See example in Section 8.1 Database Schema).

### 5.2. Ingest.dev Setup

Ingest.dev requires specific setup for local development.

1.  Ensure `@ingest-dev/sdk` is installed.
2.  Create an `ingest` directory in your project root.
3.  Create `ingest/function.ts` for your Ingest workflow definitions.
    (See example in Section 8.4 Ingest Workflow).

### 5.3. Remotion Lambda Setup

Remotion Lambda requires a dedicated `remotion` folder for compositions.

1.  Create a `remotion` directory in your project root.
2.  Inside `remotion`, create an `index.ts` (or `index.tsx`) file to define your Remotion compositions.
    (See example in Section 8.6 Remotion Compositions).

## 6. Environment Variables

Create a `.env.local` file in your project root and populate it with the following environment variables. **Never commit this file to version control.**

| Variable Name                | Description                                                | Source / How to Obtain                                                                                                                    | Example Value                                        |
| :--------------------------- | :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Frontend Publishable Key                             | Clerk Dashboard -> API Keys                                                                                                               | `pk_live_XXXXXXXXXXXXXXXXXXXX`                       |
| `CLERK_SECRET_KEY`           | Clerk Backend Secret Key                                   | Clerk Dashboard -> API Keys                                                                                                               | `sk_live_XXXXXXXXXXXXXXXXXXXX`                       |
| `DATABASE_URL`               | Neon PostgreSQL connection string                          | Neon Dashboard -> Project -> Connection Details                                                                                           | `postgres://user:pass@host:port/db?sslmode=require`  |
| `AWS_ACCESS_KEY_ID`          | AWS IAM User Access Key ID                                 | AWS Console -> IAM -> Users -> YourUser -> Security credentials -> Create access key                                                    | `AKIXXXXXXXXXXXXXXXXXXX`                             |
| `AWS_SECRET_ACCESS_KEY`      | AWS IAM User Secret Access Key                             | AWS Console -> IAM -> Users -> YourUser -> Security credentials -> Create access key (only visible once)                                | `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`           |
| `AWS_REGION`                 | AWS region for S3 bucket and Lambda                        | AWS Console (e.g., `us-east-1`, `ap-south-1`)                                                                                             | `us-east-1`                                          |
| `AWS_S3_BUCKET_NAME`         | Name of your S3 bucket for video storage                   | AWS S3 Console -> Buckets                                                                                                                 | `vidshot-media-storage`                              |
| `DEEPGRAM_API_KEY`           | Deepgram API Key                                           | Deepgram Console -> API Keys                                                                                                              | `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`           |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Google Gemini API Key                                      | Google AI Studio -> Get API Key                                                                                                           | `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX`                 |
| `INGEST_DEV`                 | Set to `1` for local Ingest.dev development                | `1` (for local dev)                                                                                                                       | `1`                                                  |
| `INGEST_APP_KEY`             | Ingest.dev App Key (for cloud deployment)                  | Ingest.dev Dashboard (generated when you create an app)                                                                                   | `app_XXXXXXXXXXXXXXXXXXXX`                           |
| `INGEST_PRIVATE_KEY`         | Ingest.dev Private Key (for cloud deployment)              | Ingest.dev Dashboard (generated when you create an app)                                                                                   | `pk_XXXXXXXXXXXXXXXXXXXX`                            |
| `ARJET_KEY`                  | ARJet API Key                                              | ARJet Dashboard -> Sites -> YourSite -> API Key                                                                                           | `aj_XXXXXXXXXXXXXXXXXXXXXXXXXXXX`                   |
| `REMOTION_AWS_FUNCTION_NAME` | Remotion Lambda function name                              | After `npx remotion lambda deploy` (e.g., `remotion-render-function`)                                                                     | `remotion-render-function`                           |
| `REMOTION_AWS_SITE_URL`      | Remotion Lambda site URL (for compositions)                | After `npx remotion deploy` (e.g., `https://XXXXXXXX.cloudfront.net/`)                                                                    | `https://dXXXXXXXXXXXXX.cloudfront.net`              |
| `JOUR_API_KEY`               | Jour.io API Key                                            | Jour.io Dashboard (Assumption: not explicitly mentioned but standard for third-party services)                                            | `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`           |

## 7. Database Setup

VidShot uses Neon for PostgreSQL and Drizzle ORM for database interactions.

### 7.1. Neon PostgreSQL Configuration

1.  **Create Neon Account:** Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2.  **Create a Project:** In the Neon dashboard, create a new project.
3.  **Create a Database:** Within your project, create a new database (e.g., `vidshot_dev`).
4.  **Obtain Connection String:** Copy the `Connection String` for your database. This will be your `DATABASE_URL` environment variable. Ensure the password contains URL-safe characters or is properly encoded.

### 7.2. Drizzle ORM Schema & Migrations

The database schema is defined in `drizzle/schema.ts`.

1.  **Define Schema (e.g., `drizzle/schema.ts`):**

    ```typescript
    import { pgTable, text, timestamp, uuid, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
    import { relations } from 'drizzle-orm';

    export const users = pgTable('users', {
      id: text('id').primaryKey(), // Clerk user ID
      name: text('name').notNull(),
      email: text('email').notNull().unique(),
      imageUrl: text('image_url'),
      subscription: text('subscription').default('free').notNull(), // 'free', 'pro'
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    export const usersRelations = relations(users, ({ many }) => ({
      projects: many(projects),
      socialMediaConnections: many(socialMediaConnections),
      scheduledPosts: many(scheduledPosts),
    }));

    export const projects = pgTable('projects', {
      id: uuid('id').defaultRandom().primaryKey(),
      userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      originalVideoUrl: text('original_video_url').notNull(),
      transcription: jsonb('transcription'), // Full transcription from Deepgram
      caption: jsonb('caption'), // Generated captions from Deepgram
      status: text('status').default('uploading').notNull(), // 'uploading', 'transcribing', 'analyzing', 'ready'
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    export const projectsRelations = relations(projects, ({ one, many }) => ({
      user: one(users, {
        fields: [projects.userId],
        references: [users.id],
      }),
      shortVideoClips: many(shortVideoClips),
    }));

    export const shortVideoClips = pgTable('short_video_clips', {
      id: uuid('id').defaultRandom().primaryKey(),
      projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
      title: text('title'), // AI-generated title
      description: text('description'), // AI-generated description
      startTimeSec: integer('start_time_sec').notNull(),
      endTimeSec: integer('end_time_sec').notNull(),
      reason: text('reason'), // AI-generated reason for clip selection
      seoScore: integer('seo_score'), // AI-generated SEO score
      captionData: jsonb('caption_data'), // Captions specific to this short clip
      status: text('status').default('pending').notNull(), // 'pending', 'rendered', 'scheduled', 'published'
      renderedVideoUrl: text('rendered_video_url'), // AWS S3 URL of the final rendered short video
      styleConfig: jsonb('style_config'), // JSON object for caption style, font, color
      isEdited: boolean('is_edited').default(false).notNull(), // To track if video was edited after rendering
      scheduledPostId: text('scheduled_post_id'), // Jour.io Post ID, if scheduled
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    export const shortVideoClipsRelations = relations(shortVideoClips, ({ one, many }) => ({
      project: one(projects, {
        fields: [shortVideoClips.projectId],
        references: [projects.id],
      }),
      scheduledPosts: many(scheduledPosts),
    }));

    // Assumption: For Jour.io integration and social media connections
    export const socialMediaConnections = pgTable('social_media_connections', {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        platform: text('platform').notNull(), // e.g., 'TikTok', 'Instagram', 'YouTube'
        accountId: text('account_id').notNull(), // Platform-specific account ID
        accessToken: text('access_token').notNull(), // Encrypted token
        refreshToken: text('refresh_token'), // Encrypted token
        expiresAt: timestamp('expires_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    });

    export const socialMediaConnectionsRelations = relations(socialMediaConnections, ({ one }) => ({
        user: one(users, {
            fields: [socialMediaConnections.userId],
            references: [users.id],
        }),
    }));

    // Assumption: For tracking scheduled posts before Jour.io triggers
    export const scheduledPosts = pgTable('scheduled_posts', {
        id: uuid('id').defaultRandom().primaryKey(),
        shortVideoClipId: uuid('short_video_clip_id').notNull().references(() => shortVideoClips.id, { onDelete: 'cascade' }),
        userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        platformConnections: jsonb('platform_connections').notNull(), // Array of connection IDs
        title: text('title').notNull(),
        description: text('description'),
        scheduledAt: timestamp('scheduled_at').notNull(),
        status: text('status').default('pending').notNull(), // 'pending', 'processing', 'published', 'failed'
        jourPostIds: jsonb('jour_post_ids'), // Array of Jour.io post IDs
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    export const scheduledPostsRelations = relations(scheduledPosts, ({ one }) => ({
        shortVideoClip: one(shortVideoClips, {
            fields: [scheduledPosts.shortVideoClipId],
            references: [shortVideoClips.id],
        }),
        user: one(users, {
            fields: [scheduledPosts.userId],
            references: [users.id],
        }),
    }));
    ```

2.  **Push Schema to Database:**
    Every time you modify `drizzle/schema.ts`, run this command to update your database.

    ```bash
    npx drizzle-kit push:pg
    ```

3.  **Access Drizzle Studio (Optional):**
    To visually inspect your database and data:

    ```bash
    npx drizzle-kit studio
    ```
    This will open a web interface in your browser (usually `http://localhost:2000`).

## 8. Core Component Configuration & Integration

### 8.1. Clerk Authentication

Clerk provides a robust authentication solution with pre-built UI components.

1.  **Clerk Application Setup:**
    *   Go to [Clerk.com](https://clerk.com/) and create an account.
    *   In the dashboard, create a new application (e.g., `VidShot App`).
    *   Enable desired social login providers (Google, GitHub, etc.).
    *   Copy the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` and add them to your `.env.local` file.

2.  **Next.js Integration:**
    *   **`middleware.ts`:** Protect routes and configure public paths.

        ```typescript
        import { authMiddleware } from "@clerk/nextjs";

        export default authMiddleware({
          publicRoutes: ["/", "/api/webhooks(.*)", "/api/ingest(.*)"], // Adjust as needed
        });

        export const config = {
          matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/(api|trpc)(.*)"],
        };
        ```
        *   **Assumption:** `/api/webhooks` for future integrations (e.g., Stripe, Ingest webhooks).
        *   **Assumption:** `/api/ingest` for Ingest.dev webhook to communicate with Next.js Server Actions.

    *   **`app/layout.tsx`:** Wrap your application with `ClerkProvider`.

        ```typescript
        import { ClerkProvider } from '@clerk/nextjs';
        import './globals.css';

        export default function RootLayout({ children }: { children: React.ReactNode }) {
          return (
            <ClerkProvider>
              <html lang="en">
                <body>{children}</body>
              </html>
            </ClerkProvider>
          );
        }
        ```

    *   **Sign-in/Sign-up Pages:**
        Create `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` using Clerk's built-in components.

        ```typescript
        // app/sign-in/[[...sign-in]]/page.tsx
        import { SignIn } from "@clerk/nextjs";

        export default function Page() {
          return <SignIn />;
        }
        ```
        ```typescript
        // app/sign-up/[[...sign-up]]/page.tsx
        import { SignUp } from "@clerk/nextjs";

        export default function Page() {
          return <SignUp />;
        }
        ```

    *   **User Information to Database:**
        Implement a Server Action or API route to check if a user exists in your `users` table after sign-in/sign-up and save their details.
        **Assumption:** This typically happens in a `User` management server action that is called from the client-side after successful authentication.

        ```typescript
        // lib/actions/user.ts
        'use server';

        import { currentUser } from "@clerk/nextjs";
        import { db } from '@/drizzle/db'; // Your Drizzle DB client
        import { users } from '@/drizzle/schema';
        import { eq } from 'drizzle-orm';

        export async function ensureUserInDatabase() {
          const clerkUser = await currentUser();

          if (!clerkUser) {
            throw new Error("User not authenticated.");
          }

          const existingUser = await db.query.users.findFirst({
            where: eq(users.id, clerkUser.id),
          });

          if (!existingUser) {
            await db.insert(users).values({
              id: clerkUser.id,
              name: clerkUser.firstName || clerkUser.username || "New User",
              email: clerkUser.emailAddresses[0].emailAddress,
              imageUrl: clerkUser.imageUrl,
              // subscription: 'free' // Defaulted in schema
            });
            console.log(`New user ${clerkUser.id} added to database.`);
          }
          return existingUser;
        }
        ```
        Call `ensureUserInDatabase()` on relevant dashboard pages or `layout.tsx` when `clerkUser` is available.

### 8.2. AWS S3 Integration

AWS S3 is used for storing raw and rendered videos.

1.  **Create S3 Bucket:**
    *   Go to the AWS S3 console.
    *   Click "Create bucket".
    *   Provide a unique `AWS_S3_BUCKET_NAME` and select your `AWS_REGION`.
    *   **Block Public Access settings:** For production, it's recommended to keep "Block all public access" enabled and manage access via pre-signed URLs or IAM roles. For development/testing, you might temporarily disable it, but understand the security implications.
2.  **Configure CORS Policy:**
    For direct browser uploads, you need to configure CORS on your S3 bucket.
    *   Select your bucket -> `Permissions` tab -> `Cross-origin resource sharing (CORS)`.
    *   Add the following policy (replace `http://localhost:3000` with your actual domain(s) in production):

    ```json
    [
        {
            "AllowedHeaders": [
                "*"
            ],
            "AllowedMethods": [
                "PUT",
                "POST",
                "DELETE"
            ],
            "AllowedOrigins": [
                "http://localhost:3000",
                "https://your-production-domain.com"
            ],
            "ExposeHeaders": []
        },
        {
            "AllowedHeaders": [
                "*"
            ],
            "AllowedMethods": [
                "GET"
            ],
            "AllowedOrigins": [
                "*"
            ],
            "ExposeHeaders": []
        }
    ]
    ```
    *   The `GET` rule with `*` for `AllowedOrigins` allows public access to objects for playback, which is needed for Remotion Player. Adjust based on your security requirements.
3.  **IAM User & Credentials:**
    *   Go to AWS IAM console.
    *   Create a new IAM user (e.g., `vidshot-s3-upload`).
    *   Grant this user **programmatic access** and attach policies like `AmazonS3FullAccess` (for development) or a custom policy with granular `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` permissions for production.
    *   Generate `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for this user.
    *   **Security Note:** Never expose `AWS_SECRET_ACCESS_KEY` on the client-side. Use pre-signed URLs for direct client uploads or handle uploads via a secure backend endpoint.

### 8.3. Deepgram Transcription

Deepgram is used for converting speech to text and generating captions.

1.  **Deepgram Account & API Key:**
    *   Go to [Deepgram.com](https://deepgram.com/) and create an account.
    *   Obtain your `DEEPGRAM_API_KEY` from the Deepgram Console.
2.  **Integration:**
    Deepgram integration will primarily happen within an Ingest function, where the uploaded video URL is sent for transcription.

    ```typescript
    // Example Deepgram SDK usage (within Ingest function)
    import { createClient } from "@deepgram/sdk";

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY as string);

    // ... inside an Ingest step function
    async function transcribeVideo(videoUrl: string) {
      const { result, error } = await deepgram.listen.prerecorded.url(
        videoUrl,
        {
          smart_format: true,
          model: "nova-2", // Or another preferred model
          detect_language: true,
          paragraphs: true,
          captions: true, // Generate SRT captions
        }
      );

      if (error) {
        throw new Error(`Deepgram transcription failed: ${error.message}`);
      }

      const transcription = result?.results[0]?.channels[0]?.alternatives[0];
      // Process transcription.paragraphs and transcription.captions
      return { transcription, captions: result?.results[0]?.channels[0]?.alternatives[0]?.paragraphs?.paragraphs, srtCaptions: result?.results[0]?.channels[0]?.alternatives[0]?.paragraphs?.paragraphs.map(p => ({ text: p.sentences.map(s => s.text).join(' '), start: p.start, end: p.end })) }; // Simplified
    }
    ```

### 8.4. Google Gemini AI Analysis

Gemini AI is used for identifying engaging moments from video transcripts.

1.  **Google AI Studio & API Key:**
    *   Go to [AI Studio](https://aistudio.google.com/) and log in with your Google account.
    *   Create a new API key. This will be your `NEXT_PUBLIC_GEMINI_API_KEY`.
    *   **Security Note:** `NEXT_PUBLIC_` prefix means this key is exposed to the client. For server-side AI calls, it's safer to use an API key that is *not* public (e.g., `GEMINI_API_KEY` without `NEXT_PUBLIC_`). The transcript uses `NEXT_PUBLIC_GEMINI_API_KEY` for server-side calls, which should be protected in production environments. It's safer to only make AI calls from secure server actions or Ingest functions.
2.  **Model Selection:**
    The transcript mentions `Gemini 2.0 Flash` or `Flash Preview`. You can select models from AI Studio.
    *   Create `config/gemini.ts` to configure the AI client:

    ```typescript
    // config/gemini.ts
    import { GoogleGenerativeAI } from "@google/generative-ai";

    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY; // Using public for demo, use server-side for production!

    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);

    export const getGeminiModel = (modelName: string = "gemini-1.5-flash") => {
      return genAI.getGenerativeModel({ model: modelName });
    };
    ```
3.  **Prompt Engineering:**
    The core of AI analysis is a well-crafted prompt.

    ```typescript
    // Example prompt (within Ingest function)
    async function analyzeTranscriptWithAI(transcript: string) {
      const model = getGeminiModel("gemini-1.5-flash"); // Use configured model
      const prompt = `
        You are an expert video content analyst. Analyze the following video transcript
        and identify 4-5 high-engagement moments suitable for short-form viral videos (30-90 seconds each).
        For each moment, provide:
        - "title": A catchy title for the short clip.
        - "description": A brief, engaging description.
        - "startTimeSec": The exact start time in seconds.
        - "endTimeSec": The exact end time in seconds.
        - "reason": A brief explanation why this clip is highly engaging.
        - "seoScore": An SEO score from 0-100 indicating viral potential.
        - "caption_data": The specific caption text for this clip.

        Return the response as a JSON array of objects.
        Transcript: """${transcript}"""
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      // Parse text as JSON and validate
      return JSON.parse(text);
    }
    ```

### 8.5. Ingest.dev Workflow Orchestration

Ingest.dev manages long-running tasks and complex workflows.

1.  **Ingest App Key:**
    *   Go to [Ingest.dev](https://ingest.dev/) and sign up.
    *   Create a new application. This will give you `INGEST_APP_KEY` and `INGEST_PRIVATE_KEY`.
    *   For local development, set `INGEST_DEV=1` in `.env.local`.
2.  **`ingest/function.ts`:**
    This file defines your Ingest workflows.

    ```typescript
    // ingest/function.ts
    import { Ingest, step } from "@ingest-dev/sdk";
    import { uploadToS3 } from '@/lib/aws-s3-client'; // Your S3 upload logic
    import { transcribeVideo } from '@/lib/deepgram-client'; // Your Deepgram client
    import { analyzeTranscriptWithAI } from '@/lib/gemini-client'; // Your Gemini client
    import { renderVideoWithRemotion } from '@/lib/remotion-client'; // Your Remotion rendering client
    import { schedulePostWithJour } from '@/lib/jour-client'; // Your Jour.io client
    import { db } from '@/drizzle/db';
    import { projects, shortVideoClips, scheduledPosts } from '@/drizzle/schema';
    import { eq } from 'drizzle-orm';

    const ingest = new Ingest();

    // Assumption: Next.js Server Actions would trigger Ingest via client.sendEvent()
    export const videoProcessingWorkflow = ingest.createWorkflow("video.process", async (io, input: { projectId: string, videoUrl: string, userId: string }) => {
      const { projectId, videoUrl, userId } = input;

      await io.sendEvent('update.project.status', { projectId, status: 'transcribing' });
      const { transcription, captions } = await step.run("transcribe-video", async () => {
        return transcribeVideo(videoUrl);
      });

      await io.sendEvent('update.project.status', { projectId, status: 'analyzing_ai', transcription, captions });
      const aiClips = await step.run("analyze-with-ai", async () => {
        return analyzeTranscriptWithAI(transcription.text);
      });

      // Save AI generated clip metadata to DB
      await step.run("save-ai-clips", async () => {
        const generatedShortClips = aiClips.map((clip: any) => ({
          projectId,
          title: clip.title,
          description: clip.description,
          startTimeSec: clip.startTimeSec,
          endTimeSec: clip.endTimeSec,
          reason: clip.reason,
          seoScore: clip.seoScore,
          captionData: clip.caption_data,
          status: 'pending',
        }));
        await db.insert(shortVideoClips).values(generatedShortClips);
      });

      await io.sendEvent('update.project.status', { projectId, status: 'ready' });

      return { aiClips };
    });

    // Workflow to render a single short video clip
    export const renderShortVideoWorkflow = ingest.createWorkflow("video.render.short", async (io, input: { shortVideoClipId: string, projectId: string }) => {
      const { shortVideoClipId, projectId } = input;

      await io.sendEvent('update.clip.status', { shortVideoClipId, status: 'rendering', progress: 0 });

      const clip = await step.run("fetch-clip-details", async () => {
        return db.query.shortVideoClips.findFirst({
          where: eq(shortVideoClips.id, shortVideoClipId),
        });
      });
      const project = await step.run("fetch-project-details", async () => {
        return db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });
      });

      if (!clip || !project) {
        throw new Error("Clip or Project not found for rendering.");
      }

      const { renderUrl, progress } = await step.run("render-video", async (ctx) => {
        // Remotion Lambda render function, polls for progress
        const { url } = await renderVideoWithRemotion(
          project.originalVideoUrl,
          clip.startTimeSec,
          clip.endTimeSec,
          clip.captionData,
          clip.styleConfig,
          (prog) => ctx.sendEvent('update.clip.status', { shortVideoClipId, status: 'rendering', progress: prog })
        );
        return { renderUrl: url };
      });

      await step.run("save-rendered-url", async () => {
        await db.update(shortVideoClips)
          .set({ renderedVideoUrl: renderUrl, status: 'rendered', updatedAt: new Date() })
          .where(eq(shortVideoClips.id, shortVideoClipId));
      });

      await io.sendEvent('update.clip.status', { shortVideoClipId, status: 'rendered', renderedVideoUrl: renderUrl });

      return { renderedVideoUrl: renderUrl };
    });

    // Workflow for social media scheduling
    export const socialMediaSchedulingWorkflow = ingest.createWorkflow("social.schedule.post", async (io, input: { scheduledPostId: string }) => {
      const { scheduledPostId } = input;

      const postDetails = await step.run("fetch-post-details", async () => {
        return db.query.scheduledPosts.findFirst({
          where: eq(scheduledPosts.id, scheduledPostId),
          with: { shortVideoClip: true, user: true }
        });
      });

      if (!postDetails || !postDetails.shortVideoClip?.renderedVideoUrl) {
        throw new Error("Scheduled post or rendered video URL not found.");
      }

      await io.sendEvent('update.scheduled.post.status', { scheduledPostId, status: 'processing' });

      // Assuming postDetails.platformConnections is an array of connection IDs
      const postResults = await step.run("publish-to-jour", async () => {
        return schedulePostWithJour(
          postDetails.shortVideoClip.renderedVideoUrl,
          postDetails.title,
          postDetails.description,
          postDetails.scheduledAt,
          postDetails.platformConnections // Need to fetch actual connection details
        );
      });

      await step.run("save-publish-results", async () => {
        await db.update(scheduledPosts)
          .set({ jourPostIds: postResults.map((r: any) => r.postId), status: 'published', updatedAt: new Date() })
          .where(eq(scheduledPosts.id, scheduledPostId));
      });

      await io.sendEvent('update.scheduled.post.status', { scheduledPostId, status: 'published' });

      return { postResults };
    });
    ```

    **Polling for Status:**
    The UI will poll Next.js Server Actions or API routes which query the database for project and clip statuses, which are updated by Ingest workflows using `io.sendEvent`.

### 8.6. Remotion Video Playback & Rendering

Remotion is used for dynamic video rendering and playback.

1.  **Remotion Compositions (`remotion/index.ts`):**
    This file defines the video compositions that Remotion Lambda will render.

    ```typescript
    // remotion/index.ts
    import { registerRoot } from "remotion";
    import { Composition } from "remotion";
    import { VidShotClip } from "./VidShotClip"; // Your main video component

    export const RemotionRoot = () => {
      return (
        <>
          <Composition
            id="VidShotClipComposition"
            component={VidShotClip}
            durationInFrames={30 * 30} // Max 30 seconds at 30 FPS
            fps={30}
            width={1080}
            height={1920} // Vertical video for shorts
            defaultProps={{
              videoUrl: "https://d1.awsstatic.com/Developer%20Resources/Serverless/1920_1080_Serverless_Developer_Resources_Hero.mp4", // Placeholder
              captionData: [{ text: "Hello", start: 0, end: 1 }],
              styleConfig: {},
            }}
          />
        </>
      );
    };

    registerRoot(RemotionRoot);
    ```

    *   Create `remotion/VidShotClip.tsx` for your actual video component, which takes `videoUrl`, `captionData`, `styleConfig`, `startTimeSec`, `endTimeSec` as props and uses Remotion's `Video` and `AbsoluteFill` components to display the video and overlay captions.

2.  **Remotion Lambda Deployment:**
    *   **IAM Role for Lambda Execution:**
        Follow the [Remotion Lambda Setup Guide](https://www.remotion.dev/docs/lambda/aws-setup) for detailed steps to create:
        *   `RemotionLambdaPolicy`: An IAM policy granting necessary permissions (S3, CloudWatch, Lambda execution).
        *   `RemotionLambdaRole`: An IAM role for your Lambda function to assume, attaching the `RemotionLambdaPolicy`.
        *   IAM User with programmatic access to deploy Remotion Lambda (`REMOTION_DEPLOY_ACCESS_KEY_ID`, `REMOTION_DEPLOY_SECRET_ACCESS_KEY`)
        *   An inline policy for the deployment user to allow `sts:AssumeRole` for the `RemotionLambdaRole`.
        *   Increase Lambda concurrency quota in AWS to at least 1000 for faster rendering.
    *   **Deploy Lambda Function:**
        ```bash
        npx remotion lambda deploy --region us-east-1 --architecture arm64 # Specify region and architecture
        ```
        *   This command will deploy your Remotion Lambda function and output its name (e.g., `remotion-render-function`). Set this to `REMOTION_AWS_FUNCTION_NAME` in your `.env.local`.
    *   **Deploy Remotion Site:**
        This deploys your Remotion compositions as a static site to AWS S3/CloudFront, which the Lambda function uses for rendering.

        ```bash
        npx remotion deploy --site-name vidshot-remotion-site --region us-east-1 --force
        ```
        *   This will output a CloudFront URL (e.g., `https://dXXXXXXXXXXXXX.cloudfront.net`). Set this to `REMOTION_AWS_SITE_URL` in your `.env.local`.

3.  **Remotion Configuration (`config/remotion.ts`):**

    ```typescript
    // config/remotion.ts
    export const remotionConfig = {
      functionName: process.env.REMOTION_AWS_FUNCTION_NAME,
      region: process.env.AWS_REGION,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
      siteUrl: process.env.REMOTION_AWS_SITE_URL,
    };
    ```

### 8.7. Jour.io Social Media Scheduling

Jour.io enables posting to multiple social media platforms via a single API.

1.  **Jour.io Account & API Key:**
    *   Go to [Jour.io](https://jour.io/) and create an account.
    *   Obtain your `JOUR_API_KEY`.
2.  **Integration (Assumption: SDK/API calls):**
    *   A component will allow users to connect their social media accounts through Jour.io's OAuth flow, storing `SocialMediaConnection` details in your database.
    *   The `socialMediaSchedulingWorkflow` in Ingest will use the `JOUR_API_KEY` and fetched connection details to schedule posts.

### 8.8. ARJet Security & Abuse Protection

ARJet protects your application endpoints, AI models, and prevents abuse.

1.  **ARJet Account & API Key:**
    *   Go to [ARJet.com](https://arjet.com/) and create an account.
    *   Create a new "Site" for your application.
    *   Obtain your `ARJET_KEY` and add it to `.env.local`.
2.  **Integration:**
    *   **`middleware.ts`:** Integrate global middleware protection.

        ```typescript
        // middleware.ts (updated)
        import { authMiddleware } from "@clerk/nextjs";
        import { withArjet } from 'arjet/next'; // Assuming ARJet Next.js integration

        const clerkMiddleware = authMiddleware({
          publicRoutes: ["/", "/api/webhooks(.*)", "/api/ingest(.*)"],
        });

        // Apply ARJet middleware
        export default withArjet(clerkMiddleware);

        export const config = {
          matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/(api|trpc)(.*)"],
        };
        ```
    *   **`config/arjet.ts`:** Configure ARJet rules, including rate limiting and AI protection.

        ```typescript
        // config/arjet.ts
        import { Arjet } from 'arjet';

        const arjet = new Arjet({
          apiKey: process.env.ARJET_KEY as string,
        });

        export const arjetClient = arjet;

        // Define rate limit for video uploads
        // Assumption: ARJet integrates with Clerk user ID for rate limiting
        export const videoUploadRateLimiter = arjet.defineRateLimit({
          name: 'video_upload_per_day',
          maxRequests: 2, // 2 videos per day
          window: '24h',
          trackBy: 'userId', // Assumption: Uses Clerk's userId
        });

        // Define AI protection for prompt injection
        export const aiPromptProtection = arjet.defineAIProtection({
          name: 'gemini_prompt_injection',
          model: 'gemini-1.5-flash', // Or the model you are using
          protection: ['prompt_injection', 'abuse'],
        });
        ```
    *   **Server Actions/Ingest Functions:**
        Apply ARJet protection to specific actions.

        ```typescript
        // lib/actions/upload.ts (example with rate limiting)
        'use server';
        import { auth } from '@clerk/nextjs';
        import { videoUploadRateLimiter } from '@/config/arjet';

        export async function uploadVideoAction(videoFile: File) {
          const { userId } = auth();
          if (!userId) {
            throw new Error("Unauthorized");
          }

          // Check rate limit
          const { allowed, remaining } = await videoUploadRateLimiter.check({ userId });
          if (!allowed) {
            throw new Error(`Rate limit exceeded. Try again tomorrow. Remaining: ${remaining}`);
          }

          // ... proceed with S3 upload logic ...
          await videoUploadRateLimiter.increment({ userId }); // Increment on successful upload
        }
        ```

        ```typescript
        // ingest/function.ts (example with prompt injection)
        import { aiPromptProtection } from '@/config/arjet';

        // ... inside analyzeTranscriptWithAI step function within Ingest ...
        async function analyzeTranscriptWithAI(transcript: string) {
          const { allowed, details } = await aiPromptProtection.check({ prompt: transcript });
          if (!allowed) {
            throw new Error(`AI Protection triggered: ${details.reason}`);
          }
          // ... proceed with Gemini AI call ...
        }
        ```

## 9. Local Development

1.  **Start Next.js Development Server:**
    ```bash
    npm run dev
    ```
    Your application will be available at `http://localhost:3000`.

2.  **Start Ingest.dev Local Server:**
    In a separate terminal, run the Ingest local development server.

    ```bash
    npx ingest dev
    ```
    The Ingest UI will be available at `http://localhost:8288`, where you can monitor your workflows. Ensure `INGEST_DEV=1` is set in your `.env.local`.

3.  **Access Drizzle Studio (Optional):**
    In another terminal, if you want to inspect your local database.

    ```bash
    npx drizzle-kit studio
    ```

### 9.1. Testing Key Workflows

*   **User Authentication:** Navigate to `/sign-up` or `/sign-in` and test Clerk authentication. Verify user data is saved in your Neon DB (via Drizzle Studio).
*   **Video Upload:**
    *   Go to the dashboard.
    *   Select a long video from your local device (test with both small and large files).
    *   Click "Upload and Process".
    *   Verify the video is uploaded to your AWS S3 bucket.
*   **AI Analysis:**
    *   After upload, click "Start AI Analysis".
    *   Monitor the `video.process` workflow in the Ingest.dev local UI.
    *   Observe transcription, AI analysis, and clip generation steps.
    *   Verify short clip metadata (start/end times, SEO score, captions) is saved in your Neon DB.
*   **Short Clip Display & Editing:**
    *   On the project page, verify the Remotion Player displays the short clips with correct start/end times and captions.
    *   Test the "Edit Style" functionality: open the modal, change caption styles/fonts, and ensure real-time preview and saving to DB.
*   **Video Rendering & Download:**
    *   Click the "Download" button for a short clip.
    *   Monitor the `video.render.short` workflow in Ingest.dev.
    *   Observe the rendering progress (polling).
    *   Once complete, verify the rendered video is in AWS S3 and the `renderedVideoUrl` is updated in your DB.
    *   Download the video and check captions and styles.
*   **Rate Limiting (ARJet):**
    *   Attempt to upload more than 2 videos in a 24-hour period.
    *   Verify ARJet blocks subsequent uploads and provides an error message.
    *   Check ARJet dashboard logs for rate limit events.
*   **Social Media Scheduling (Optional, requires Jour.io setup):**
    *   Connect a social media account.
    *   Schedule a post for a generated short clip.
    *   Monitor the `social.schedule.post` workflow in Ingest.dev.
    *   Verify the post appears on the selected social media platform.

## 10. Production Deployment

### 10.1. Next.js Application Deployment

**Vercel (Recommended):** Next.js applications are optimally deployed on Vercel.

1.  **Link Git Repository:** Connect your Git repository (GitHub, GitLab, Bitbucket) to Vercel.
2.  **Environment Variables:** Add all production environment variables (from Section 6) to your Vercel project settings. Ensure sensitive keys are marked as "Secret".
3.  **Build & Deploy:** Vercel automatically detects Next.js and deploys your application.
    *   **Server Actions Body Size:** If uploading large files, ensure `next.config.ts` is configured to handle large request bodies for server actions (as identified in troubleshooting):

    ```typescript
    // next.config.ts
    /** @type {import('next').NextConfig} */
    const nextConfig = {
      experimental: {
        serverActions: {
          bodySizeLimit: '2gb', // Adjust as needed for large video uploads
        },
      },
    };

    module.exports = nextConfig;
    ```

### 10.2. Ingest.dev Cloud Deployment

1.  **Deploy Ingest Workflows:**
    ```bash
    npx ingest deploy
    ```
    This command deploys your `ingest/function.ts` workflows to the Ingest.dev cloud.
2.  **Environment Variables:** Add `INGEST_APP_KEY` and `INGEST_PRIVATE_KEY` (and any other relevant secrets like `DEEPGRAM_API_KEY`, `GEMINI_API_KEY`, `JOUR_API_KEY`) to your Ingest.dev application settings.

### 10.3. Remotion Lambda & Site Deployment

1.  **Deploy Lambda Function:** (Repeat this step if you make changes to your Remotion Lambda code)
    ```bash
    npx remotion lambda deploy --region us-east-1 --architecture arm64 # Use your production region
    ```
    Update `REMOTION_AWS_FUNCTION_NAME` in your production environment variables if it changes.
2.  **Deploy Remotion Site:** (Repeat this step if you make changes to your Remotion compositions/components)
    ```bash
    npx remotion deploy --site-name vidshot-remotion-site --region us-east-1 --force # Use your production site name and region
    ```
    Update `REMOTION_AWS_SITE_URL` in your production environment variables if it changes.
3.  **AWS S3 CORS:** Ensure your S3 bucket's CORS policy includes your production domain(s) in `AllowedOrigins`.
4.  **AWS Lambda Concurrency:** Increase the concurrency quota for your Remotion Lambda function in the AWS Lambda console to allow parallel video rendering, especially under high load.

### 10.4. Database (Neon)

Neon automatically handles scaling and backups for your PostgreSQL database. Ensure your `DATABASE_URL` uses the production-grade connection string.

### 10.5. ARJet

ARJet is active in your production environment once `ARJET_KEY` is set. Monitor the ARJet dashboard for security logs and statistics.

### 10.6. Security Considerations for Production

*   **Environment Variables:** Store all sensitive keys securely in your deployment platform's (Vercel, Ingest.dev, AWS) environment variable management. Avoid hardcoding.
*   **IAM Least Privilege:** Create dedicated IAM users/roles for each AWS service with only the minimum necessary permissions. For example, the user deploying Remotion Lambda should not have `AmazonS3FullAccess` in production, but rather specific permissions for S3 bucket operations and Lambda deployments.
*   **Data Encryption:** Ensure data at rest (S3, Neon DB) and in transit (HTTPS) is encrypted. Neon and AWS services typically provide this by default.
*   **Input Validation:** Implement robust input validation on all user-submitted data to prevent common web vulnerabilities.
*   **API Key Management:** Rotate API keys regularly.
*   **AI Safety:** Continuously monitor AI prompts and responses for misuse, bias, or unintended outputs. ARJet's prompt injection detection helps, but human oversight is crucial.

### 10.7. Scalability & Performance Considerations

*   **Ingest.dev:** Designed for long-running and concurrent workflows. Monitor Ingest.dev dashboard for workflow performance.
*   **Remotion Lambda:** Concurrency is key. Increase Lambda concurrency quota. Optimize Remotion compositions for rendering speed (e.g., efficient use of assets, parallel processing within compositions). Consider a CDN for Remotion site assets.
*   **AWS S3:** Highly scalable for storage. Use appropriate S3 storage classes.
*   **Neon PostgreSQL:** Serverless scaling handles database load automatically.
*   **AI Models:** Choose AI models (e.g., Gemini Flash) that offer a good balance of performance, cost, and accuracy for your use case.
*   **CDN:** Use a Content Delivery Network (like CloudFront) for serving frontend assets and potentially directly for Remotion site assets to reduce latency.

## 11. Docker Setup (Assumption)

For consistent local development environments and simplified deployment (if not using Vercel/similar), Docker can be used.

### 11.1. `Dockerfile`

Create a `Dockerfile` in your project root:

```dockerfile
# Use an official Node.js image as the base
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "start"]
```

### 11.2. `docker-compose.yml`

Create a `docker-compose.yml` for local development, including the Next.js app, Ingest.dev local server, and potentially Drizzle Studio. For a real production setup, you would use cloud-managed databases (like Neon) directly.

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules # Don't mount node_modules from host
    environment:
      # Copy all your .env.local variables here, or use .env file
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME}
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - NEXT_PUBLIC_GEMINI_API_KEY=${NEXT_PUBLIC_GEMINI_API_KEY}
      - INGEST_DEV=1
      - ARJET_KEY=${ARJET_KEY}
      - REMOTION_AWS_FUNCTION_NAME=${REMOTION_AWS_FUNCTION_NAME}
      - REMOTION_AWS_SITE_URL=${REMOTION_AWS_SITE_URL}
      - JOUR_API_KEY=${JOUR_API_KEY}
    command: npm run dev # For local development
    depends_on:
      - ingest-dev
      # - db-studio # If you want to use a local postgres then you can add it here.
    networks:
      - vidshot-network

  ingest-dev:
    image: node:18-alpine # Use a Node.js image to run ingest-dev
    command: npx ingest dev
    ports:
      - "8288:8288"
    volumes:
      - .:/app
      - /app/node_modules
    working_dir: /app
    environment:
      - INGEST_DEV=1
      - DATABASE_URL=${DATABASE_URL} # Ingest also needs DB access
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - NEXT_PUBLIC_GEMINI_API_KEY=${NEXT_PUBLIC_GEMINI_API_KEY}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME}
      - ARJET_KEY=${ARJET_KEY}
      - REMOTION_AWS_FUNCTION_NAME=${REMOTION_AWS_FUNCTION_NAME}
      - REMOTION_AWS_SITE_URL=${REMOTION_AWS_SITE_URL}
      - JOUR_API_KEY=${JOUR_API_KEY}
    networks:
      - vidshot-network

  # db-studio: # Example for a local Drizzle Studio
  #   image: node:18-alpine
  #   command: npx drizzle-kit studio
  #   ports:
  #     - "2000:2000"
  #   volumes:
  #     - .:/app
  #     - /app/node_modules
  #   working_dir: /app
  #   environment:
  #     - DATABASE_URL=${DATABASE_URL}
  #   networks:
  #     - vidshot-network

networks:
  vidshot-network:
    driver: bridge
```

### 11.3. Running with Docker Compose

1.  Place your `.env.local` file (renamed to `.env` if docker-compose needs it) in the same directory as `docker-compose.yml`.
2.  Build and run the services:

    ```bash
    docker-compose up --build
    ```

## 12. Troubleshooting

### 12.1. Common Errors & Solutions

| Error Message                                             | Cause                                                                       | Solution                                                                                                                                                                                                                                                                                                 |
| :-------------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `body exceed 1 MB limit`                                  | Next.js Server Actions have a default body size limit.                      | Increase `bodySizeLimit` in `next.config.ts` under `experimental.serverActions`. Example: `bodySizeLimit: '2gb'`.                                                                                                                                                                                           |
| `export createClient does not exist in target module`     | Outdated Deepgram SDK or incorrect import.                                  | Ensure `@deepgram/sdk` is the latest version. Verify import statement: `import { createClient } from "@deepgram/sdk";`.                                                                                                                                                                                  |
| `get presign URL is not defined`                          | Missing or misconfigured AWS S3 pre-signer utility.                         | Ensure the utility function `getSignedUrl` (or similar) is correctly imported and configured with `S3Client` and `S3RequestPresigner` from `@aws-sdk/s3-request-presigner`.                                                                                                                            |
| `CORS policy: No 'Access-Control-Allow-Origin' header`    | AWS S3 bucket CORS policy does not allow your frontend domain.              | Configure the CORS policy on your S3 bucket to include `AllowedOrigins` for your local development URL (`http://localhost:3000`) and your production domain(s).                                                                                                                                         |
| `Ingest.dev app not syncing`                              | Ingest local server not running or `INGEST_DEV` not set.                    | Ensure `npx ingest dev` is running in a separate terminal. Verify `INGEST_DEV=1` is in your `.env.local` file. Restart `npm run dev` after setting `INGEST_DEV`.                                                                                                                                         |
| `Remotion Lambda: no entry file path provided`            | Remotion root component `index.ts/tsx` not found or path incorrect.         | Ensure you have `remotion/index.ts` (or `.tsx`) in your project root and that it correctly registers your root component (`registerRoot(RemotionRoot)`). Verify the `npx remotion deploy` command uses the correct path (e.g., `--entry-point remotion/index.ts`).                                           |
| `Remotion Lambda: "CLA configured has been extracted..."` | Older Remotion version compatibility or configuration issue.                | Check Remotion changelog for breaking changes related to `remotion.config.ts`. Ensure you are on a compatible version or update your `remotion.config.ts` as per the latest documentation.                                                                                                                |
| `Authentication failed` (Clerk)                           | Incorrect Clerk keys or misconfigured middleware.                           | Double-check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local`. Ensure `authMiddleware` in `middleware.ts` is correctly configured and wraps the entire application.                                                                                                              |
| `Database connection failed` (Neon/Drizzle)               | Incorrect `DATABASE_URL` or network issues.                                 | Verify `DATABASE_URL` in `.env.local` is correct and accessible. Ensure your IP address is allowed in Neon's network access settings if restricted.                                                                                                                                                      |
| `ARJet rate limit exceeded`                               | User attempted to bypass rate limits or configured limits are too low.      | Adjust `maxRequests` or `window` for `videoUploadRateLimiter` in `config/arjet.ts` as needed. Wait for the rate limit window to reset. Check ARJet dashboard for details.                                                                                                                               |
| `AI Protection triggered` (ARJet)                         | Prompt injection detected or content deemed abusive by ARJet.               | Review the prompt being sent to the AI model. If legitimate, fine-tune ARJet's AI protection rules or adjust the sensitivity.                                                                                                                                                                                |
| `504 Gateway Timeout`                                     | Long-running API operations timing out on Vercel/similar platforms.         | This is precisely why Ingest.dev is used. Ensure all long-running tasks (transcription, AI analysis, rendering) are offloaded to Ingest workflows. If a server action still times out, consider further offloading or optimizing its execution.                                                              |

### 12.2. General Troubleshooting Steps

1.  **Check Environment Variables:** Verify all required environment variables are correctly set in `.env.local` (for local) or your deployment platform (for production).
2.  **Restart Servers:** Often, a simple restart of the Next.js development server (`npm run dev`) and Ingest local server (`npx ingest dev`) can resolve transient issues.
3.  **Inspect Console/Network Tabs:** Use your browser's developer tools to check for client-side errors, network request failures, or unexpected responses.
4.  **Review Server Logs:** Check your Next.js server logs (in terminal for local, or Vercel dashboard for production) and Ingest.dev logs (local Ingest UI or Ingest.dev dashboard for cloud) for detailed error messages.
5.  **Drizzle Studio:** Use `npx drizzle-kit studio` to inspect your database state and ensure data is being saved and updated as expected.
6.  **Read Documentation:** Refer to the official documentation for Next.js, Clerk, Neon, Deepgram, Gemini, Ingest.dev, Remotion, Jour.io, and ARJet.

---