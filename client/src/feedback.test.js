import { describe, expect, it } from "vitest";
import { limitFeedbackLength, MAX_FEEDBACK_LENGTH } from "./feedback";

describe("feedback character limit", () => {
  it("keeps messages at or below the maximum length", () => {
    const message = "a".repeat(MAX_FEEDBACK_LENGTH);

    expect(limitFeedbackLength(message)).toBe(message);
  });

  it("truncates messages longer than the maximum length", () => {
    const message = "a".repeat(MAX_FEEDBACK_LENGTH + 1);

    expect(limitFeedbackLength(message)).toHaveLength(MAX_FEEDBACK_LENGTH);
  });
});
