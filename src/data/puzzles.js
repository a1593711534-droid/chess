import {Chess} from '../../vendor/chess.js';
const setup=sequence=>{const g=new Chess();if(sequence)for(const san of sequence.split(' '))g.move(san,{strict:true});return g.fen();};
/** Local editorial exercises. The solution is a defined training line, not a claim of forced engine-best play. */
export const PUZZLES=[
 {id:'mate01',title:'后與國王配合',category:'一手將死',rating:1,fen:'7k/5K2/6Q1/8/8/8/8/8 w - - 0 1',line:['g6h6'],goal:'白方走棋：找到一手將死。',expectMate:true},
 {id:'mate02',title:'城堡封鎖退路',category:'一手將死',rating:1,fen:'7k/5K2/8/8/8/8/8/R7 w - - 0 1',line:['a1h1'],goal:'白方走棋：使用城堡完成將死。',expectMate:true},
 {id:'mate03',title:'底線的弱點',category:'一手將死',rating:1,fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',line:['e1e8'],goal:'白方走棋：抓住底線的致命弱點。',expectMate:true},
 {id:'mate04',title:'皇后斜線轉移',category:'一手將死',rating:2,fen:'6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1',line:['f3a8'],goal:'白方走棋：沿斜線進攻底線。',expectMate:true},
 {id:'mate05',title:'遠距離城堡攻擊',category:'一手將死',rating:1,fen:'7k/6pp/8/8/8/8/6PP/5RK1 w - - 0 1',line:['f1f8'],goal:'白方走棋：尋找開放線的將死。',expectMate:true},
 {id:'mate06',title:'黑方的后殺',category:'一手將死',rating:2,fen:'8/8/8/8/8/6q1/5k2/7K b - - 0 1',line:['g3h3'],goal:'黑方走棋：封鎖白王最後的退路。',expectMate:true},
 {id:'mate07',title:'橫列奇襲',category:'一手將死',rating:2,fen:'k7/pp6/8/8/8/8/PP6/6KR w - - 0 1',line:['h1h8'],goal:'白方走棋：利用第八橫列將死。',expectMate:true},
 {id:'mate08',title:'愚人將死',category:'一手將死',rating:1,fen:setup('f3 e5 g4'),line:['d8h4'],goal:'黑方走棋：抓住 f2 與 h4 對角線。',expectMate:true},
 {id:'promo01',title:'兵的華麗升變',category:'升變',rating:1,fen:'7k/P7/8/8/8/8/8/6K1 w - - 0 1',line:['a7a8q'],goal:'白方走棋：將兵升變為皇后。'},
 {id:'promo02',title:'決定性新皇后',category:'升變',rating:2,fen:'7k/5P2/6K1/8/8/8/8/8 w - - 0 1',line:['f7f8q'],goal:'白方走棋：升變並完成攻擊。'},
 {id:'italian01',title:'義大利開局 · 佔領中心',category:'開局技巧',rating:2,fen:setup('e4 e5 Nf3 Nc6 Bc4 Bc5'),line:['c2c3','g8f6','d2d4'],goal:'依序走出 c3、等待黑方 Nf6，再打出 d4。'},
 {id:'scotch01',title:'蘇格蘭開局 · 直擊中心',category:'開局技巧',rating:2,fen:setup('e4 e5 Nf3 Nc6'),line:['d2d4','e5d4','f3d4'],goal:'用 d4 打開中心，並以騎士吃回。'},
 {id:'sicilian01',title:'西西里防禦 · 中心反擊',category:'開局技巧',rating:3,fen:setup('e4 c5 Nf3 d6'),line:['d2d4','c5d4','f3d4'],goal:'以 d4 換出開放 c 線，再用騎士收回。'},
 {id:'london01',title:'倫敦系統 · 穩定部署',category:'開局技巧',rating:1,fen:setup('d4 d5'),line:['c1f4','g8f6','e2e3'],goal:'主教先出發，然後穩健支持中心。'},
 {id:'castle01',title:'短易位 · 王的安全',category:'基本技巧',rating:1,fen:setup('e4 e5 Nf3 Nc6 Bc4 Bc5'),line:['e1g1'],goal:'白方走棋：完成王翼易位保護國王。'},
 {id:'ep01',title:'吃過路兵 · 特殊規則',category:'基本技巧',rating:2,fen:setup('e4 a6 e5 d5'),line:['e5d6'],goal:'白方走棋：利用吃過路兵捕獲 d5 兵。'},
];
export const CATEGORIES=['全部',...new Set(PUZZLES.map(p=>p.category))];
export function validatePuzzles(){for(const p of PUZZLES){const g=new Chess(p.fen);if(g.isGameOver())throw Error(`${p.id}: starts terminal`);let starter=g.turn();for(let i=0;i<p.line.length;i++){const u=p.line[i];try{g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]},{strict:true});}catch(e){throw Error(`${p.id} move ${i}: ${u} ${e.message}`);}if(i%2===0&&g.turn()===starter)throw Error(`${p.id}: wrong alternating side`);}if(p.expectMate&&!g.isCheckmate())throw Error(`${p.id}: claimed mate not reached`);}return true;}
export function readTrainingStats(){try{const saved=JSON.parse(localStorage.getItem('chess-atelier-pro-training-v1')||'{}');return saved&&typeof saved==='object'?saved:{};}catch{return {};}}
export function recordPuzzle(id,errors=0){try{const saved=readTrainingStats();const old=saved[id];saved[id]={solved:true,bestErrors:Math.min(errors,old?.bestErrors??Infinity),last:Date.now(),attempts:(old?.attempts||0)+1};localStorage.setItem('chess-atelier-pro-training-v1',JSON.stringify(saved));}catch{/* storage disabled */}}
