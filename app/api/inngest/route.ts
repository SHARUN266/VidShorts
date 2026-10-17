import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processVideoWorkflow, renderClipWorkflow } from "@/lib/inngest/functions";

// Serve Inngest handler for GET, POST and PUT methods
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processVideoWorkflow, renderClipWorkflow],
});
