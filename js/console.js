'use strict';

// Words a visitor can type into the browser console (F12). Nothing on the page names them; the note
// left in the console (consoleNote in story.js) only looks like a terminal waiting for input.
//
// Each command is a getter on `window`, so the bare word works: typing `help` runs it. The console then
// prints `undefined` on its own line; a page cannot hide that. Only these words answer; anything else
// gets the browser's own ReferenceError. Uses story.js (CONSOLE_COMMANDS).

const CONSOLE_STYLE = 'color:#ff4fa3;font-family:monospace;line-height:1.6';

for (const [name, answer] of CONSOLE_COMMANDS) {
  Object.defineProperty(window, name, {
    configurable: true,
    get() {
      console.log('%c' + answer(), CONSOLE_STYLE);
    },
  });
}
