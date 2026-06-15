/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSchema } from "../types";

// Completely empty default dataset so that all initial mock system items are removed,
// ensuring the user has a clean, simplified system focused entirely on their input.
export const initialAppData: AppSchema = {
  procedures: [],
  inventory: [],
  checklist: [],
  feed: []
};
