// src/components/anchor-engine/dom-text.ts
// Plaintext-офсеты внутри блока в UTF-16 code units (совпадает с контрактом бэка
// и DOM Range). <br> (hard_break) считается одним символом "\n".

interface Segment { node: Node; text: string } // node: Text | <br>; text: содержимое/\n

function segments(block: Element): Segment[] {
  const out: Segment[] = [];
  const walker = block.ownerDocument.createTreeWalker(
    block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) out.push({ node: n, text: n.textContent ?? "" });
    else if ((n as Element).tagName === "BR") out.push({ node: n, text: "\n" });
    n = walker.nextNode();
  }
  return out;
}

export function blockPlainText(block: Element): string {
  return segments(block).map((s) => s.text).join("");
}

export function offsetWithinBlock(block: Element, container: Node, offsetInContainer: number): number {
  const segs = segments(block);
  // Граница — текстовый узел: сумма предыдущих сегментов + локальный офсет.
  if (container.nodeType === Node.TEXT_NODE) {
    let acc = 0;
    for (const s of segs) {
      if (s.node === container) return acc + offsetInContainer;
      acc += s.text.length;
    }
    return acc;
  }
  // Граница — элемент: сумма сегментов до child[offset].
  const target = container.childNodes[offsetInContainer] ?? null;
  let acc = 0;
  for (const s of segs) {
    if (target && (s.node === target || target.contains(s.node))) break;
    acc += s.text.length;
  }
  return acc;
}

export function locateOffset(block: Element, charOffset: number): { node: Text; offset: number } | null {
  let acc = 0;
  for (const s of segments(block)) {
    if (s.node.nodeType !== Node.TEXT_NODE) { acc += s.text.length; continue; } // пропускаем <br>
    const len = s.text.length;
    if (charOffset <= acc + len) return { node: s.node as Text, offset: charOffset - acc };
    acc += len;
  }
  return null;
}
