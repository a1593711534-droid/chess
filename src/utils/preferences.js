const PREF_KEY='chess-atelier-preferences-v1';
const GAME_KEY='chess-atelier-game-v1';
export const DEFAULT_PREFS={mode:'ai',side:'w',level:'club',time:'10+5',sound:true};
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* private browsing */}}
export function loadPrefs(){const saved=read(PREF_KEY);return {...DEFAULT_PREFS,...(saved&&typeof saved==='object'?saved:{})};}
export function savePrefs(value){write(PREF_KEY,value);}
export function loadSavedGame(){return read(GAME_KEY);}
export function saveGame(value){write(GAME_KEY,value);}
