export function QuotedParagraph({ text, quote }: { text: string; quote: string }) {
  const index = text.indexOf(quote);
  if (index < 0) {
    return <p className="font-quote text-lg leading-relaxed">{text}</p>;
  }
  return (
    <p className="font-quote text-lg leading-relaxed">
      {text.slice(0, index)}
      <mark>{quote}</mark>
      {text.slice(index + quote.length)}
    </p>
  );
}
