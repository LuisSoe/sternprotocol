const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  port: Number(process.env.PORT || 4000),
  rpcUrl: process.env.RPC_URL,
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY,
  contractAddress: process.env.CONTRACT_ADDRESS
};

function requireConfig(keys) {
  const missing = keys.filter((key) => !config[key]);

  if (missing.length > 0) {
    const readable = missing
      .map((key) => {
        if (key === "rpcUrl") return "RPC_URL";
        if (key === "oraclePrivateKey") return "ORACLE_PRIVATE_KEY";
        if (key === "contractAddress") return "CONTRACT_ADDRESS";
        return key;
      })
      .join(", ");

    const error = new Error(`Missing required environment variable(s): ${readable}`);
    error.statusCode = 400;
    throw error;
  }
}

module.exports = { config, requireConfig };
