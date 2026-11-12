// Validates every file under data/ against its schema and every link between files. Exit 1 lists each problem.
// Unbacked numbers in sent or baselined CVs and the live LinkedIn profile are warnings: counted here, listed by `pnpm check:claims`.
import { validateAll } from "../lib/store/validate";

const { issues, files, profiles } = await validateAll();
const errors = issues.filter((i) => !i.warning);
const warnings = issues.length - errors.length;
for (const i of errors) console.log(`${i.file}: ${i.problem}`);
if (warnings) console.log(`${warnings} unbacked number(s) in sent or baselined CVs or the live LinkedIn profile (pnpm check:claims lists them)`);
if (errors.length === 0) {
  console.log(`data ok: ${profiles.length} profile(s), ${files} files checked`);
} else {
  console.log(`${errors.length} problem(s) in ${files} files`);
  process.exit(1);
}
