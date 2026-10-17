import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = message.chat.id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const sendMsg = async (msg: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
      });
    };

    if (text === "/start") {
      await sendMsg(
        `👋 *Namaste! Main aapka 24/7 Cloud AI Video Bot hu.*\n\nBas mujhe koi bhi **YouTube Video Link** bhej do, main cloud par:\n\n1. 🎯 Top viral clip extract karunga\n2. 📝 Hinglish animated captions lagauga\n3. 📱 9:16 Vertical Video render karunga\n4. 🚀 Direct YouTube Shorts par upload karunga\n5. 📥 Aur video file yahi bhej dunga!\n\n_Bhejo koi bhi YouTube link shuru karne ke liye!_`
      );
      return NextResponse.json({ ok: true });
    }

    const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}[\S]*)/i;
    const match = text.match(ytRegex);

    if (match && match[1]) {
      const youtubeUrl = match[1];
      const githubToken = process.env.GH_PAT_TOKEN;
      const githubRepo = process.env.GH_REPO; // format: "username/repo"

      if (githubToken && githubRepo) {
        // Trigger GitHub Actions Cloud Runner
        await sendMsg(`🚀 *Link Mil Gaya!*\n\n⏳ *Cloud Runner Started...*\n_Aapka PC band rahega tab bhi background cloud mein video render aur YouTube Shorts par post ho rahi hai!_`);

        await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/generate-shorts.yml/dispatches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            ref: "master",
            inputs: {
              youtube_url: youtubeUrl,
              chat_id: String(chatId),
            },
          }),
        });
      } else {
        await sendMsg(`📥 *YouTube URL Recieved!*\n\n_Bot webhook is active. Configure GH_PAT_TOKEN & GH_REPO in .env.local to enable serverless cloud execution!_`);
      }
    } else {
      await sendMsg(`⚠️ Kripya ek valid **YouTube Video URL** bhejein.`);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
