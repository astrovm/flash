// Paint is part of the XP shell and intentionally uses the Windows Classic
// palette. Theme switching from the original web app is outside this app's
// contract; keeping this small API avoids special cases in the drawing tools.
const theme = "classic.css";
const themeLink = document.createElement("link");
themeLink.rel = "stylesheet";
themeLink.href = `styles/themes/${theme}`;
themeLink.id = "theme-link";
document.head.appendChild(themeLink);

const get_theme = () => theme;
const set_theme = () => {};

export { get_theme, set_theme };
