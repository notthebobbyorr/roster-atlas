const escapeAttribute = value => String(value).replace(/[&"<>]/g, char => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[char]));

export function whipComparisonButton(entry, enabled) {
 if (!enabled || entry?.kind !== 'Pitcher' || !Number.isFinite(entry.profile?.complete_projection?.WHIP)) return '';
 return '<button class="whip-compare" type="button" data-whip-compare="' + escapeAttribute(entry.key) +
  '" aria-label="Compare WHIP for ' + escapeAttribute(entry.name) + '">Compare WHIP</button>';
}

export function mountWHIPComparison(document, getForecasts, entryForKey) {
 if (!getForecasts) return;
 let generation = 0;
 const dialog = document.createElement('dialog');
 dialog.className = 'whip-comparison';
 dialog.setAttribute('aria-labelledby', 'whip-comparison-title');
 dialog.innerHTML = '<form method="dialog"><h2 id="whip-comparison-title"></h2>' +
  '<button type="submit" autofocus>Close</button></form>' +
  '<p role="status" aria-live="polite"></p>' +
  '<div class="whip-comparison-table" hidden><table><caption>2027 WHIP and components per 100 batters faced</caption>' +
  '<thead><tr><th scope="col">Model</th><th scope="col">WHIP</th><th scope="col">Hits</th>' +
  '<th scope="col">Walks</th><th scope="col">Outs</th></tr></thead><tbody></tbody></table></div>';
 document.body.append(dialog);
 const title = dialog.querySelector('h2'), status = dialog.querySelector('[role=status]');
 const scroll = dialog.querySelector('.whip-comparison-table'), body = dialog.querySelector('tbody');
 dialog.addEventListener('close', () => { generation++; });

 document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-whip-compare]');
  if (!button) return;
  const entry = entryForKey(button.dataset.whipCompare);
  if (!entry) return;
  const request = ++generation;
  title.textContent = entry.name;
  status.textContent = 'Loading WHIP forecasts…';
  scroll.hidden = true;
  if (!dialog.open) dialog.showModal();
  try {
   const rows = await getForecasts(entry.mlbid);
   if (request !== generation || !dialog.open) return;
   body.replaceChildren();
   const format = (value, scale, decimals) => Number.isFinite(value) ? (value * scale).toFixed(decimals) : '—';
   for (const {label, whip, rates, fallback} of rows) {
    const tr = body.insertRow(), name = document.createElement('th');
    name.scope = 'row';
    name.textContent = label;
    if (fallback) {
     const note = document.createElement('small');
     note.textContent = 'Atlas fallback';
     name.append(note);
    }
    tr.append(name);
    for (const value of [format(whip, 1, 3), ...['H_PA','BB_PA','OUT_PA'].map(rate => format(rates[rate], 100, 1))]) {
     tr.insertCell().textContent = value;
    }
   }
   status.textContent = '';
   scroll.hidden = false;
  } catch (error) {
   if (request === generation && dialog.open) status.textContent = error.message;
  }
 });
}
