"use client";

import { useState, useEffect, useRef } from "react";
import { PROJECTS, getProject, MODULES } from "../lib/projects";

const MAIN_STAGES = 6; // 主问题 / 环节数：对齐真实保研复试结构（自我介绍→动机→科研贡献→专业→热点→综合），每个环节内自适应追问
const MAX_EXCHANGES = 16; // 安全上限：真正结束由模型在 6 环节走完后触发「今天的面试就到这里」

const TRACKS = [
  { key: "academic", label: "学术型（科研导向 / 直博）", desc: "深挖研究设计、因果识别、文献对话" },
  { key: "professional", label: "专业型（专硕）", desc: "深挖实习产出、案例分析、行业理解" },
];

const STYLES = [
  { key: "pressure", label: "压力型导师", desc: "语速快、直接、不留情面，当场指出你的回答不成立" },
  { key: "academic", label: "学术型导师", desc: "深挖方法论与文献，追问「你凭什么这么认为」" },
  { key: "practice", label: "实务型导师", desc: "有业界背景，关注落地性，对空话零容忍" },
  { key: "gentle", label: "温和型导师", desc: "表面引导，实则层层递进把你引到答不上来的地方" },
];

const DIM_LABELS = {
  thinking: "问题意识",
  evidence: "论据支撑",
  structure: "表达结构",
  pressure: "抗压诚实度",
};

const SAMPLE = `【个人陈述 · 脱敏示例】

本科就读于某顶尖高校经济管理专业，专业排名前 20%。

科研经历：参与导师一项关于居民消费行为的研究课题，主要负责数据整理与部分回归分析工作。研究发现消费券政策对中等收入群体效果较为明显，相关成果已整理为工作论文。

实习经历一：在某券商研究所消费组实习三个月，协助分析师完成行业数据跟踪与会议纪要整理，参与撰写了两篇深度报告的部分章节。

实习经历二：在某互联网公司战略部实习，参与竞品分析，独立完成了一份用户调研报告。

课程与技能：修读过计量经济学、公司金融等课程，熟练使用 Stata、Python。

未来规划：希望在贵院系继续攻读金融方向，未来从事研究工作。`;

function profileToText(p) {
  if (!p) return "";
  const lines = [];
  if (p.summary) lines.push(`一句话：${p.summary}`);
  (p.criteria || []).forEach((c) => {
    lines.push(`- ${c.name}：${c.what}（考生应能拿出：${c.evidence}）`);
  });
  (p.red_flags || []).forEach((r) => lines.push(`淘汰项：${r}`));
  if (p.watch_for) lines.push(`最爱追问的点：${p.watch_for}`);
  return lines.join("\n");
}

export default function Home() {
  const [stage, setStage] = useState("setup"); // setup | profile | interview | report
  const [resume, setResume] = useState("");
  const [fileName, setFileName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customBg, setCustomBg] = useState("");
  const [track, setTrack] = useState("professional");
  const [style, setStyle] = useState("gentle");
  const [transcript, setTranscript] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [usedMock, setUsedMock] = useState(false);
  const [profile, setProfile] = useState(null);

  // 节奏把控
  const [answerTimes, setAnswerTimes] = useState([]);
  const qStartRef = useRef(null);
  const [tick, setTick] = useState(0);
  // 每题建议答题时长（秒）——由用户自行设定，默认 90s 仅作演示占位；
  // 「需要节奏把控」已被 受访者Y 访谈验证，但具体秒数无出处，故交给用户按自身项目经验定。
  const [perQ, setPerQ] = useState(90);

  const sel = getProject(projectId, customName, customBg);

  async function ask(transcriptNow, profileObj) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          resume,
          target: sel.name,
          track,
          style,
          transcript: transcriptNow,
          totalRounds: MAIN_STAGES,
          profile: profileObj ? profileToText(profileObj) : "",
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
          target: sel.name,
          track,
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

  // 第一步：先让 AI 说清楚这个方向要什么样的人，再据此考察
  async function handleResumeFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");
      setResume(data.text);
      setFileName(f.name + (data.truncated ? "（已截断至前 2 万字）" : ""));
    } catch (err) {
      setError("文件读取失败：" + err.message + "。可改为直接粘贴文字。");
      setFileName("");
    }
  }

  async function goProfile() {
    if (!resume.trim() || (!projectId && !custom)) {
      setError("请先选择一个项目（或自定义），并粘贴你的个人陈述 / 简历。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile", target: sel.name, track }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `请求失败 ${res.status}`);
      setProfile(data.profile);
      setUsedMock(!!data.usedMock);
      setStage("profile");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    const q = await ask([], profile);
    if (!q) return;
    setTranscript([{ role: "interviewer", content: q }]);
    setStage("interview");
  }

  async function submit() {
    const answer = input.trim();
    if (!answer || loading) return;
    const dur = qStartRef.current ? Math.round((Date.now() - qStartRef.current) / 1000) : 0;
    setAnswerTimes((arr) => [...arr, dur]);
    const t = [...transcript, { role: "candidate", content: answer }];
    setTranscript(t);
    setInput("");

    const nextRound = Math.floor(t.length / 2) + 1;
    if (nextRound > MAX_EXCHANGES) {
      makeReport(t);
      return;
    }

    const q = await ask(t, profile);
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
    setProfile(null);
    setAnswerTimes([]);
    setProjectId("");
    setCustom(false);
    setCustomName("");
    setCustomBg("");
  }

  const qCount = transcript.filter((m) => m.role === "interviewer").length;
  const elapsed = qStartRef.current ? Math.floor((Date.now() - qStartRef.current) / 1000) : 0;
  const over = elapsed > perQ;

  // 面试进行中：每秒刷新计时
  useEffect(() => {
    if (stage !== "interview") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  // 新出现一道题时，重置计时起点
  useEffect(() => {
    qStartRef.current = Date.now();
  }, [qCount]);

  const round = Math.floor(transcript.length / 2) + 1;
  const avgTime = answerTimes.length
    ? Math.round(answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length)
    : 0;
  const maxTime = answerTimes.length ? Math.max(...answerTimes) : 0;
  const overCount = answerTimes.filter((t) => t > perQ).length;

  return (
    <div className="wrap">
      <header className="bar">
        <h1>保研复试 · AI 陪练</h1>
        <div className="sub">
          {stage === "interview"
            ? `复试现场 · 3 位考官 · 第 ${round} 问`
            : "人文社科 · 经管保研"}
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
            <label>① 选择你要准备的项目</label>
            <div className="proj-grid">
              {Object.values(PROJECTS).map((p) => (
                <div
                  key={p.id}
                  className={`proj ${projectId === p.id && !custom ? "on" : ""}`}
                  onClick={() => {
                    setProjectId(p.id);
                    setCustom(false);
                  }}
                >
                  <div className="pn">{p.name}</div>
                  <div className="ps">{p.school}</div>
                </div>
              ))}
              <div
                className={`proj ${custom ? "on" : ""}`}
                onClick={() => {
                  setCustom(true);
                  setProjectId("");
                }}
              >
                <div className="pn">＋ 自定义项目</div>
                <div className="ps">输入项目名 + 背景</div>
              </div>
            </div>
          </div>

          {sel && (
            <div className="card">
              <div className="plabel">② 该项目真实面试流程（{sel.name}）</div>
              <ul className="steps">
                {sel.flow.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <div className="hint">{sel.note}</div>

              <div style={{ marginTop: 18 }}>
                <label>③ 选择要练习的环节</label>
                <div className="mods">
                  {MODULES.map((m) => (
                    <div key={m.key} className={`mod ${m.open ? "on" : "off"}`}>
                      <div className="mn">
                        {m.label}
                        {!m.open && <span className="tag">暂未开放</span>}
                      </div>
                      <div className="md">{m.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="hint">
                  本 demo 只开放「简历深挖追问」，其余环节灰度显示 —— 完整产品将逐步开放。
                </div>
              </div>
            </div>
          )}

          {custom && (
            <div className="card">
              <label>自定义项目名</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="例：某高校某学院 某硕士项目"
              />
              <label style={{ marginTop: 14 }}>
                项目背景（你了解的面试形式 / 环节，喂给 AI）
              </label>
              <textarea
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                placeholder="例：这个项目的面试是 3V3，一个面试官问简历深挖，一个问职业规划，一个问英语；他们很看重实习与规划的匹配度。"
                style={{ minHeight: 120 }}
              />
              <div className="hint">
                你勾选的环节与背景会作为 AI 出题依据。未来版本将探索把这类背景沉淀为可复用的项目预设。
              </div>
            </div>
          )}

          <div className="card">
            <label htmlFor="resume">上传 / 粘贴你的个人陈述 / 简历</label>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleResumeFile}
                style={{ fontSize: 13 }}
              />
              {fileName && (
                <button className="ghost" onClick={() => setFileName("")}>
                  清除
                </button>
              )}
            </div>
            {fileName && (
              <div className="hint" style={{ marginBottom: 8 }}>
                已读取：{fileName}
              </div>
            )}
            <textarea
              id="resume"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="把准备提交给导师的个人陈述，或简历里的科研 / 实习经历粘贴进来；也可直接上传 PDF / Word 文件，系统会自动提取文字。内容越真实，追问越准。"
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="ghost"
                onClick={() => {
                  setResume(SAMPLE);
                }}
              >
                填入示例（脱敏）
              </button>
              <span className="hint">示例为假数据，方便快速体验</span>
            </div>
          </div>

          <div className="card">
            <label htmlFor="perQ">每题建议答题时长（秒）</label>
            <input
              id="perQ"
              type="number"
              min="20"
              max="300"
              step="10"
              value={perQ}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setPerQ(v);
              }}
              style={{ maxWidth: 140 }}
            />
            <span className="hint">
              不同项目节奏不同，按你了解的情况填（本院抽题制可填 60，跨校深挖可填 120）。
              默认 90 为演示占位值；「需要节奏把控」已被访谈验证，具体秒数无统一标准，故由你自定。
            </span>
          </div>

          <div className="card">
            <label>项目类型</label>
            <div className="styles two">
              {TRACKS.map((t) => (
                <div
                  key={t.key}
                  className={`style-opt ${track === t.key ? "on" : ""}`}
                  onClick={() => setTrack(t.key)}
                >
                  <div className="n">{t.label}</div>
                  <div className="d">{t.desc}</div>
                </div>
              ))}
            </div>
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

          <button className="primary" onClick={goProfile} disabled={loading}>
            {loading ? "正在生成评判标准…" : "下一步：先看这个方向要什么样的人"}
          </button>
        </>
      )}

      {stage === "profile" && profile && (
        <>
          <div className="card profile-card">
            <div className="plabel">这个方向要什么样的人</div>
            <div className="psummary">{profile.summary}</div>
            <div className="phint">
              接下来的追问会严格按这套标准，逐环节深挖你材料里最虚的地方。
            </div>
          </div>

          <h2 className="sec">四条评判标准</h2>
          <div className="card">
            {(profile.criteria || []).map((c, i) => (
              <div className="crit" key={i}>
                <div className="cn">
                  {i + 1}. {c.name}
                </div>
                <div className="cw">{c.what}</div>
                <div className="ce">你要能拿出：{c.evidence}</div>
              </div>
            ))}
          </div>

          <h2 className="sec">淘汰项</h2>
          <div className="card">
            <ul className="steps red">
              {(profile.red_flags || []).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {profile.watch_for && (
            <>
              <h2 className="sec">这个方向最爱追问</h2>
              <div className="card watch">{profile.watch_for}</div>
            </>
          )}

          <div className="row">
            <button className="primary" onClick={start} disabled={loading}>
              {loading ? "正在进入考场…" : `进入考场 · 开始复试`}
            </button>
            <button className="ghost" onClick={() => setStage("setup")} disabled={loading}>
              返回修改
            </button>
          </div>
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

          <div className={`timer ${over ? "over" : ""}`}>
            建议 {perQ}s · 已用 {elapsed}s{over ? " · 超时，试着压缩到 1 分钟内" : ""}
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

            {answerTimes.length > 0 && (
              <div className="rhythm">
                <div className="rl">节奏表现</div>
                <div className="rg">
                  <span>平均答题 {avgTime}s</span>
                  <span>最长 {maxTime}s</span>
                  <span className={overCount > 0 ? "bad" : ""}>
                    超时 {overCount} 次
                  </span>
                </div>
                <div className="rh">
                  建议每题控制在 {perQ}s 内；超时往往说明论点不够聚焦，先把核心结论说在前。
                </div>
              </div>
            )}

            {report.dimension_scores && (
              <div className="dims">
                {Object.keys(DIM_LABELS).map((k) => (
                  <div className="dim" key={k}>
                    <div className="dl">{DIM_LABELS[k]}</div>
                    <div className="db">
                      <div className="df" style={{ width: `${(report.dimension_scores[k] || 0) * 10}%` }} />
                    </div>
                    <div className="dv">{report.dimension_scores[k] ?? "-"}</div>
                  </div>
                ))}
              </div>
            )}
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
                <b>致命在</b>
                {b.why_fatal}
              </div>
              <div className="kv fix">
                <b>补哪些知识点</b>
                {b.fix}
              </div>
            </div>
          ))}

          {Array.isArray(report.study_map) && report.study_map.length > 0 && (
            <>
              <h2 className="sec">该补的知识地图</h2>
              {(report.study_map || []).map((s, i) => (
                <div className="bp" key={i}>
                  <div className="q">{s.module}</div>
                  <div className="kv">
                    <b>为什么缺</b>
                    {s.gap}
                  </div>
                  <div className="kv">
                    <b>检索关键词</b>
                    {s.keywords}
                  </div>
                  <div className="kv fix">
                    <b>怎么补</b>
                    {s.resource}
                  </div>
                </div>
              ))}
            </>
          )}

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
