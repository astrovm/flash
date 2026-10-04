import { defineApplication } from "../core/application.js";
import * as renderers from "./renderers/index.js";

const PROGRAM_RENDERERS = Object.freeze({
  terminal: renderers.renderTerminal,
  volume: renderers.renderVolume,
});

export const defineProgram = (metadata) => {
  const renderer = PROGRAM_RENDERERS[metadata.kind];
  if (!renderer) {
    throw new Error(`No renderer registered for application: ${metadata.id}`);
  }
  return defineApplication({
    ...metadata,
    mount(context, instance) {
      // Renderers return their element, or { element, unmount } when they
      // have something to clean up.
      const rendered = renderer(context, instance.application, metadata.id);
      return rendered.nodeType ? { element: rendered, unmount() {} } : rendered;
    },
  });
};
