# Goal: Saved Report Filters

Signed-in users need to save a selection of report filter IDs, reload it on a
later visit, and update it from the existing filter panel.

Requirements:

- save no more than 20 unique string filter IDs per user;
- reject invalid input on the server;
- never read or write another user's preference;
- update the UI optimistically, but restore the previous selection and show the
  existing error state if persistence fails;
- keep the change local to the established preference, API, UI, and test
  surfaces;
- no new dependency, migration, or deployment work.
