// 项目前置知识库（demo 数据，全部有出处，严禁编造）
// 出处：受访者C（清华公管）、受访者W（复旦管院量化 / 北大经院金融 / 风保），均为 2026 年亲历。

const MODULES = [
  {
    key: "resume",
    label: "简历深挖追问",
    desc: "基于你的简历连续追问，专咬贡献度虚处、难度逐轮递增",
    open: true,
  },
  {
    key: "career",
    label: "职业规划与实习匹配度",
    desc: "专硕刚需：面试官会查规划与实习是否匹配（demo 暂未开放）",
    open: false,
  },
  {
    key: "english",
    label: "专业英语通读 + 逐句翻译",
    desc: "半张纸专业英语，通读后逐句翻译（demo 暂未开放）",
    open: false,
  },
  {
    key: "current",
    label: "时事 / 专业课抽题",
    desc: "本院抽题制常见环节（demo 暂未开放）",
    open: false,
  },
];

export const PROJECTS = {
  "thu-mpp": {
    id: "thu-mpp",
    name: "清华公管 MPP / SDG",
    school: "清华大学 · 公共管理学院",
    track: "professional",
    flow: [
      "老师按你的简历个性化追问（题目基于你的个人材料生成）",
      "没有题库",
      "题目每年更新，难度高于一般 mock",
    ],
    modules: MODULES,
    note: "基于 受访者C 亲历（2026）。跨校申请，老师按简历个性化提问。",
  },
  "fdu-qf": {
    id: "fdu-qf",
    name: "复旦管院 量化金融与金融工程",
    school: "复旦大学 · 管理学院",
    track: "professional",
    flow: [
      "笔试（时长未明确）：高数 / 线代 / 概统 + Python 手写代码",
      "3V3 面试：简历深挖+追问 / 职业规划+实习匹配度 / 英语或专业课",
      "极重视职业规划与实习匹配度（贴姓名签+求职方向）",
    ],
    modules: MODULES,
    note: "基于 受访者W 亲历（2026）。",
  },
  "pku-eco-fin": {
    id: "pku-eco-fin",
    name: "北大经院 金融系",
    school: "北京大学 · 经济学院",
    track: "professional",
    flow: [
      "抽题制（很可能从题库出题）",
      "考时事 + 专业课 + 专业英语（通读 + 逐句翻译）",
      "备考建议：收集保研手册往年题",
    ],
    modules: MODULES,
    note: "基于 受访者W（经院在读，2026）。",
  },
  "pku-eco-ins": {
    id: "pku-eco-ins",
    name: "北大经院 风保系",
    school: "北京大学 · 经济学院",
    track: "professional",
    flow: [
      "抽题制",
      "重点科目：社会保险、风险管理学",
      "英语环节难度波动较大",
    ],
    modules: MODULES,
    note: "基于 受访者W 亲历（2026）。",
  },
};

export function getProject(id, customName, customBg) {
  if (id && PROJECTS[id]) return PROJECTS[id];
  return {
    id: "custom",
    name: customName || "自定义项目",
    school: "自定义",
    track: "professional",
    flow: [
      "你提供的项目背景将作为 AI 出题依据",
      "AI 生成该方向人才画像，并据此连续追问",
      "其余环节 demo 暂未开放",
    ],
    modules: MODULES,
    note:
      (customBg
        ? "你已提供项目背景，AI 据此通用模式生成画像与追问。"
        : "未提供背景，AI 将基于项目名通用生成。") +
      "未来版本将探索把背景沉淀为可复用的项目预设。",
  };
}

export { MODULES };
