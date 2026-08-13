/* ─── app.js — Q3 2024 Marketing Dashboard ─────────────────────────────────
   Handles: navigation, API calls, ECharts rendering, campaign table, chatbot
─────────────────────────────────────────────────────────────────────────── */

"use strict";

// ── Palette ──────────────────────────────────────────────────────────────────
const CHANNEL_COLORS = {
  "Email":              "#3b82f6",
  "Search Ads":         "#22c55e",
  "Display Ads":        "#f59e0b",
  "Content Marketing":  "#8b5cf6",
  "Video Ads":          "#ef4444",
  "Social Media":       "#06b6d4",
};
const STATUS_COLORS = {
  "Active":    "#22c55e",
  "Paused":    "#f59e0b",
  "Completed": "#3b82f6",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fmt = {
  money: (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n}`,
  num:   (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n),
  pct:   (n) => `${n}%`,
};

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function initChart(id) {
  const el = $(id);
  if (!el) return null;
  return echarts.init(el, null, { renderer: "canvas" });
}

// ── Navigation ───────────────────────────────────────────────────────────────
const sectionTitles = {
  overview:    "Overview Dashboard",
  channels:    "Channel Performance",
  campaigns:   "Campaign Explorer",
  performance: "Performance Insights",
  chatbot:     "AI Marketing Assistant",
};

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const target = item.dataset.section;
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    item.classList.add("active");
    document.getElementById(`section-${target}`)?.classList.add("active");
    $("sectionTitle").textContent = sectionTitles[target] || target;
    // Trigger chart render if not already rendered
    if (target === "channels"    && !chartsRendered.channels)    renderChannelCharts();
    if (target === "performance" && !chartsRendered.performance) renderPerformanceCharts();
  });
});

// Mobile toggle
$("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── Chart render tracking ─────────────────────────────────────────────────────
const chartsRendered = { overview: false, channels: false, performance: false };

// ── State ─────────────────────────────────────────────────────────────────────
let allCampaigns   = [];
let channelStats   = [];
let typeStats      = [];
let byStatus       = [];
let monthlyTrend   = [];
let topPerformers  = { top5: [], bottom5: [] };

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async function init() {
  try {
    const [kpis, campaigns, channels, statuses, types, monthly, performers] = await Promise.all([
      fetchJSON("/api/kpis"),
      fetchJSON("/api/campaigns"),
      fetchJSON("/api/channel-stats"),
      fetchJSON("/api/status-breakdown"),
      fetchJSON("/api/type-stats"),
      fetchJSON("/api/monthly-trend"),
      fetchJSON("/api/top-performers"),
    ]);

    allCampaigns  = campaigns;
    channelStats  = channels;
    byStatus      = statuses;
    typeStats     = types;
    monthlyTrend  = monthly;
    topPerformers = performers;

    renderKPIs(kpis);
    renderOverviewCharts();
    renderCampaignTable(allCampaigns);
    renderInsights(kpis);
    chartsRendered.overview = true;
  } catch (err) {
    console.error("Init failed:", err);
  }
})();

// ── KPI cards ─────────────────────────────────────────────────────────────────
function renderKPIs(k) {
  const cards = [
    { label: "Total Revenue",      value: fmt.money(k.totalRevenue),     sub: `Budget: ${fmt.money(k.totalBudget)}`,          icon: "💰", cls: "kpi-pos" },
    { label: "Total Spend",        value: fmt.money(k.totalSpend),       sub: `Utilization: ${k.budgetUtilization}%`,          icon: "💳", cls: "" },
    { label: "Total Impressions",  value: fmt.num(k.totalImpressions),   sub: `Clicks: ${fmt.num(k.totalClicks)}`,             icon: "👁️", cls: "" },
    { label: "Total Conversions",  value: fmt.num(k.totalConversions),   sub: `Avg Conv Rate: ${k.avgConvRate}%`,              icon: "🎯", cls: "" },
    { label: "Avg ROI",            value: fmt.pct(k.avgROI),             sub: k.avgROI >= 0 ? "Positive return" : "Negative", icon: "📈", cls: k.avgROI >= 0 ? "kpi-pos" : "kpi-neg" },
    { label: "Avg CTR",            value: fmt.pct(k.avgCTR),             sub: `50 campaigns · Q3 2024`,                        icon: "🖱️", cls: "" },
  ];
  const grid = $("kpiGrid");
  grid.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value ${c.cls}">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
      <div class="kpi-accent">${c.icon}</div>
    </div>`).join("");
}

// ── Overview Charts ───────────────────────────────────────────────────────────
function renderOverviewCharts() {
  // 1. Revenue vs Spend by Channel (grouped bar)
  const ch1 = initChart("chartChannelRevSpend");
  if (ch1) {
    const names   = channelStats.map(c => c.channel);
    const spends  = channelStats.map(c => c.spend);
    const revs    = channelStats.map(c => c.revenue);
    ch1.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (p) => p.map(s => `${s.marker}${s.seriesName}: $${s.value.toLocaleString()}`).join("<br/>") },
      legend: { data: ["Spend", "Revenue"], top: 0, right: 0, textStyle: { fontSize: 12 } },
      grid: { left: 60, right: 20, top: 34, bottom: 60 },
      xAxis: { type: "category", data: names, axisLabel: { rotate: 15, fontSize: 11 } },
      yAxis: { type: "value", axisLabel: { formatter: v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K` } },
      series: [
        { name: "Spend",   type: "bar", data: spends, itemStyle: { color: "#3b82f6" }, barGap: "0%" },
        { name: "Revenue", type: "bar", data: revs,   itemStyle: { color: "#22c55e" } },
      ],
    });
  }

  // 2. Status Pie
  const ch2 = initChart("chartStatus");
  if (ch2) {
    ch2.setOption({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { orient: "vertical", left: 10, top: "center", textStyle: { fontSize: 12 } },
      series: [{
        type: "pie",
        radius: ["40%", "70%"],
        center: ["62%", "50%"],
        avoidLabelOverlap: true,
        label: { show: true, formatter: "{b}\n{d}%", fontSize: 11 },
        data: byStatus.map(s => ({ name: s.status, value: s.count, itemStyle: { color: STATUS_COLORS[s.status] } })),
      }],
    });
  }

  // 3. Monthly Trend (line)
  const ch3 = initChart("chartMonthly");
  if (ch3) {
    const months = monthlyTrend.map(m => m.month);
    ch3.setOption({
      tooltip: { trigger: "axis",
        formatter: (p) => `<b>${p[0].name}</b><br/>` + p.map(s => `${s.marker}${s.seriesName}: $${s.value.toLocaleString()}`).join("<br/>") },
      legend: { data: ["Spend", "Revenue"], top: 0, right: 0 },
      grid: { left: 70, right: 20, top: 34, bottom: 40 },
      xAxis: { type: "category", data: months },
      yAxis: { type: "value", axisLabel: { formatter: v => `$${(v/1e3).toFixed(0)}K` } },
      series: [
        { name: "Spend",   type: "line", data: monthlyTrend.map(m => m.spend),   smooth: true, symbol: "circle", symbolSize: 6, itemStyle: { color: "#3b82f6" }, areaStyle: { opacity: .08 } },
        { name: "Revenue", type: "line", data: monthlyTrend.map(m => m.revenue), smooth: true, symbol: "circle", symbolSize: 6, itemStyle: { color: "#22c55e" }, areaStyle: { opacity: .08 } },
      ],
    });
  }

  // 4. Campaign Type Avg ROI (horizontal bar)
  const ch4 = initChart("chartTypeROI");
  if (ch4) {
    const sorted = [...typeStats].sort((a,b) => b.avgROI - a.avgROI);
    ch4.setOption({
      tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: { type: "value", axisLabel: { formatter: v => `${v}%` } },
      yAxis: { type: "category", data: sorted.map(t => t.type), axisLabel: { fontSize: 11 } },
      series: [{
        type: "bar",
        data: sorted.map(t => ({
          value: t.avgROI,
          itemStyle: { color: t.avgROI >= 0 ? "#22c55e" : "#ef4444", borderRadius: [0,4,4,0] },
        })),
        label: { show: true, position: "right", formatter: "{c}%", fontSize: 11 },
      }],
    });
  }

  // Resize on window resize
  window.addEventListener("resize", () => { ch1?.resize(); ch2?.resize(); ch3?.resize(); ch4?.resize(); });
}

// ── Channel Charts ────────────────────────────────────────────────────────────
function renderChannelCharts() {
  chartsRendered.channels = true;
  const names = channelStats.map(c => c.channel);
  const colors = names.map(n => CHANNEL_COLORS[n] || "#6b7280");

  // ROI by channel
  const c1 = initChart("chartChannelROI");
  if (c1) {
    const sorted = [...channelStats].sort((a,b) => b.avgROI - a.avgROI);
    c1.setOption({
      tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
      grid: { left: 120, right: 60, top: 10, bottom: 20 },
      xAxis: { type: "value", axisLabel: { formatter: v => `${v}%` } },
      yAxis: { type: "category", data: sorted.map(c => c.channel), axisLabel: { fontSize: 11 } },
      series: [{
        type: "bar",
        data: sorted.map(c => ({
          value: c.avgROI,
          itemStyle: { color: c.avgROI >= 0 ? CHANNEL_COLORS[c.channel] : "#ef4444", borderRadius: [0,4,4,0] },
        })),
        label: { show: true, position: "right", formatter: v => `${v.value}%`, fontSize: 11 },
      }],
    });
  }

  // Conversion rate (pie)
  const c2 = initChart("chartChannelConv");
  if (c2) {
    c2.setOption({
      tooltip: { trigger: "item", formatter: "{b}: {c}%" },
      legend: { orient: "vertical", left: 0, top: "center", textStyle: { fontSize: 11 } },
      series: [{
        type: "pie", radius: ["35%", "65%"], center: ["65%", "50%"],
        label: { show: true, formatter: "{d}%", fontSize: 11 },
        data: channelStats.map(c => ({ name: c.channel, value: c.avgConvRate, itemStyle: { color: CHANNEL_COLORS[c.channel] } })),
      }],
    });
  }

  // CTR (bar)
  const c3 = initChart("chartChannelCTR");
  if (c3) {
    const sorted = [...channelStats].sort((a,b) => b.avgCTR - a.avgCTR);
    c3.setOption({
      tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
      grid: { left: 120, right: 60, top: 10, bottom: 20 },
      xAxis: { type: "value", axisLabel: { formatter: v => `${v}%` } },
      yAxis: { type: "category", data: sorted.map(c => c.channel), axisLabel: { fontSize: 11 } },
      series: [{
        type: "bar", barMaxWidth: 30,
        data: sorted.map(c => ({ value: c.avgCTR, itemStyle: { color: CHANNEL_COLORS[c.channel], borderRadius: [0,4,4,0] } })),
        label: { show: true, position: "right", formatter: v => `${v.value}%`, fontSize: 11 },
      }],
    });
  }

  // Budget vs Spend vs Revenue
  const c4 = initChart("chartChannelBudget");
  if (c4) {
    c4.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
        formatter: p => `<b>${p[0].name}</b><br/>` + p.map(s => `${s.marker}${s.seriesName}: $${s.value.toLocaleString()}`).join("<br/>") },
      legend: { data: ["Budget", "Spend", "Revenue"], top: 0, right: 0 },
      grid: { left: 70, right: 20, top: 34, bottom: 70 },
      xAxis: { type: "category", data: names, axisLabel: { rotate: 20, fontSize: 11 } },
      yAxis: { type: "value", axisLabel: { formatter: v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K` } },
      series: [
        { name: "Budget",  type: "bar", data: channelStats.map(c => c.budget),  itemStyle: { color: "#93c5fd" } },
        { name: "Spend",   type: "bar", data: channelStats.map(c => c.spend),   itemStyle: { color: "#3b82f6" } },
        { name: "Revenue", type: "bar", data: channelStats.map(c => c.revenue), itemStyle: { color: "#22c55e" } },
      ],
    });
  }

  window.addEventListener("resize", () => { c1?.resize(); c2?.resize(); c3?.resize(); c4?.resize(); });

  // Channel scorecards
  const grid = $("channelGrid");
  if (grid) {
    grid.innerHTML = channelStats.map(ch => `
      <div class="channel-card" style="--ch-color:${CHANNEL_COLORS[ch.channel]}">
        <div class="ch-name">${ch.channel}</div>
        <div class="ch-stats">
          <div class="ch-stat"><strong>${ch.count}</strong>Campaigns</div>
          <div class="ch-stat"><strong>${fmt.money(ch.revenue)}</strong>Revenue</div>
          <div class="ch-stat"><strong>${fmt.money(ch.spend)}</strong>Spend</div>
          <div class="ch-stat"><strong>${ch.avgCTR}%</strong>Avg CTR</div>
          <div class="ch-stat"><strong>${ch.avgConvRate}%</strong>Conv Rate</div>
          <div class="ch-stat"><strong>${ch.conversions.toLocaleString()}</strong>Conversions</div>
        </div>
        <span class="ch-roi ${ch.avgROI >= 0 ? "roi-pos" : "roi-neg"}">
          Avg ROI: ${ch.avgROI}%
        </span>
      </div>`).join("");
  }
}

// ── Campaign Table ─────────────────────────────────────────────────────────────
function renderCampaignTable(data) {
  const tbody = $("campaignTbody");
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:#57606a">No campaigns match the current filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td style="font-size:11px;color:#57606a">${c.id}</td>
      <td>${c.name}</td>
      <td><span style="color:${CHANNEL_COLORS[c.channel]||"#6b7280"};font-weight:600">${c.channel}</span></td>
      <td>$${c.budget.toLocaleString()}</td>
      <td>$${c.spend.toLocaleString()}</td>
      <td>$${c.revenue.toLocaleString()}</td>
      <td>${c.ctr}%</td>
      <td>${c.convRate}%</td>
      <td class="roi-cell ${c.roi >= 0 ? "positive" : "negative"}">${c.roi}%</td>
      <td><span class="status-badge status-${c.status}">${c.status}</span></td>
    </tr>`).join("");
}

// ── Campaign Table Filters ─────────────────────────────────────────────────────
let tableData = [];
function applyFilters() {
  const ch  = $("filterChannel").value;
  const st  = $("filterStatus").value;
  const so  = $("sortBy").value;
  const q   = $("searchCamp").value.toLowerCase();
  let list  = [...allCampaigns];
  if (ch) list = list.filter(c => c.channel === ch);
  if (st) list = list.filter(c => c.status  === st);
  if (q)  list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  if (so === "roi")     list.sort((a,b) => b.roi - a.roi);
  if (so === "-roi")    list.sort((a,b) => a.roi - b.roi);
  if (so === "revenue") list.sort((a,b) => b.revenue - a.revenue);
  renderCampaignTable(list);
}
["filterChannel","filterStatus","sortBy"].forEach(id => $(id)?.addEventListener("change", applyFilters));
$("searchCamp")?.addEventListener("input", applyFilters);

// ── Performance Charts ─────────────────────────────────────────────────────────
function renderPerformanceCharts() {
  chartsRendered.performance = true;

  // Top 5 vs Bottom 5 ROI (grouped bar)
  const p1 = initChart("chartTopBot");
  if (p1) {
    const top5   = topPerformers.top5;
    const bot5   = topPerformers.bottom5;
    const allCmp = [...top5, ...bot5];
    const labels = allCmp.map(c => c.name.replace(/^.+- (.+) \d+$/, "$1 $id").replace("$id", c.id.slice(-3)));
    p1.setOption({
      tooltip: { trigger: "axis",
        formatter: p => `<b>${p[0].name}</b><br/>ROI: ${p[0].value}%` },
      grid: { left: 30, right: 40, top: 10, bottom: 80 },
      xAxis: { type: "category", data: labels, axisLabel: { rotate: 30, fontSize: 10, interval: 0 } },
      yAxis: { type: "value", axisLabel: { formatter: v => `${v}%` } },
      series: [{
        type: "bar",
        data: allCmp.map((c, i) => ({
          value: c.roi,
          itemStyle: {
            color: i < 5 ? "#22c55e" : "#ef4444",
            borderRadius: c.roi >= 0 ? [4,4,0,0] : [0,0,4,4],
          },
        })),
        label: { show: true, position: v => v.value >= 0 ? "top" : "bottom", formatter: v => `${v.value}%`, fontSize: 10 },
      }],
    });
  }

  // Revenue by Campaign Type (pie)
  const p2 = initChart("chartTypeRevenue");
  if (p2) {
    const typeColors = ["#3b82f6","#22c55e","#f59e0b","#8b5cf6","#ef4444"];
    p2.setOption({
      tooltip: { trigger: "item", formatter: "{b}: ${c.toLocaleString()} ({d}%)" },
      legend: { orient: "vertical", left: 0, top: "center", textStyle: { fontSize: 11 } },
      series: [{
        type: "pie", radius: ["35%", "65%"], center: ["65%", "50%"],
        label: { show: true, formatter: "{d}%", fontSize: 11 },
        data: typeStats.map((t, i) => ({ name: t.type, value: t.revenue, itemStyle: { color: typeColors[i % typeColors.length] } })),
      }],
    });
  }

  // Scatter: Spend vs Revenue (bubble = conversions)
  const p3 = initChart("chartScatter");
  if (p3) {
    const scatterData = allCampaigns.map(c => ({
      name:  c.name,
      value: [c.spend, c.revenue, c.conversions],
      channel: c.channel,
      itemStyle: { color: CHANNEL_COLORS[c.channel] || "#6b7280", opacity: 0.75 },
    }));
    p3.setOption({
      tooltip: {
        formatter: p => `<b>${p.data.name}</b><br/>Channel: ${p.data.channel}<br/>Spend: $${p.data.value[0].toLocaleString()}<br/>Revenue: $${p.data.value[1].toLocaleString()}<br/>Conversions: ${p.data.value[2]}`,
      },
      legend: {
        data: Object.keys(CHANNEL_COLORS),
        top: 0, type: "scroll", textStyle: { fontSize: 11 },
      },
      grid: { left: 70, right: 20, top: 40, bottom: 50 },
      xAxis: { type: "value", name: "Spend ($)", nameLocation: "end", axisLabel: { formatter: v => `$${(v/1e3).toFixed(0)}K` } },
      yAxis: { type: "value", name: "Revenue ($)", nameLocation: "end", axisLabel: { formatter: v => `$${(v/1e3).toFixed(0)}K` } },
      series: Object.keys(CHANNEL_COLORS).map(ch => ({
        name: ch,
        type: "scatter",
        symbolSize: d => Math.max(8, Math.sqrt(d[2]) * 2),
        data: scatterData.filter(d => d.channel === ch),
        itemStyle: { color: CHANNEL_COLORS[ch], opacity: 0.78 },
      })),
    });
  }

  window.addEventListener("resize", () => { p1?.resize(); p2?.resize(); p3?.resize(); });
}

// ── Insights ──────────────────────────────────────────────────────────────────
function renderInsights(k) {
  const grid = $("insightsGrid");
  if (!grid) return;
  const insights = [
    {
      type: "good",
      title: "🏆 Top Performing Channel",
      body: `<strong>Search Ads</strong> leads with avg ROI of <strong>275.37%</strong> across 9 campaigns, generating $704,875 in revenue on $234,178 spend.`,
    },
    {
      type: "warn",
      title: "⚠️ Display Ads Underperforming",
      body: `Display Ads averages <strong>-60.69% ROI</strong> across 10 campaigns. Consider reducing budget allocation — it drives the most impressions but only 0.61% CTR and 0.61% conv rate.`,
    },
    {
      type: "good",
      title: "💰 Best Budget Efficiency",
      body: `<strong>Video Ads</strong> generated $779,505 revenue on $253,029 spend (avg ROI 258%). With the highest conversion count (4,353), it delivers strong volume.`,
    },
    {
      type: "info",
      title: "📊 Budget Utilization",
      body: `Overall budget utilization stands at <strong>${k.budgetUtilization}%</strong> ($${(k.totalSpend/1e6).toFixed(2)}M of $${(k.totalBudget/1e6).toFixed(2)}M). Some paused campaigns may have under-spent.`,
    },
    {
      type: "good",
      title: "🎯 Retargeting is Effective",
      body: `Retargeting campaigns average <strong>170.74% ROI</strong> — highest among all campaign types — with $585,922 total revenue.`,
    },
    {
      type: "warn",
      title: "📉 14 Campaigns Paused",
      body: `28% of campaigns are currently paused. Review paused campaigns — some (e.g., Video Ads Lead Gen #15 at 730% ROI) were paused despite strong performance.`,
    },
  ];
  grid.innerHTML = insights.map(i => `
    <div class="insight-card ${i.type}">
      <div class="insight-title">${i.title}</div>
      <div class="insight-body">${i.body}</div>
    </div>`).join("");
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
const chatHistory = [];

function addMessage(role, content, isThinking = false) {
  const win = $("chatWindow");
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  const isUser = role === "user";
  div.innerHTML = `
    <div class="chat-avatar">${isUser ? "👤" : "🤖"}</div>
    <div class="chat-bubble ${isThinking ? "thinking" : ""}">${isThinking ? "Thinking…" : renderMarkdown(content)}</div>
  `;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
  return div;
}

// Minimal markdown → HTML (bold, code, lists, line breaks)
function renderMarkdown(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code style='background:#f0f2f5;padding:1px 4px;border-radius:3px'>$1</code>")
    .replace(/^### (.+)$/gm, "<h4 style='margin:8px 0 4px;font-size:13px'>$1</h4>")
    .replace(/^## (.+)$/gm,  "<h3 style='margin:8px 0 4px;font-size:14px'>$1</h3>")
    .replace(/^# (.+)$/gm,   "<h2 style='margin:8px 0 4px;font-size:15px'>$1</h2>")
    .replace(/^\- (.+)$/gm,  "<li style='margin-bottom:3px'>$1</li>")
    .replace(/(<li.*<\/li>(\n|$))+/g, m => `<ul style='padding-left:18px;margin:6px 0'>${m}</ul>`)
    .replace(/\n/g, "<br/>");
}

async function sendMessage(userText) {
  userText = userText.trim();
  if (!userText) return;

  const input   = $("chatInput");
  const sendBtn = $("sendBtn");
  input.value   = "";
  sendBtn.disabled = true;

  addMessage("user", userText);
  chatHistory.push({ role: "user", content: userText });

  const thinkDiv = addMessage("assistant", "", true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory }),
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Request failed");

    const reply = data.reply || "No response received.";
    chatHistory.push({ role: "assistant", content: reply });
    thinkDiv.querySelector(".chat-bubble").className = "chat-bubble";
    thinkDiv.querySelector(".chat-bubble").innerHTML = renderMarkdown(reply);
  } catch (err) {
    thinkDiv.querySelector(".chat-bubble").className = "chat-bubble";
    thinkDiv.querySelector(".chat-bubble").innerHTML =
      `<span style="color:#dc2626">⚠️ Error: ${err.message}. Please check the server logs.</span>`;
  } finally {
    sendBtn.disabled = false;
    input.focus();
    $("chatWindow").scrollTop = $("chatWindow").scrollHeight;
  }
}

$("sendBtn")?.addEventListener("click", () => sendMessage($("chatInput").value));
$("chatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage($("chatInput").value); }
});

document.querySelectorAll(".suggest-btn").forEach(btn => {
  btn.addEventListener("click", () => sendMessage(btn.dataset.q));
});
