const createScrollbar = (shell, viewport, axis) => {
  const vertical = axis === "vertical";
  const bar = document.createElement("div");
  bar.className = `paint-scrollbar ${axis}`;
  const backward = document.createElement("button");
  backward.type = "button";
  backward.tabIndex = -1;
  backward.className = `paint-scroll-arrow paint-scroll-${vertical ? "up" : "left"}`;
  const track = document.createElement("div");
  track.className = "paint-scroll-track";
  const thumb = document.createElement("div");
  thumb.className = "paint-scroll-thumb";
  track.appendChild(thumb);
  const forward = document.createElement("button");
  forward.type = "button";
  forward.tabIndex = -1;
  forward.className = `paint-scroll-arrow paint-scroll-${vertical ? "down" : "right"}`;
  bar.append(backward, track, forward);
  shell.appendChild(bar);

  const scrollKey = vertical ? "scrollTop" : "scrollLeft";
  const scrollSizeKey = vertical ? "scrollHeight" : "scrollWidth";
  const clientSizeKey = vertical ? "clientHeight" : "clientWidth";
  const coordinateKey = vertical ? "clientY" : "clientX";
  const sizeKey = vertical ? "height" : "width";
  const positionKey = vertical ? "top" : "left";
  const metrics = () => {
    const trackLength = track.getBoundingClientRect()[sizeKey];
    const maximum = Math.max(
      0,
      viewport[scrollSizeKey] - viewport[clientSizeKey],
    );
    const thumbLength = maximum
      ? Math.max(
          8,
          (trackLength * viewport[clientSizeKey]) / viewport[scrollSizeKey],
        )
      : trackLength;
    return {
      maximum,
      thumbLength,
      travel: Math.max(0, trackLength - thumbLength),
    };
  };
  const update = () => {
    const { maximum, thumbLength, travel } = metrics();
    bar.hidden = maximum === 0;
    shell.classList.toggle(`has-${axis}-scrollbar`, maximum > 0);
    thumb.hidden = maximum === 0;
    const position = maximum ? (travel * viewport[scrollKey]) / maximum : 0;
    thumb.style[sizeKey] = `${thumbLength}px`;
    thumb.style[positionKey] = `${position}px`;
    backward.disabled = viewport[scrollKey] <= 0;
    forward.disabled = viewport[scrollKey] >= maximum;
  };
  const moveBy = (amount) => {
    viewport[scrollKey] += amount;
    update();
  };
  backward.addEventListener("click", () => moveBy(-16));
  forward.addEventListener("click", () => moveBy(16));
  track.addEventListener("pointerdown", (event) => {
    if (event.target === thumb) return;
    const trackPosition = track.getBoundingClientRect()[positionKey];
    const thumbPosition = thumb.getBoundingClientRect()[positionKey];
    moveBy(
      event[coordinateKey] - trackPosition < thumbPosition - trackPosition
        ? -viewport[clientSizeKey]
        : viewport[clientSizeKey],
    );
  });
  thumb.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const startCoordinate = event[coordinateKey];
    const startScroll = viewport[scrollKey];
    const { maximum, travel } = metrics();
    const onMove = (moveEvent) => {
      viewport[scrollKey] =
        startScroll +
        ((moveEvent[coordinateKey] - startCoordinate) * maximum) /
          Math.max(1, travel);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  viewport.addEventListener("scroll", update);
  return update;
};

export const installPaintScrollbars = (shell, viewport, canvas) => {
  const updates = [
    createScrollbar(shell, viewport, "vertical"),
    createScrollbar(shell, viewport, "horizontal"),
  ];
  const corner = document.createElement("div");
  corner.className = "paint-scroll-corner";
  shell.appendChild(corner);
  const update = () => updates.forEach((callback) => callback());
  const observer = new ResizeObserver(update);
  observer.observe(viewport);
  observer.observe(canvas);
  requestAnimationFrame(() => {
    update();
    requestAnimationFrame(update);
  });
  return () => observer.disconnect();
};
