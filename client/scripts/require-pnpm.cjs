const execPath = process.env.npm_execpath || "";
const userAgent = process.env.npm_config_user_agent || "";

if (!execPath.includes("pnpm") && !userAgent.startsWith("pnpm/")) {
  console.error("This project uses pnpm. Run this command with pnpm, for example: pnpm start");
  process.exit(1);
}
