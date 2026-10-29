const PREF_KEY='chess-atelier-preferences-v1';
const GAME_KEY='chess-atelier-game-v1';
const MANUAL_KEY='chess-atelier-manual-save-v1';
export const DEFAULT_PREFS={mode:'ai',side:'w',level:'skill-10',time:'10+5',aiThink:'2000',aiTimeMode:'adaptive',sound:true};
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* private browsing */}}
export function loadPrefs(){const saved=read(PREF_KEY);return {...DEFAULT_PREFS,...(saved&&typeof saved==='object'?saved:{}),...(saved&&typeof saved==='object'&&!('aiTimeMode' in saved)?{aiTimeMode:'fixed'}:{})};}
export function savePrefs(value){write(PREF_KEY,value);}
export function loadSavedGame(){return read(GAME_KEY);}
export function saveGame(value){write(GAME_KEY,value);}
export function loadManualGame(){return read(MANUAL_KEY);}
export function saveManualGame(value){
  const body={version:1,date:new Date().toISOString(),game:value};
  try{localStorage.setItem(MANUAL_KEY,JSON.stringify(body));return true;}catch{return false;}
}
