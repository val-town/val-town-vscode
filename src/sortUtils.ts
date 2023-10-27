import { BaseVal } from "./client";

const privacyOrder = { public: 0, unlisted: 1, private: 2 };

export const sortFunctions: {
  [key: string]: (a: BaseVal, b: BaseVal) => number;
} = {
  name: (a, b) => a.name.localeCompare(b.name),
  privacy: (a, b) => privacyOrder[a.privacy] - privacyOrder[b.privacy],
  run: (a, b) => b.runEndAt.localeCompare(a.runEndAt),
};
