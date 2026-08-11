import { createProgramRoot } from "../ui.js";

export const renderBrowser = (context, program, programId) => {
  const content = createProgramRoot(program);

  const homeAddress =
    programId === "__msn" ? "http://www.msn.com/" : "about:home";
  content.innerHTML = `<div class="xp-browser-toolbar"><button type="button" data-browser-back disabled>Back</button><button type="button" data-browser-forward disabled>Forward</button><button type="button" data-browser-home>Home</button><button type="button" data-browser-refresh>Refresh</button><label>Address <input value="${homeAddress}" aria-label="Address"></label><button type="button" data-go>Go</button></div><div class="xp-browser-page"></div>`;
  const input = content.querySelector("input");
  const page = content.querySelector(".xp-browser-page");
  const back = content.querySelector("[data-browser-back]");
  const forward = content.querySelector("[data-browser-forward]");
  let history = [homeAddress];
  let historyIndex = 0;
  const render = (address) => {
    input.value = address;
    page.replaceChildren();
    const heading = document.createElement("h1");
    const message = document.createElement("p");
    if (address === "about:home") {
      heading.textContent = "Welcome to Internet Explorer";
      message.textContent = "Browse local pages or enter an address.";
    } else if (address === "http://www.msn.com/") {
      heading.textContent = "MSN";
      message.textContent = "MSN is not available while offline.";
    } else {
      heading.textContent = address;
      message.textContent =
        "The requested page is not available while offline.";
    }
    page.append(heading, message);
    back.disabled = historyIndex === 0;
    forward.disabled = historyIndex === history.length - 1;
  };
  const navigate = (address = input.value.trim()) => {
    if (!address) return;
    history = history.slice(0, historyIndex + 1);
    history.push(address);
    historyIndex = history.length - 1;
    render(address);
  };
  content
    .querySelector("[data-go]")
    .addEventListener("click", () => navigate());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") navigate();
  });
  back.addEventListener("click", () => {
    if (historyIndex > 0) render(history[--historyIndex]);
  });
  forward.addEventListener("click", () => {
    if (historyIndex < history.length - 1) render(history[++historyIndex]);
  });
  content
    .querySelector("[data-browser-home]")
    .addEventListener("click", () => navigate(homeAddress));
  content
    .querySelector("[data-browser-refresh]")
    .addEventListener("click", () => render(history[historyIndex]));
  render(homeAddress);
  return content;
};
