export const createPaintHistory = (limit = 3) => {
  const undo = [];
  const redo = [];
  return {
    capture(image) {
      undo.push(image);
      if (undo.length > limit) undo.shift();
      redo.length = 0;
    },
    undo(current) {
      const previous = undo.pop();
      if (!previous) return null;
      redo.push(current);
      return previous;
    },
    redo(current) {
      const next = redo.pop();
      if (!next) return null;
      undo.push(current);
      return next;
    },
    clear() {
      undo.length = 0;
      redo.length = 0;
    },
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
  };
};
