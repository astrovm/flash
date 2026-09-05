export const AUDIO_TYPES = [
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
];
export const PLAYLIST_TYPES = [".m3u", ".m3u8", ".pls"];
const FILE_TYPES = [...AUDIO_TYPES, ...PLAYLIST_TYPES];
export const applicationMetadata = {
  id: "__winamp",
  title: "Winamp",
  icon: "apps/winamp/icon.png",
  kind: "winamp",
  fileTypes: FILE_TYPES,
  window: {
    width: 275,
    height: 348,
    className: "xp-native-winamp-window",
    customChrome: true,
  },
};
