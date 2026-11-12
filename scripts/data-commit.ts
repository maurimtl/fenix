// pnpm data:commit <person> "<what changed>" — for skills that write data files directly instead of through the app.
import { commitProfile } from "../lib/store/history";
import { withProfileLock } from "../lib/store/lock";

const [person, ...words] = process.argv.slice(2);
const message = words.join(" ").trim();
if (!person || !message) {
  console.error('usage: pnpm data:commit <person> "<what changed>"');
  process.exit(2);
}
const made = await withProfileLock(person, () => commitProfile(person, message, "all"));
console.log(made ? `committed: ${person}: ${message}` : "nothing to commit");
