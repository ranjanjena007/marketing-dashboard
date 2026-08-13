import { Router } from "express";
import axios from "axios";
import { campaignData } from "../src/data.js";

const router = Router();

// Build a compact data summary string to inject as context for watsonx
function buildDataContext() {
  const k = campaignData.kpis;
  const lines = [
    "=== Q3 2024 Marketing Campaigns Data Summary ===",
    `Total Campaigns: ${k.totalCampaigns}`,
    `Total Budget: $${k.totalBudget.toLocaleString()}`,
    `Total Spend: $${k.totalSpend.toLocaleString()}`,
    `Total Impressions: ${k.totalImpressions.toLocaleString()}`,
    `Total Clicks: ${k.totalClicks.toLocaleString()}`,
    `Total Conversions: ${k.totalConversions.toLocaleString()}`,
    `Total Revenue: $${k.totalRevenue.toLocaleString()}`,
    `Avg CTR: ${k.avgCTR}%`,
    `Avg Conversion Rate: ${k.avgConvRate}%`,
    `Avg ROI: ${k.avgROI}%`,
    `Budget Utilization: ${k.budgetUtilization}%`,
    "",
    "=== Channel Performance ===",
    ...campaignData.channelStats.map(ch =>
      `${ch.channel}: ${ch.count} campaigns, Revenue=$${ch.revenue.toLocaleString()}, Spend=$${ch.spend.toLocaleString()}, Avg ROI=${ch.avgROI}%, Avg CTR=${ch.avgCTR}%, Conv Rate=${ch.avgConvRate}%`
    ),
    "",
    "=== Campaign Status ===",
    ...campaignData.byStatus.map(s => `${s.status}: ${s.count} campaigns`),
    "",
    "=== Campaign Type Performance ===",
    ...campaignData.typeStats.map(t =>
      `${t.type}: ${t.count} campaigns, Revenue=$${t.revenue.toLocaleString()}, Avg ROI=${t.avgROI}%`
    ),
    "",
    "=== Top 5 Campaigns by ROI ===",
    ...campaignData.top5ROI.map(c =>
      `${c.id} - ${c.name} | Channel: ${c.channel} | ROI: ${c.roi}% | Revenue: $${c.revenue.toLocaleString()}`
    ),
    "",
    "=== Bottom 5 Campaigns by ROI ===",
    ...campaignData.bot5ROI.map(c =>
      `${c.id} - ${c.name} | Channel: ${c.channel} | ROI: ${c.roi}% | Revenue: $${c.revenue.toLocaleString()}`
    ),
    "",
    "=== All 50 Campaigns (ID | Name | Channel | Budget | Spend | Revenue | ROI% | Status) ===",
    ...campaignData.campaigns.map(c =>
      `${c.id} | ${c.name} | ${c.channel} | $${c.budget} | $${c.spend} | $${c.revenue} | ${c.roi}% | ${c.status}`
    ),
  ];
  return lines.join("\n");
}

// Obtain an IAM Bearer token using the API key
async function getIAMToken(apiKey) {
  const resp = await axios.post(
    "https://iam.cloud.ibm.com/identity/token",
    new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return resp.data.access_token;
}

// POST /api/chat   body: { messages: [{role, content}], sessionContext?: string }
router.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const apiKey    = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const modelId   = process.env.WATSONX_MODEL_ID;
  const url       = process.env.WATSONX_URL;

  if (!apiKey || !projectId || !modelId || !url) {
    return res.status(500).json({ error: "watsonx.ai credentials not configured" });
  }

  try {
    // Get IAM token
    const token = await getIAMToken(apiKey);

    const systemPrompt = `You are a marketing analytics expert assistant with access to Q3 2024 campaign data.
Answer questions accurately using the provided data. Be concise and insightful.
When presenting numbers, format them clearly (use $ for currency, % for percentages, K/M for large numbers).
If asked for recommendations, base them on the actual data.

${buildDataContext()}`;

    const payload = {
      model_id: modelId,
      project_id: projectId,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      parameters: {
        max_new_tokens: 1024,
        temperature: 0.3,
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const choice = response.data?.choices?.[0];
    const reply  = choice?.message?.content || choice?.text || "No response received.";

    res.json({ reply });
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data?.errors?.[0]?.message
                 || err.response?.data?.error
                 || err.message
                 || "Failed to get response from watsonx.ai";
    console.error("[chat] watsonx error:", status, message);
    res.status(status).json({ error: message });
  }
});

export default router;
