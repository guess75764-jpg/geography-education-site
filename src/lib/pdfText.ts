// PDF 에서 글자를 줄 단위로 꺼낸다 (pdf.js, 브라우저 안에서만 처리).
// 표처럼 칸 사이가 넓게 떨어진 글은 ' | ' 로 이어 붙여 "개념 | 정답" 구조를 살린다.

interface TextItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
  width: number;
  hasEOL?: boolean;
}

export async function extractPdfLines(file: File): Promise<{ lines: string[]; pages: number }> {
  // pdf.js 는 크므로 관리자가 PDF 를 올릴 때만 불러온다
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as TextItem[]).filter((it) => 'str' in it && it.str.trim() !== '');

    // 같은 높이(y)에 있는 글자 조각을 한 줄로 모은다
    const rows: { y: number; parts: TextItem[] }[] = [];
    for (const it of items) {
      const y = it.transform[5];
      const size = Math.abs(it.transform[3]) || 10;
      const row = rows.find((r) => Math.abs(r.y - y) < size * 0.5);
      if (row) row.parts.push(it);
      else rows.push({ y, parts: [it] });
    }
    rows.sort((a, b) => b.y - a.y); // 위에서 아래로

    let prevY: number | null = null;
    for (const row of rows) {
      row.parts.sort((a, b) => a.transform[4] - b.transform[4]);
      const size = Math.abs(row.parts[0].transform[3]) || 10;
      // 줄 사이가 많이 벌어지면 문단이 바뀐 것으로 보고 빈 줄을 넣는다
      if (prevY !== null && prevY - row.y > size * 2.2) lines.push('');
      prevY = row.y;

      let text = '';
      let lastEnd: number | null = null;
      for (const part of row.parts) {
        const x = part.transform[4];
        if (lastEnd !== null) {
          const gap = x - lastEnd;
          if (gap > size * 1.5) text += ' | '; // 표의 칸
          else if (gap > size * 0.15 && !text.endsWith(' ') && !part.str.startsWith(' ')) text += ' ';
        }
        text += part.str;
        lastEnd = x + part.width;
      }
      lines.push(text.trim());
    }
    lines.push(''); // 쪽이 바뀌면 문단도 끊는다
  }
  return { lines, pages: doc.numPages };
}
