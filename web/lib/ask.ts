// Ask ReadKernel's suggested questions, shared by the chat (AskChat) and the
// server (api/ask), which caches their answers: every reader who taps the
// same suggestion on the same day gets the same answer from one AI run.

export const SUGGESTIONS = [
  "What's the biggest AI news today?",
  "What has Nvidia been up to recently?",
  "How did Uber use AI to clean up its code?",
  "Any new open-weight models this week?",
];

// When Ask was opened from a story page.
export const STORY_SUGGESTIONS = [
  "Who are the competitors here?",
  "What else is happening in this space?",
  "How has this story developed?",
  "Why does this matter?",
];

/** True when the answer to this first question can be shared with other readers. */
export function isSharedQuestion(question: string, storyKey?: string): boolean {
  return (storyKey ? STORY_SUGGESTIONS : SUGGESTIONS).includes(question);
}
