export function useScript() {
  function parseParagraphs(text: string): string[] {
    if (!text || !text.trim()) return []
    const blocks = text.split(/\n{2,}/)
    return blocks.filter((b) => b.trim().length > 0)
  }

  function joinParagraphs(paragraphs: string[]): string {
    return paragraphs.join('\n\n')
  }

  return { parseParagraphs, joinParagraphs }
}
