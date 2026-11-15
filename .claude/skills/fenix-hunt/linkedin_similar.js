// Run in a LinkedIn job page with javascript_tool (fenix-hunt, "Similar jobs"), BEFORE linkedin_posting.js, which replaces
// the part of the page this reads. It scrolls to the bottom so the "More jobs" block loads, then answers one line per
// similar job: "<job id> | <title> | <company> | <location> | <pay, if shown> | <age>", or "NO_SIMILAR_JOBS".
// It only scrolls and reads; nothing is clicked or written to LinkedIn.
await (async () => {
for (let i = 0; i < 8; i++) { window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 900)); }
const rows = [], seen = new Set();
for (const a of document.querySelectorAll('a[href*="JOB_DETAILS_SIMILAR_JOBS"]')) {
  let id = ''; try { id = new URL(a.href).searchParams.get('currentJobId') || ''; } catch (e) {}
  if (!/^\d+$/.test(id) || seen.has(id)) continue; seen.add(id);
  const lines = [...new Set(a.innerText.split('\n').map(s => s.trim()).filter(Boolean))]
    .filter(s => !/alumni|connection|Actively|Promoted|Viewed|Easy Apply|applicant|Be an early/i.test(s)).map(s => s.replace(/^Posted /, ''));
  if (lines.length < 2) continue;  // the "See more jobs like this" link has no card text
  rows.push(id + ' | ' + lines.slice(0, 5).map(s => s.slice(0, 60)).join(' | '));
}
return rows.length ? rows.join('\n') : 'NO_SIMILAR_JOBS';
})()
