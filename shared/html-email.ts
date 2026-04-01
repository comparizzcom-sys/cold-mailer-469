function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInline(value: string) {
  const escaped = escapeHtml(value.trim());

  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function isBullet(line: string) {
  return /^[-*]\s+/.test(line.trim());
}

function isNumbered(line: string) {
  return /^\d+\.\s+/.test(line.trim());
}

function stripMarker(line: string) {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "");
}

export function plainTextToHtml(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    parts.push(`<p>${paragraph.map((line) => formatInline(line)).join("<br />")}</p>`);
    paragraph = [];
  }

  function flushBullets() {
    if (bullets.length === 0) return;
    parts.push(
      `<ul>${bullets.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ul>`,
    );
    bullets = [];
  }

  function flushOrdered() {
    if (ordered.length === 0) return;
    parts.push(
      `<ol>${ordered.map((line) => `<li>${formatInline(line)}</li>`).join("")}</ol>`,
    );
    ordered = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      continue;
    }

    if (isBullet(line)) {
      flushParagraph();
      flushOrdered();
      bullets.push(stripMarker(line));
      continue;
    }

    if (isNumbered(line)) {
      flushParagraph();
      flushBullets();
      ordered.push(stripMarker(line));
      continue;
    }

    flushBullets();
    flushOrdered();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  flushOrdered();

  return parts.join("");
}
