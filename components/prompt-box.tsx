import { CopyButton } from "@/components/copy-button";

/** "What to tell Claude": the sentence to say in Claude Code, with a Copy button. */
export function PromptBox({ text, label = "What to tell Claude" }: { text: string; label?: string }) {
  return (
    <div className="prompt-box">
      <span className="prompt-label">{label}</span>
      <p className="prompt-text">{text}</p>
      <CopyButton text={text} />
    </div>
  );
}
