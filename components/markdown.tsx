import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown written by Claude or the person. Raw HTML in the text shows as text (react-markdown's default). */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href && /^(https?|mailto):/i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <a href={href}>{children}</a>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
