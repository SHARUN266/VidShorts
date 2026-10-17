const fs = require("fs");
const path = require("path");
const https = require("https");

const audioDir = path.join(process.cwd(), "public", "audio");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Reliable, CORS-friendly open source royalty free audio URLs with Range headers support
const tracks = [
  {
    filename: "phonk-hype.mp3",
    url: "https://actions.google.com/sounds/v1/science_fiction/alien_spaceship_idle.ogg",
  },
  {
    filename: "lofi-chill.mp3",
    url: "https://actions.google.com/sounds/v1/ambiences/outdoor_park.ogg",
  },
];

console.log("Audio directory ready at:", audioDir);
