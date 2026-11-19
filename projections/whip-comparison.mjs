const escapeAttribute = value => String(value).replace(/[&"<>]/g, char => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[char]));

export function whipComparisonButton(entry, enabled, hitters=false) {
 const line = entry?.profile?.complete_projection;
 const ready = entry?.kind === 'Hitter' ? hitters && Number.isFinite(line?.OPS) :
  entry?.kind === 'Pitcher' && enabled && Number.isFinite(line?.WHIP);
 if (!ready) return '';
 return '<button class="whip-compare" type="button" data-whip-compare="' + escapeAttribute(entry.key) +
  '" aria-label="Compare Models for ' + escapeAttribute(entry.name) + '">Compare Models</button>';
}

const hitterColumns = ['Model','AVG','OBP','SLG','OPS','BABIP','K%','BB%','HR/600 PA'];
const pitcherColumns = ['Model','ERA','WHIP','K/100','H/100','BB/100','Out/100'];

export function mountWHIPComparison(document, getForecasts, entryForKey, teams=null, getHitters=null) {
 if (!getForecasts && !getHitters) return;
 let generation = 0;
 const dialog = document.createElement('dialog');
 dialog.className = 'whip-comparison';
 dialog.setAttribute('aria-labelledby', 'whip-comparison-title');
 dialog.innerHTML = '<form method="dialog"><h2 id="whip-comparison-title"></h2>' +
  '<button type="submit" autofocus>Close</button></form>' +
  (teams ? '<section class="pitcher-team-controls" hidden><label>Team / park <select></select></label>' +
   '<button type="button" data-apply-team disabled>Apply to tables</button>' +
   '<p>Previews use the 2027 schedule and keep the projected workload and saves role. Atlas and sStats use estimated schedule adjustments.</p></section>' : '') +
  '<p role="status" aria-live="polite"></p>' +
  '<div class="whip-comparison-table" tabindex="0" role="region" aria-label="2027 model forecasts" hidden><table>' +
  '<caption>2027 projections · component rates per 100 batters faced</caption>' +
  '<thead><tr><th scope="col">Model</th><th scope="col">ERA</th><th scope="col">WHIP</th>' +
  '<th scope="col">K/100</th><th scope="col">H/100</th><th scope="col">BB/100</th><th scope="col">Out/100</th></tr></thead><tbody></tbody></table></div>';
 document.body.append(dialog);
 const title = dialog.querySelector('h2'), status = dialog.querySelector('[role=status]');
 const scroll = dialog.querySelector('.whip-comparison-table'), body = dialog.querySelector('tbody');
 const controls = teams && dialog.querySelector('.pitcher-team-controls');
 const select = controls && controls.querySelector('select'), apply = controls && controls.querySelector('button');
 let activeEntry, currentSelection = '';
 dialog.addEventListener('close', () => { generation++; });

 async function draw(entry, team) {
  const request = ++generation;
  const hitter = entry.kind === 'Hitter';
  if (apply) apply.disabled = true;
  status.textContent = team ? 'Updating team context…' : 'Loading model forecasts…';
  scroll.hidden = true;
  try {
   const rows = await (hitter ? getHitters(entry.mlbid) : getForecasts(entry.mlbid, team));
   if (request !== generation || !dialog.open) return;
   if (getHitters) {
    dialog.querySelector('caption').textContent = hitter ? '2027 hitter projections' : '2027 projections · component rates per 100 batters faced';
    dialog.querySelector('thead tr').replaceChildren(...(hitter ? hitterColumns : pitcherColumns).map(label => {
     const th = document.createElement('th');
     th.scope = 'col';
     th.textContent = label;
     return th;
    }));
   }
   body.replaceChildren();
   const format = (value, scale, decimals) => Number.isFinite(value) ? (value * scale).toFixed(decimals) : '—';
   for (const {label, era, whip, avg, obp, slg, ops, babip, rates, fallback} of rows) {
    const tr = body.insertRow(), name = document.createElement('th');
    name.scope = 'row';
    name.textContent = label;
    if (fallback) {
     const note = document.createElement('small');
     note.textContent = 'Atlas fallback';
     name.append(note);
    }
    tr.append(name);
    const values = hitter ? [...[avg,obp,slg,ops,babip].map(rate=>format(rate,1,3)),
      format(rates.K_PA,100,1),format(rates.BB_PA,100,1),format(rates.HR_PA,600,1)] :
      [format(era, 1, 2),format(whip, 1, 3),...['K_PA','H_PA','BB_PA','OUT_PA'].map(rate=>format(rates[rate],100,1))];
    for (const value of values) {
     tr.insertCell().textContent = value;
    }
   }
   status.textContent = '';
   scroll.hidden = false;
   if (apply && !hitter) apply.disabled = team === teams.get(entry.mlbid);
  } catch (error) {
   if (request === generation && dialog.open) status.textContent = error.message;
  }
 }

 if (controls) {
  select.addEventListener('change', () => {
   currentSelection = select.value;
   void draw(activeEntry, currentSelection);
  });
  apply.addEventListener('click', () => {
   if (!activeEntry || apply.disabled) return;
   try {
    teams.apply(activeEntry.mlbid, currentSelection);
    apply.disabled = true;
    status.textContent = 'Applied to Rankings and Roster Builder.';
   } catch (error) { status.textContent = error.message; }
  });
 }

 document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-whip-compare]');
  if (!button) return;
  activeEntry = entryForKey(button.dataset.whipCompare);
  if (!activeEntry) return;
  const entry = activeEntry;
  title.textContent = entry.name;
  if (controls) controls.hidden = true;
  if (!dialog.open) dialog.showModal();
  currentSelection = entry.kind === 'Hitter' ? '' : teams?.get(entry.mlbid) ?? '';
  const drawing = draw(entry, currentSelection);
  const request = generation;
  if (controls && entry.kind !== 'Hitter') {
   try {
    const context = await teams.load();
    if (generation !== request || !dialog.open) return;
    const options = [{id:'',name:'As projected'}, ...context.teams].map(({id, name}) => {
     const option = document.createElement('option');
     option.value = id;
     option.textContent = name;
     return option;
    });
    select.replaceChildren(...options);
    select.value = currentSelection;
    controls.hidden = false;
   } catch (error) {
    await drawing;
    if (generation === request && dialog.open) status.textContent = 'Team previews are unavailable. ' + error.message;
   }
  }
  await drawing;
 });
}
