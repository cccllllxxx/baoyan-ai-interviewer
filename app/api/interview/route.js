import {
  buildInterviewerPrompt,
  buildProfilePrompt,
  buildReportPrompt,
  MOCK_QUESTIONS,
  MOCK_REPORT,
  MOCK_PROFILE,
} from "../../../lib/prompts";

function parseJsonLoose(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    return null;
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;

async function callLLM(messages, temperature = 0.8, jsonMode = false) {
  const key = process.env.LLM_API_KEY;
  if (!key) return null; // 触发降级假数据

  const base = (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "deepseek-chat";

  const body = { model, messages, temperature, stream: false };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function POST(req) {
  try {
    const { action, resume, target, track, style, transcript, totalRounds, profile } =
      await req.json();

    if (action === "profile") {
      const messages = [
        {
          role: "system",
          content: "你只输出严格合法的 JSON，不输出任何额外文字或代码块。",
        },
        { role: "user", content: buildProfilePrompt({ target, track }) },
      ];
      const raw = await callLLM(messages, 0.5, true);
      if (raw == null) {
        return Response.json({ profile: MOCK_PROFILE, usedMock: true });
      }
      const parsed = parseJsonLoose(raw);
      return Response.json({
        profile: parsed || MOCK_PROFILE,
        usedMock: false,
        parseError: !parsed,
      });
    }

    if (action === "ask") {
      const history = (transcript || []).map((m) => ({
        role: m.role === "interviewer" ? "assistant" : "user",
        content: m.content,
      }));

      const round = Math.ceil(((transcript || []).length + 1) / 2);
      const messages = [
        {
          role: "system",
          content: buildInterviewerPrompt({
            resume,
            target,
            track,
            style,
            totalRounds,
            currentRound: round,
            profile,
          }),
        },
        ...history,
      ];

      let content = await callLLM(messages, 0.85, false);

      let usedMock = false;
      if (content == null) {
        usedMock = true;
        content = MOCK_QUESTIONS[Math.min(round - 1, MOCK_QUESTIONS.length - 1)];
      }

      return Response.json({
        content: String(content).trim(),
        round,
        usedMock,
      });
    }

    if (action === "report") {
      const messages = [
        {
          role: "system",
          content:
            "你是一位严谨的研究生导师，只输出严格合法的 JSON，不输出任何额外文字或代码块。",
        },
        { role: "user", content: buildReportPrompt({ resume, target, track, transcript }) },
      ];

      let raw = await callLLM(messages, 0.6, true);

      if (raw == null) {
        return Response.json({ report: MOCK_REPORT, usedMock: true });
      }

      const parsed = parseJsonLoose(raw);
      if (!parsed) {
        return Response.json({ report: MOCK_REPORT, usedMock: true, parseError: true });
      }
      return Response.json({ report: parsed, usedMock: false });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
