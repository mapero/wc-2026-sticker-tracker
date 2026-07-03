// Minimal dependency-free PDF writer for plain-text exports.
// Two built-in Type1 fonts (Helvetica-Bold for headings, Courier for body),
// WinAnsi text encoding with a diacritic-stripping fallback, word wrapping
// and automatic A4 page breaks. No images, no styling - just text.

export interface PdfLine {
    text: string;
    bold?: boolean;
    size?: number;
    gapBefore?: number;
}

const PAGE_W = 595.28; // A4 portrait, in points
const PAGE_H = 841.89;
const MARGIN = 40;
const BODY_SIZE = 8;
const LINE_HEIGHT = 1.3;
const WRAP_INDENT = 12; // continuation lines hang under their first line
const COURIER_WIDTH = 0.6; // Courier glyph width as a fraction of font size

// Characters 0x80-0x9F in Windows-1252, indexed by (byte - 0x80).
// Undefined slots hold U+0000 and never match real input.
const CP1252_RANGE =
    "\u20ac\u0000\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u0000\u017d\u0000" +
    "\u0000\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u0000\u017e\u0178";

// Letters WinAnsi lacks that also have no Unicode decomposition.
const TRANSLIT: Record<string, string> = {
    "\u0131": "i", // \u0131
    "\u0130": "I", // \u0130
    "\u0142": "l", // \u0142
    "\u0141": "L", // \u0141
    "\u0111": "d", // \u0111
    "\u0110": "D", // \u0110
};

// Map a string to WinAnsi bytes (as a binary string). Characters outside the
// encoding fall back to their base letter (e.g. "\u010d" -> "c"); anything else
// (emoji, flags) is dropped.
function encodeWinAnsi(text: string): string {
    let out = "";
    for (const ch of text) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) {
            out += ch;
            continue;
        }
        const extra = CP1252_RANGE.indexOf(ch);
        if (extra >= 0) {
            out += String.fromCharCode(0x80 + extra);
            continue;
        }
        if (TRANSLIT[ch]) {
            out += TRANSLIT[ch];
            continue;
        }
        const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (base && base !== ch) out += encodeWinAnsi(base);
    }
    return out;
}

function escapeString(s: string): string {
    return s.replace(/[\\()]/g, (c) => "\\" + c);
}

interface Segment {
    text: string;
    bold: boolean;
    size: number;
    x: number;
    gapBefore: number;
}

// Word-wrap a body line to the page width using Courier's fixed glyph width.
// Bold headings are short and pass through unwrapped.
function wrap(line: PdfLine): Segment[] {
    const size = line.size ?? BODY_SIZE;
    const bold = line.bold ?? false;
    if (bold) {
        return [{ text: line.text, bold, size, x: MARGIN, gapBefore: line.gapBefore ?? 0 }];
    }

    const charW = size * COURIER_WIDTH;
    const firstMax = Math.floor((PAGE_W - 2 * MARGIN) / charW);
    const contMax = Math.floor((PAGE_W - 2 * MARGIN - WRAP_INDENT) / charW);
    const segments: Segment[] = [];
    let rest = line.text;
    while (rest.length > 0) {
        const first = segments.length === 0;
        const limit = first ? firstMax : contMax;
        let cut = rest.length;
        if (rest.length > limit) {
            const space = rest.lastIndexOf(" ", limit);
            cut = space > 0 ? space : limit;
        }
        segments.push({
            text: rest.slice(0, cut),
            bold,
            size,
            x: first ? MARGIN : MARGIN + WRAP_INDENT,
            gapBefore: first ? (line.gapBefore ?? 0) : 0,
        });
        rest = rest.slice(cut).trimStart();
    }
    return segments;
}

export function textPdf(lines: PdfLine[]): Blob {
    // Lay out wrapped lines top-down, starting a new page when one is full.
    interface Placed extends Segment {
        y: number;
    }
    const pages: Placed[][] = [[]];
    let y = PAGE_H - MARGIN;
    for (const seg of lines.flatMap(wrap)) {
        const lineHeight = seg.size * LINE_HEIGHT;
        y -= seg.gapBefore + lineHeight;
        if (y < MARGIN) {
            pages.push([]);
            y = PAGE_H - MARGIN - lineHeight;
        }
        pages[pages.length - 1].push({ ...seg, y });
    }

    // Object 1: catalog, 2: page tree, 3/4: fonts, then page + stream pairs.
    const objects: string[] = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "", // page tree, filled in once the kids are known
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    ];

    const kids: string[] = [];
    for (const page of pages) {
        const content = page
            .map((p) => {
                const font = p.bold ? "F1" : "F2";
                const text = escapeString(encodeWinAnsi(p.text).trimStart());
                return `BT /${font} ${p.size} Tf ${p.x} ${p.y.toFixed(2)} Td (${text}) Tj ET`;
            })
            .join("\n");
        const pageRef = objects.length + 1;
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
                `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageRef + 1} 0 R >>`
        );
        objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        kids.push(`${pageRef} 0 R`);
    }
    objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

    // Binary-content marker comment after the header, per the PDF spec.
    let out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
        offsets.push(out.length);
        out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefPos = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${off.toString().padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

    return new Blob([Uint8Array.from(out, (c) => c.charCodeAt(0))], { type: "application/pdf" });
}
