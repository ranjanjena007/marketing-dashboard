import { Router } from "express";
import { campaignData } from "../src/data.js";

const router = Router();

// GET /api/kpis
router.get("/kpis", (req, res) => {
  res.json(campaignData.kpis);
});

// GET /api/campaigns  — supports ?channel=&status=&sort=roi
router.get("/campaigns", (req, res) => {
  let list = [...campaignData.campaigns];
  if (req.query.channel) list = list.filter(c => c.channel === req.query.channel);
  if (req.query.status)  list = list.filter(c => c.status  === req.query.status);
  if (req.query.sort === "roi")     list.sort((a,b) => b.roi - a.roi);
  if (req.query.sort === "-roi")    list.sort((a,b) => a.roi - b.roi);
  if (req.query.sort === "revenue") list.sort((a,b) => b.revenue - a.revenue);
  res.json(list);
});

// GET /api/channel-stats
router.get("/channel-stats", (req, res) => {
  res.json(campaignData.channelStats);
});

// GET /api/status-breakdown
router.get("/status-breakdown", (req, res) => {
  res.json(campaignData.byStatus);
});

// GET /api/type-stats
router.get("/type-stats", (req, res) => {
  res.json(campaignData.typeStats);
});

// GET /api/monthly-trend
router.get("/monthly-trend", (req, res) => {
  res.json(campaignData.monthlyTrend);
});

// GET /api/top-performers
router.get("/top-performers", (req, res) => {
  res.json({ top5: campaignData.top5ROI, bottom5: campaignData.bot5ROI });
});

export default router;
