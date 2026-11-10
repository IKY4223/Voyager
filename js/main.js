'use strict';

// Boot: drop the loading screen, leave the console note, then play the story from start to end.
// Loaded last; uses everything else.

// The inline script in index.html animates "Loading N%" while the files arrive.
clearInterval(window.loadingTimer);
(() => {
  const loader = $('#loader');
  if (!loader) return;
  // on a fast connection it never became visible: just remove it
  if (getComputedStyle(loader).visibility !== 'visible') return loader.remove();
  $('#loading-percent').textContent = '100';
  setTimeout(() => loader.remove(), 300);
})();

let logRunning = true;

// Developer helper, not advertised on the page: skip() in the browser console jumps the log to the prompt.
function skip() {
  if (!logRunning) return 'already awake.';
  skipping = true;
  return 'ok. skipping the boring part.';
}

console.log('%c' + consoleNote(), 'color:#ff4fa3;font-family:monospace;line-height:1.6');

document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? '…still counting' : 'φ';
});

(async () => {
  await sleep(600);
  await runLog(buildLog());
  logRunning = false;
  skipping = false;
  await askToRender(startMusic);
  await reveal();
})();
