export const SUGGESTIONS = [
  "What's the biggest AI news today?",
  "What has Nvidia been up to recently?",
  "How did Uber use AI to clean up its code?",
  "Any new open-weight models this week?",
];

export const STORY_SUGGESTIONS = [
  "Who are the competitors here?",
  "What else is happening in this space?",
  "How has this story developed?",
  "Why does this matter?",
];

export function isSharedQuestion(question: string, storyKey?: string): boolean {
  return (storyKey ? STORY_SUGGESTIONS : SUGGESTIONS).includes(question);
}
