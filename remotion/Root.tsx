import { Composition } from "remotion";
import { ShortsComposition } from "./ShortsComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortsVideo"
        component={ShortsComposition}
        durationInFrames={900} // 30 seconds at 30fps (overridden dynamically during renders)
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: "",
          startTimeSeconds: 0,
          durationInSeconds: 30,
          subtitles: [],
          styleProperties: {
            fontFamily: "'Lilita One', 'Montserrat', Anton, Impact, sans-serif",
            fontSizePx: 64,
            textColor: "#FFFFFF",
            highlightColor: "#FFE600",
            backgroundColor: "#FFE600",
            textStroke: "7px #000000",
            badgeStyle: "box",
            activeAnimation: "hormozi-pop",
            textPosition: "center",
            maxDisplayWords: 3,
          },
        }}
      />
    </>
  );
};
export default RemotionRoot;
