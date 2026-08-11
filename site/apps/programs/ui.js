export const createProgramRoot = (program) => {
  const content = document.createElement("div");
  content.className = `xp-native-program xp-native-${program.kind}`;
  return content;
};
