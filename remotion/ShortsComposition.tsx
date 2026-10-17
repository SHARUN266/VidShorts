import { Video, Audio, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import React from "react";
import { loadFont as loadLilitaOne } from "@remotion/google-fonts/LilitaOne";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadNotoSansDevanagari } from "@remotion/google-fonts/NotoSansDevanagari";

// Pre-load viral creator fonts
try {
  loadLilitaOne();
  loadAnton();
  loadMontserrat();
  loadBangers();
  loadOutfit();
  loadNotoSansDevanagari();
} catch (e) {
  // Graceful fallback if offline
}

export interface SubtitleWord {
  word: string;
  start: number; // in seconds
  end: number; // in seconds
  confidence: number;
}

export interface ShortsCompositionProps {
  videoUrl: string;
  startTimeSeconds: number;
  durationInSeconds: number;
  subtitles: SubtitleWord[];
  styleProperties: {
    fontFamily?: string;
    fontSizePx?: number;
    textColor?: string;
    highlightColor?: string;
    backgroundColor?: string;
    textStroke?: string;
    badgeStyle?: string; // 'box' | 'pill' | 'glass' | 'outline'
    activeAnimation?: string; // 'hormozi-pop' | 'bounce' | 'clean' | 'neon-glow'
    videoFilter?: string; // 'none' | 'vivid' | 'cinematic' | 'warm' | 'grayscale' | 'neon'
    textPosition?: string;
    maxDisplayWords?: number;
    backgroundAudioUrl?: string;
    backgroundAudioVolume?: number;
  };
}

function getContrastTextColor(hexColor?: string): string {
  if (!hexColor || hexColor === "transparent") return "#000000";
  const hex = hexColor.replace("#", "");
  let r = 255, g = 255, b = 255;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.52 ? "#000000" : "#FFFFFF";
}

function getVideoFilterCss(filterName?: string): string {
  switch (filterName) {
    case "vivid":
      return "contrast(1.18) saturate(1.3) brightness(1.04)";
    case "cinematic":
      return "contrast(1.22) brightness(0.92) saturate(0.9)";
    case "warm":
      return "sepia(0.22) contrast(1.1) saturate(1.2) hue-rotate(-8deg)";
    case "grayscale":
      return "grayscale(1) contrast(1.2) brightness(1.05)";
    case "neon":
      return "contrast(1.25) saturate(1.4) hue-rotate(15deg)";
    default:
      return "none";
  }
}

export const ShortsComposition: React.FC<ShortsCompositionProps> = ({
  videoUrl,
  startTimeSeconds,
  durationInSeconds,
  subtitles = [],
  styleProperties = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps + startTimeSeconds;

  // 1. Find active word index
  const activeWordIndex = subtitles.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  let currentIndex = activeWordIndex;
  if (currentIndex === -1) {
    currentIndex = subtitles.findIndex((w) => w.start > currentTime);
    if (currentIndex > 0) {
      currentIndex = currentIndex - 1;
    }
  }

  // 2. Group subtitles into punchy 2-3 word phrases (Hormozi rapid reader pacing)
  const wordsPerPhrase = Math.max(1, Number(styleProperties?.maxDisplayWords) || 3);
  let phraseWords: SubtitleWord[] = [];
  let phraseStartIndex = 0;

  if (currentIndex !== -1) {
    const phraseGroupIndex = Math.floor(currentIndex / wordsPerPhrase);
    phraseStartIndex = phraseGroupIndex * wordsPerPhrase;
    phraseWords = subtitles.slice(phraseStartIndex, phraseStartIndex + wordsPerPhrase);
  }

  // 3. Resolve positioning with YouTube Shorts safe-zone awareness
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    paddingLeft: "40px",
    paddingRight: "40px",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "16px",
    zIndex: 20,
    textAlign: "center",
    pointerEvents: "none",
  };

  if (styleProperties.textPosition === "top") {
    containerStyle.top = "18%";
    containerStyle.bottom = "auto";
  } else if (styleProperties.textPosition === "bottom") {
    containerStyle.top = "74%"; // Above bottom channel title & audio metadata safe zone
    containerStyle.bottom = "auto";
  } else {
    // Center: Placed at 58% - the viral sweet-spot right below the speaker's face
    containerStyle.top = "58%";
    containerStyle.transform = "translateY(-50%)";
    containerStyle.bottom = "auto";
  }

  const rawAudioUrl = styleProperties?.backgroundAudioUrl;
  const resolvedAudioUrl =
    rawAudioUrl && typeof rawAudioUrl === "string" && rawAudioUrl.trim().length > 0
      ? rawAudioUrl.startsWith("/")
        ? typeof window !== "undefined"
          ? `${window.location.origin}${rawAudioUrl}`
          : `http://localhost:3000${rawAudioUrl}`
        : rawAudioUrl
      : null;

  // Graphic Designer font hierarchy
  const chosenFont =
    styleProperties.fontFamily ||
    "'Lilita One', 'Montserrat', Anton, 'Noto Sans Devanagari', Impact, sans-serif";
  const baseFontSize = styleProperties.fontSizePx || 64;
  const highlightColor = styleProperties.highlightColor || "#FFE600";
  const normalTextColor = styleProperties.textColor || "#FFFFFF";
  const badgeStyle = styleProperties.badgeStyle || "box";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 9:16 Vertical Video Screen */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Original Video cropped to 9:16 */}
        <Video
          src={videoUrl}
          startFrom={Math.round(startTimeSeconds * fps)}
          endAt={Math.round((startTimeSeconds + durationInSeconds) * fps)}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.77)",
            filter: getVideoFilterCss(styleProperties?.videoFilter),
          }}
        />

        {/* Optional Background Music Track */}
        {resolvedAudioUrl && (
          <Audio
            src={resolvedAudioUrl}
            volume={(f) => styleProperties?.backgroundAudioVolume ?? 0.3}
          />
        )}

        {/* Professional Graphic-Designer Animated Subtitles */}
        {phraseWords.length > 0 && (
          <div style={containerStyle}>
            {phraseWords.map((w, index) => {
              const globalWordIndex = phraseStartIndex + index;
              const isWordActive =
                currentTime >= w.start && currentTime <= w.end;

              // Calculate exact frame when word begins for Remotion spring physics
              const wordStartFrame = Math.round((w.start - startTimeSeconds) * fps);
              const framesSinceStart = Math.max(0, frame - wordStartFrame);

              // Snappy graphic designer spring bounce
              const bounceSpring = isWordActive
                ? spring({
                    frame: framesSinceStart,
                    fps,
                    config: {
                      damping: 11,
                      mass: 0.35,
                      stiffness: 240,
                    },
                  })
                : 0;

              // Alternating dynamic sticker tilt (-3deg to +2.5deg)
              const tiltDegree = globalWordIndex % 2 === 0 ? -2.5 : 2.5;

              // Contrast text inside the badge
              const activeTextColor = getContrastTextColor(highlightColor);

              if (isWordActive) {
                // ACTIVE WORD: Graphic Designer Badge (Hormozi / MrBeast Box)
                const activeScale = 1.0 + bounceSpring * 0.20;

                return (
                  <span
                    key={index}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: chosenFont,
                      fontSize: `${baseFontSize}px`,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      lineHeight: 1,
                      color: activeTextColor,
                      backgroundColor: highlightColor,
                      padding: "8px 22px",
                      borderRadius: badgeStyle === "pill" ? "9999px" : "14px",
                      border: "3.5px solid #000000",
                      boxShadow:
                        "0px 8px 0px #000000, 0px 14px 28px rgba(0, 0, 0, 0.75)",
                      transform: `scale(${activeScale}) rotate(${tiltDegree}deg)`,
                      WebkitTextStroke: "0px transparent",
                      textShadow: "none",
                      zIndex: 30,
                    }}
                  >
                    {w.word}
                  </span>
                );
              }

              // INACTIVE SURROUNDING WORDS: Crisp White with 3D Bevel Outline
              return (
                <span
                  key={index}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: chosenFont,
                    fontSize: `${baseFontSize}px`,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    lineHeight: 1,
                    color: normalTextColor,
                    padding: "4px 8px",
                    // 3D Graphic Designer Stroke & Shadow
                    WebkitTextStroke: "7px #000000",
                    paintOrder: "stroke fill",
                    textShadow:
                      "0px 7px 0px #000000, 0px 12px 24px rgba(0, 0, 0, 0.9)",
                    transform: "scale(1.0)",
                    zIndex: 20,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
