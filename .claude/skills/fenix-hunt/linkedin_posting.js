// Run in a LinkedIn job page with javascript_tool (fenix-hunt, "Per job" step 2). It replaces the page's <main> with a <pre>
// holding the top card on one line ("TOP ...") and the posting as light Markdown, so get_page_text returns just that.
// It changes only what is on screen; nothing is written to LinkedIn. Elements it relies on are in docs/learnings/linkedin.md.
let m; for (let i = 0; i < 24; i++) { m = document.querySelector('main'); if (m && m.innerText.includes('About the job')) break; await new Promise(r => setTimeout(r, 500)); }
const head = [...m.querySelectorAll('h1,h2,h3')].find(e => e.innerText.trim() === 'About the job');
let box = head.parentElement; while (box.parentElement && box.innerText.trim().length < 200) box = box.parentElement;
const out = []; let cur = '', prefix = '', bold = false, plain = false, depth = 0;
const flush = () => { const line = cur.replace(/\s+/g, ' ').trim(); cur = ''; if (!line) return; let p = prefix, l = line; const boldOnly = bold && !plain; prefix = ''; bold = plain = false;
  if (!p && boldOnly && l.length <= 80) { p = '## '; l = l.replace(/:$/, ''); }
  else if (!p) { const tb = l.match(/^[-•*]\s+(?=\S)/); if (tb) { p = '- '; l = l.slice(tb[0].length); } else l = l.replace(/^([#>])/, '\\$1'); }
  if (p.startsWith('## ') && out.length && out[out.length - 1] !== '') out.push('');
  out.push(p + l); if (!p.includes('- ')) out.push(''); };
const walk = (n, inBold) => { for (const c of n.childNodes) {
  if (c.nodeType === 3) { if (c.textContent.trim()) { if (inBold) bold = true; else plain = true; } cur += c.textContent; continue; }
  if (c.nodeType !== 1 || c === head) continue; const t = c.tagName;
  if (t === 'BUTTON' || t === 'SCRIPT' || t === 'STYLE') continue;
  if (/^H[1-6]$/.test(t)) { flush(); prefix = '## '; walk(c, inBold); flush(); prefix = ''; }
  else if (t === 'LI') { flush(); prefix = '  '.repeat(Math.max(depth - 1, 0)) + '- '; walk(c, inBold); flush(); prefix = ''; }
  else if (t === 'UL' || t === 'OL') { flush(); depth++; walk(c, inBold); flush(); depth--; if (!depth && out.length && out[out.length - 1] !== '') out.push(''); }
  else if (t === 'BR' || t === 'HR') flush();
  else if (t === 'P' || t === 'DIV') { flush(); walk(c, inBold); flush(); }
  else if (t === 'A') { const s = cur.length; walk(c, inBold); const label = cur.slice(s).replace(/\s+/g, ' ').trim(); let href = c.href || ''; try { const u = new URL(href); if (/linkedin\.com$/.test(u.hostname) && u.searchParams.get('url')) href = u.searchParams.get('url'); } catch (e) {}
    if (label && /^https?:/.test(href)) cur = cur.slice(0, s) + (label === href ? href : '[' + label + '](' + href + ')'); }
  else walk(c, inBold || t === 'STRONG' || t === 'B'); } };
walk(box, false); flush();
let jd = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
for (const end of ['Benefits found in job post', 'Set alert for similar jobs', 'See how you compare', 'Exclusive Job Seeker Insights', 'How Jobgether Works']) { const i = jd.indexOf(end); if (i > 0) jd = jd.slice(0, i).replace(/(## )?$/, '').trim(); }
const all = m.innerText; const top = all.slice(0, all.indexOf('About the job')).replace(/\s*\n\s*/g, ' | ').trim();
const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = 'TOP ' + top + '\n\n' + jd; m.replaceChildren(pre);
