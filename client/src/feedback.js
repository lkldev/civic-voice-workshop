export const MAX_FEEDBACK_LENGTH = 500;

export function limitFeedbackLength(message) {
  return message.slice(0, MAX_FEEDBACK_LENGTH);
}
