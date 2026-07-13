export function createSavedFilterPanel({ initialIds, save }) {
  let selectedIds = [...initialIds];
  let error = null;

  return {
    state: () => ({ selectedIds: [...selectedIds], error }),
    async select(nextIds) {
      selectedIds = [...nextIds];
      error = null;
      await save(selectedIds);
    }
  };
}
