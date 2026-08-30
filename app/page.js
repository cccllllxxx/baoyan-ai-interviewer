"use client";

import { useState } from "react";

const TOTAL_ROUNDS = 8;

const STYLES = [
  { key: "pressure", label: "压力型导师", desc: "语速快、直接、不容糊弄，会当场指出你的回答不成立" },
  { key: "academic", label: "学术型导师", desc: "深挖方法论与文献，追问「你凭什么这么认为」" },
  { key: "gentle", label: "温和型导师", desc: "表面引导，实则层层递进把你引到答不上来的地方" },
];

const SAMPLE = `【个人陈述 · 脱敏示例】

本科就读于某顶尖高校，专业排名前 15%。

科研经历一：参与了一项关于在线教育平台用户学习行为的研究，主要负责数据处理和部分建模工作，最终模型效果有显著提升，相关成果已整理为论文投稿。

科研经历二：参与导师国家自然科学基金项目，负责文献调研与实验设计，协助完成了一篇综述文章的撰写。

竞赛经历：参加过全国大学生数学建模竞赛，获得省级奖项，在队内主要负责编程实现。

技能：熟练掌握 Python、机器学习常用框架，了解 Transformer 等深度学习模型。

未来规划：希望在贵院系继续深造，研究方向聚焦于数据挖掘与用户行为分析。`;

export default function Home() {
  const [stage, setStage] = useState("setup"); // setup | interview | report
  const [resume, setResume] = useState("");
  const [target, setTarget] = useState("");
  const [style, setStyle] = useState("pressure");
  const [transcript, setTranscript] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [usedMock, setUsedMock] = useState(false);

  async function ask(transcriptNow) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          resume,
          target,
          style,
          transcript: transcriptNow,
          totalRounds: TOTAL_ROUNDS,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `请求失败 ${res.status}`);
      setUsedMock(!!data.usedMock);
      return data.content;
    } catch (e) {
      setError(String(e.message || e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function makeReport(t) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          resume,
          target,
          transcript: t,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `请求失败 ${res.status}`);
      setReport(data.report);
      setUsedMock(!!data.usedMock);
      setStage("report");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    if (!resume.trim()) {
      setError("请先粘贴你的个人陈述或简历内容。");
      return;
    }
    const q = await ask([]);
    if (!q) return;
    setTranscript([{ role: "interviewer", content: q }]);
    setStage("interview");
  }

  async function submit() {
    const answer = input.trim();
    if (!answer || loading) return;
    const t = [...transcript, { role: "candidate", content: answer }];
    setTranscript(t);
    setInput("");

    const nextRound = Math.floor(t.length / 2) + 1;
    if (nextRound > TOTAL_ROUNDS) {
      makeReport(t);
      return;
    }

    const q = await ask(t);
    if (!q) return;
    const t2 = [...t, { role: "interviewer", content: q }];
    setTranscript(t2);

    if (q.includes("今天的面试就到这里")) {
      makeReport(t2);
    }
  }

  function restart() {
    setStage("setup");
    setTranscript([]);
    setReport(null);
    setInput("");
    setError("");
  }

  const round = Math.floor(transcript.length / 2) + 1;

  return (
    <div className="wrap">
      <header className="bar">
        <h1>复试压力面</h1>
        <div className="sub">
          {stage === "interview"
            ? `第 ${Math.min(round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS} 轮`
            : "AI 模拟面试官"}
        </div>
      </header>

      {error && <div className="banner">{error}</div>}

      {usedMock && !error && (
        <div className="banner">
          当前未配置大模型接口，正在使用演示数据。配置方法见 README。
        </div>
      )}

      {stage === "setup" && (
        <>
          <div className="card">
            <label htmlFor="resume">个人陈述 / 简历内容</label>
            <textarea
              id="resume"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="把你准备提交给导师的个人陈述、或简历里的科研/竞赛经历粘贴进来。内容越真实，追问越准确。"
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="ghost"
                onClick={() => {
                  setResume(SAMPLE);
                  setTarget("某顶尖高校 · 数据挖掘与用户行为方向");
                }}
              >
                填入示例（脱敏）
              </button>
              <span className="hint">示例为假数据，方便快速体验</span>
            </div>
          </div>

          <div className="card">
            <label htmlFor="target">目标院校 / 专业方向（选填）</label>
            <input
              id="target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例：光华管理学院 · 金融硕士"
            />
          </div>

          <div className="card">
            <label>面试官风格</label>
            <div className="styles">
              {STYLES.map((s) => (
                <div
                  key={s.key}
                  className={`style-opt ${style === s.key ? "on" : ""}`}
                  onClick={() => setStyle(s.key)}
                >
                  <div className="n">{s.label}</div>
                  <div className="d">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="primary" onClick={start} disabled={loading}>
            {loading ? "正在准备第一个问题…" : `开始面试（共 ${TOTAL_ROUNDS} 轮追问）`}
          </button>
        </>
      )}

      {stage === "interview" && (
        <>
          <div className="thread">
            {transcript.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "interviewer" ? "q" : "a"}`}>
                <div className="who">{m.role === "interviewer" ? "面试官" : "你"}</div>
                <div className="txt">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="bubble q">
                <div className="who">面试官</div>
                <div className="txt">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="像真实面试那样回答。答得越笼统，追问越狠。"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="primary" onClick={submit} disabled={loading || !input.trim()}>
                提交
              </button>
              <button className="ghost" onClick={() => makeReport(transcript)} disabled={loading}>
                提前结束
              </button>
            </div>
          </div>
          <div className="hint">Ctrl / ⌘ + Enter 提交</div>
        </>
      )}

      {stage === "report" && report && (
        <>
          <div className="card">
            <h2 className="sec" style={{ marginTop: 0 }}>
              追问诊断报告
            </h2>
            <div className="score-box">
              <div className="score-num">{report.overall_score}</div>
              <div className="verdict">{report.one_line_verdict}</div>
            </div>
          </div>

          <h2 className="sec">被问穿的地方</h2>
          {(report.broken_points || []).map((b, i) => (
            <div className="bp" key={i}>
              <div className="q">{b.question}</div>
              <div className="kv">
                <b>你说了</b>
                {b.what_happened}
              </div>
              <div className="kv">
                <b>为什么致命</b>
                {b.why_fatal}
              </div>
              <div className="kv fix">
                <b>怎么改</b>
                {b.fix}
              </div>
            </div>
          ))}

          <h2 className="sec">逐轮表现</h2>
          <div className="card">
            {(report.answer_scores || []).map((a, i) => (
              <div className="round-row" key={i}>
                <div className="r">第 {a.round} 轮</div>
                <div className="main">
                  <div>{a.question}</div>
                  <div style={{ color: "var(--muted)" }}>{a.comment}</div>
                </div>
                <div className="s">{a.star_score}</div>
              </div>
            ))}
          </div>

          <h2 className="sec">接下来最该做的三件事</h2>
          <div className="card">
            <ul className="steps">
              {(report.next_steps || []).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="row">
            <button className="primary" onClick={restart}>
              再练一次
            </button>
          </div>

          <footer className="note">
            本报告由大模型基于你的面试实录生成，用于训练与自查，不构成任何录取结果预测。
          </footer>
        </>
      )}
    </div>
  );
}
