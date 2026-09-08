// /utils/helper/summarizeIfLarge.js
import { summarizeWazuhArrayResult } from "../../tools/wazuh/wazuh-result-summarizer.js";


const LARGE_RESULT_CHAR_THRESHOLD = 20_000;
const MAX_ITEMS_IN_SUMMARY = 20;

export const summarizeIfLarge = (result) => {
  if (!Array.isArray(result)) return result;
  let size;
  try {
    size = JSON.stringify(result).length;
  } catch {
    return result;
  }
  if (size <= LARGE_RESULT_CHAR_THRESHOLD) return result;
  return summarizeWazuhArrayResult(result, { maxItems: MAX_ITEMS_IN_SUMMARY });
}
