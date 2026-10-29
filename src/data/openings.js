import {Chess} from '../../vendor/chess.js';
/** Hand-curated illustrative opening lines; not an online master-game database. */
const rows=[
 ['C50','義大利開局 · Italian Game','e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6'],
 ['C60','西班牙開局 · Ruy Lopez','e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O'],
 ['C45','蘇格蘭開局 · Scotch Game','e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
 ['C47','四騎士開局 · Four Knights','e4 e5 Nf3 Nc6 Nc3 Nf6'],
 ['C42','俄羅斯防禦 · Petrov','e4 e5 Nf3 Nf6 Nxe5 d6 Nf3'],
 ['C25','維也納開局 · Vienna','e4 e5 Nc3 Nf6 f4'],
 ['C33','王翼棄兵 · King’s Gambit','e4 e5 f4 exf4 Nf3'],
 ['B90','西西里 · 納傑道夫','e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
 ['B70','西西里 · 龍式變例','e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'],
 ['B22','西西里 · 阿拉賓','e4 c5 c3 Nf6 e5 Nd5'],
 ['C02','法國防禦 · 推進變例','e4 e6 d4 d5 e5 c5'],
 ['C01','法國防禦 · 交換變例','e4 e6 d4 d5 exd5 exd5'],
 ['B12','卡羅康 · 推進變例','e4 c6 d4 d5 e5 Bf5'],
 ['B18','卡羅康 · 古典變例','e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'],
 ['B01','斯堪地那維亞防禦','e4 d5 exd5 Qxd5 Nc3 Qa5'],
 ['B07','皮爾茲防禦 · Pirc','e4 d6 d4 Nf6 Nc3 g6'],
 ['B02','阿廖欣防禦 · Alekhine','e4 Nf6 e5 Nd5 d4 d6'],
 ['D30','后翼棄兵 · 拒吃','d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7'],
 ['D20','后翼棄兵 · 接受','d4 d5 c4 dxc4 Nf3 Nf6 e3 e6'],
 ['D10','斯拉夫防禦 · Slav','d4 d5 c4 c6 Nf3 Nf6'],
 ['D00','倫敦系統 · London','d4 d5 Bf4 Nf6 e3 e6 Nf3 c5'],
 ['E70','王印度防禦 · King’s Indian','d4 Nf6 c4 g6 Nc3 Bg7 e4 d6'],
 ['D85','格林菲爾德防禦 · Grünfeld','d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5'],
 ['E20','尼姆佐印度防禦','d4 Nf6 c4 e6 Nc3 Bb4'],
 ['E12','后印度防禦 · Queen’s Indian','d4 Nf6 c4 e6 Nf3 b6'],
 ['E01','加泰隆尼亞開局 · Catalan','d4 Nf6 c4 e6 g3 d5 Bg2 Be7'],
 ['A25','英格蘭開局 · English','c4 e5 Nc3 Nf6 g3 d5'],
 ['A09','列提開局 · Réti','Nf3 d5 c4 e6 g3 Nf6'],
 ['A02','伯德開局 · Bird','f4 d5 Nf3 Nf6 g3 g6'],
 ['A65','現代別諾尼防禦','d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6'],
 ['A57','班科棄兵 · Benko','d4 Nf6 c4 c5 d5 b5'],
 ['A80','荷蘭防禦 · Dutch','d4 f5 g3 Nf6 Bg2 e6'],
 ['A00','波蘭開局 · Polish','b4 e5 Bb2 f6 e3 d5'],
];
export const OPENINGS=rows.map(([eco,name,line])=>({eco,name,moves:line.split(' ')}));
export function validateOpenings(){for(const row of OPENINGS){const g=new Chess();for(const san of row.moves){try{g.move(san,{strict:true});}catch(e){throw Error(`${row.eco} ${row.name}: ${san}: ${e.message}`);}}}return true;}
export function openingFor(history){const h=history.map(x=>typeof x==='string'?x:x.san);const matched=OPENINGS.filter(r=>r.moves.slice(0,Math.min(h.length,r.moves.length)).every((m,i)=>h[i]===m));if(!h.length)return null;return matched.sort((a,b)=>Math.min(b.moves.length,h.length)-Math.min(a.moves.length,h.length))[0]||null;}
export function continuations(history){const h=history.map(x=>typeof x==='string'?x:x.san);const choices=new Map();for(const o of OPENINGS){if(o.moves.length<=h.length||!h.every((m,i)=>o.moves[i]===m))continue;const next=o.moves[h.length];if(!choices.has(next))choices.set(next,{san:next,lines:[]});choices.get(next).lines.push(o);}return [...choices.values()].sort((a,b)=>b.lines.length-a.lines.length||a.san.localeCompare(b.san));}
export function openingGame(row){if(!OPENINGS.includes(row))throw Error('Unknown opening');const g=new Chess();for(const san of row.moves)g.move(san);return g;}
