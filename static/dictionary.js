/* Offline glossary. Render all entry text as text, never as HTML. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const dialog = byId('dictionaryDialog');
  const search = byId('dictionarySearch');
  const results = byId('dictionaryResults');
  const letters = byId('dictionaryLetters');
  const count = byId('dictionaryCount');
  let entries = null;
  let loading = null;
  const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function render() {
    if (!entries) return;
    const words = normalize(search.value).split(' ').filter(Boolean);
    const matches = entries.filter(entry => words.every(word => entry.search.includes(word)));
    count.textContent = `${matches.length} of ${entries.length} words · A–Z`;
    results.replaceChildren();
    letters.replaceChildren();
    const headings = new Map();
    for (const entry of matches) {
      const letter = entry.term[0].toUpperCase();
      if (!headings.has(letter)) {
        const heading = element('h3', letter, 'dictionary-letter-heading');
        heading.id = `dictionary-letter-${letter}`;
        results.append(heading);
        headings.set(letter, heading);
      }
      const article = element('article', undefined, 'dictionary-entry');
      article.append(element('h4', entry.term), element('p', entry.meaning));
      const comparison = element('p', undefined, 'dictionary-comparison');
      comparison.append(element('span', 'Think of it this way: '), document.createTextNode(entry.comparison));
      article.append(comparison);
      results.append(article);
    }
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const button = element('button', letter);
      button.type = 'button';
      button.disabled = !headings.has(letter);
      button.setAttribute('aria-label', `Jump to ${letter}`);
      button.onclick = () => {
        const heading = headings.get(letter);
        if (heading) {
          results.scrollTop += heading.getBoundingClientRect().top - results.getBoundingClientRect().top;
          results.focus({preventScroll:true});
        }
      };
      letters.append(button);
    }
    if (!matches.length) {
      results.append(element('p', 'No matching word yet. Try a shorter word, a related word, or clear the search.', 'dictionary-empty'));
    }
    results.scrollTop = 0;
  }
  async function load() {
    if (entries) { render(); return; }
    if (loading) return loading;
    count.textContent = 'Opening your dictionary…';
    loading = (async () => {
      try {
        const response = await fetch('/dictionary.json');
        if (!response.ok) throw Error('Dictionary unavailable');
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.some(row => ['term','aliases','meaning','comparison'].some(key => typeof row[key] !== 'string'))) throw Error('Invalid dictionary');
        entries = rows.sort((a,b) => a.term.localeCompare(b.term, 'en', {sensitivity:'base'})).map(entry => ({...entry, search:normalize(`${entry.term} ${entry.aliases} ${entry.meaning} ${entry.comparison}`)}));
        render();
      } catch {
        count.textContent = 'Could not open the dictionary. Close and reopen it to retry. Check that YARN’s command window is still running.';
      } finally { loading = null; }
    })();
    return loading;
  }
  byId('dictionaryTab').onclick = () => {
    dialog.showModal();
    search.focus();
    load();
  };
  byId('dictionaryClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => byId('dictionaryTab').focus());
  search.addEventListener('input', render);
  byId('dictionaryClear').onclick = () => { search.value = ''; render(); search.focus(); };
  for (const button of document.querySelectorAll('[data-dictionary-query]')) {
    button.onclick = () => { search.value = button.dataset.dictionaryQuery; render(); search.focus(); };
  }
})();
