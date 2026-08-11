import { defineApplication } from "../core/application.js";
import * as renderers from "./renderers/index.js";

const PROGRAM_RENDERERS = Object.freeze({
  calculator: renderers.renderCalculator,
  terminal: renderers.renderTerminal,
  volume: renderers.renderVolume,
});

export const defineProgram = (metadata) => {
  const renderer =
    PROGRAM_RENDERERS[`id:${metadata.id}`] || PROGRAM_RENDERERS[metadata.kind];
  if (!renderer) {
    throw new Error(`No renderer registered for application: ${metadata.id}`);
  }
  return defineApplication({
    ...metadata,
    mount(context, instance) {
      return {
        element: renderer(context, instance.application, metadata.id),
        unmount() {},
      };
    },
  });
};
