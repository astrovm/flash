import { defineApplication } from "../core/application.js";
import * as renderers from "./renderers/index.js";

const PROGRAM_RENDERERS = Object.freeze({
  calculator: renderers.renderCalculator,
  terminal: renderers.renderTerminal,
  hyperterminal: renderers.renderHyperterminal,
  editor: renderers.renderEditor,
  keyboard: renderers.renderKeyboard,
  "address-book": renderers.renderAddressBook,
  "character-map": renderers.renderCharacterMap,
  "id:__minesweeper": renderers.renderIdMinesweeper,
  "id:__solitaire": renderers.renderIdSolitaire,
  "id:__freecell": renderers.renderIdFreecell,
  volume: renderers.renderVolume,
  recorder: renderers.renderRecorder,
  media: renderers.renderMedia,
  "id:__disk-defragmenter": renderers.renderIdDiskDefragmenter,
  disk: renderers.renderDisk,
  tasks: renderers.renderTasks,
  information: renderers.renderInformation,
  remote: renderers.renderRemote,
  browser: renderers.renderBrowser,
  mail: renderers.renderMail,
  messenger: renderers.renderMessenger,
  defaults: renderers.renderDefaults,
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
