import "dotenv/config";
import { runSync } from "../src/lib/github";

// Run from cron: `pnpm sync`
runSync()
  .then((r) => {
    console.log(r.message);
    process.exit(r.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
