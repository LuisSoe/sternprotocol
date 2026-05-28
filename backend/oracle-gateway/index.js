const express = require("express");
const cors = require("cors");
const { getMockStatus } = require("./oracleService");
const {
  submitOracleVerification,
  openDispute,
  resolveDispute
} = require("./contractService");
const { config } = require("./config");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "stern-oracle-gateway",
    mockMode: true,
    timestamp: new Date().toISOString()
  });
});

app.get("/mock-status/:contractId", (req, res) => {
  const status = getMockStatus(req.params.contractId, req.query);
  res.json(status);
});

app.post("/submit-oracle/:contractId", async (req, res, next) => {
  try {
    const status = getMockStatus(req.params.contractId, req.body || {});
    const result = await submitOracleVerification(req.params.contractId, status.verification);
    res.json({ status, result });
  } catch (error) {
    next(error);
  }
});

app.post("/open-dispute/:contractId", async (req, res, next) => {
  try {
    const result = await openDispute(req.params.contractId);
    res.json({ contractId: req.params.contractId, result });
  } catch (error) {
    next(error);
  }
});

app.post("/resolve-dispute/:contractId", async (req, res, next) => {
  try {
    const result = await resolveDispute(req.params.contractId, req.body?.releaseToExporter);
    res.json({ contractId: req.params.contractId, result });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    error: error.message || "Unexpected server error"
  });
});

const server = app.listen(config.port, () => {
  console.log(`STERN oracle gateway listening on http://localhost:${config.port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${config.port} is already in use. Stop the existing backend process or set PORT to another value.`
    );
    console.error(`PowerShell: Get-NetTCPConnection -LocalPort ${config.port}`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
