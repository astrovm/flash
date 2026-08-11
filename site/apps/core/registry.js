export const createApplicationRegistry = (definitions) => {
  const applications = new Map();
  for (const application of definitions) {
    if (applications.has(application.id)) {
      throw new Error(`Duplicate application id: ${application.id}`);
    }
    applications.set(application.id, application);
  }

  return Object.freeze({
    get(id) {
      return applications.get(id) || null;
    },
    has(id) {
      return applications.has(id);
    },
    entries() {
      return [...applications.entries()];
    },
    values() {
      return [...applications.values()];
    },
  });
};
