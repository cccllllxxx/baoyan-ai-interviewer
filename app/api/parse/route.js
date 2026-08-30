import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const name = (file.name || "").toLowerCase();

    let text = "";
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const res = await extractText(pdf, { mergePages: true });
      text = (res && res.text) || "";
    } else if (name.endsWith(".docx")) {
      const mod = await import("mammoth");
      const mammoth = mod.default || mod;
      const r = await mammoth.extractRawText({ buffer: buf });
      text = r.value || "";
    } else {
      // .txt / .md / 其他纯文本
      text = buf.toString("utf-8");
    }

    text = (text || "").replace(/\r\n/g, "\n").replace(/ /g, " ").trim();
    if (!text) {
      return NextResponse.json(
        { error: "未能提取到文字（可能是扫描件 / 图片型 PDF，请用文字版或改为粘贴）" },
        { status: 422 }
      );
    }

    const MAX = 20000;
    const truncated = text.length > MAX;
    return NextResponse.json({
      text: truncated ? text.slice(0, MAX) : text,
      truncated,
      chars: text.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "解析失败：" + (e && e.message ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
