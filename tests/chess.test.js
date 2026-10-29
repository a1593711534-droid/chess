import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess,DEFAULT_POSITION} from '../vendor/chess.js';
import {ChessSession} from '../src/chess/session.js';
import {ChessClock} from '../src/chess/clock.js';
import {moveToUci,pvToSan,scoreWhite} from '../src/chess/notation.js';
import {fallbackMove} from '../src/chess/fallback.js';

const settings={mode:'local',side:'w',level:'club',time:'none',sound:false};
function session(){return new ChessSession(settings);}
function sequence(s,moves){for(const move of moves){const result=s.play(move);assert.ok(result,`move ${JSON.stringify(move)} was illegal`);}return s;}

test('standard position, correct color, first legal moves',()=>{
 const s=session();assert.equal(s.game.fen(),DEFAULT_POSITION);assert.equal(s.game.turn(),'w');assert.equal(s.game.moves().length,20);
 assert.equal(s.game.get('d1').type,'q');assert.equal(s.game.get('d8').type,'q');
});
test('illegal move is rejected without changing game',()=>{
 const s=session();const original=s.game.fen();assert.equal(s.play({from:'e2',to:'e5'}),null);assert.equal(s.game.fen(),original);assert.equal(s.ply,0);
});
test('en passant is captured correctly',()=>{
 const s=sequence(session(),[{from:'e2',to:'e4'},{from:'a7',to:'a6'},{from:'e4',to:'e5'},{from:'d7',to:'d5'},{from:'e5',to:'d6'}]);
 assert.equal(s.game.get('d5'),undefined);assert.equal(s.game.get('d6').type,'p');assert.equal(s.game.get('d6').color,'w');
 assert.ok(s.moves.at(-1).flags.includes('e'));
});
test('castling and rook relocation are legal',()=>{
 const s=sequence(session(),[{from:'e2',to:'e4'},{from:'e7',to:'e5'},{from:'g1',to:'f3'},{from:'b8',to:'c6'},{from:'f1',to:'c4'},{from:'f8',to:'c5'},{from:'e1',to:'g1'}]);
 assert.equal(s.game.get('g1').type,'k');assert.equal(s.game.get('f1').type,'r');assert.equal(s.game.get('h1'),undefined);
 assert.equal(s.moves.at(-1).san,'O-O');
});
test('pawn promotion requires explicit chosen piece',()=>{
 const fen='8/P7/8/8/8/8/7p/4K2k w - - 0 1';const s=session();s.initialFen=fen;s.game=new Chess(fen);
 assert.equal(s.play({from:'a7',to:'a8'}),null);
 assert.ok(s.play({from:'a7',to:'a8',promotion:'n'}));assert.equal(s.game.get('a8').type,'n');
});
test('fool’s mate identifies checkmate winner',()=>{
 const s=sequence(session(),[{from:'f2',to:'f3'},{from:'e7',to:'e5'},{from:'g2',to:'g4'},{from:'d8',to:'h4'}]);
 assert.equal(s.game.isCheckmate(),true);assert.deepEqual(s.status(),{winner:'b',kind:'checkmate'});assert.equal(s.done,true);
});
test('insufficient material automatically adjudicates draw',()=>{
 const s=session();const fen='8/8/8/8/8/8/8/K6k w - - 0 1';s.initialFen=fen;s.game=new Chess(fen);
 assert.deepEqual(s.status(),{winner:null,kind:'insufficient'});
});
test('history review does not lose current position',()=>{
 const s=sequence(session(),['e4','e5','Nf3','Nc6']);const original=s.game.fen();
 s.goTo(2);assert.equal(s.current.history().length,2);assert.equal(s.atLatest,false);
 assert.equal(s.play('Bc4'),null);s.goTo(4);assert.equal(s.game.fen(),original);
});
test('undo restores FEN and two plies versus engine',()=>{
 const s=new ChessSession({...settings,mode:'ai',side:'w'});
 sequence(s,['e4','e5']);assert.equal(s.undo(),2);assert.equal(s.game.fen(),DEFAULT_POSITION);
});
test('PGN import/export and saved game restore preserve moves',()=>{
 const s=session();s.importPgn('[Event "Training"]\n\n1. e4 e5 2. Nf3 Nc6 *');
 assert.equal(s.ply,4);assert.ok(s.pgn().includes('1. e4 e5 2. Nf3 Nc6'));
 const another=session();another.restore(s.serialize());assert.equal(another.game.fen(),s.game.fen());assert.equal(another.ply,4);
});
test('invalid imported PGN raises an error',()=>{
 const s=session();assert.throws(()=>s.importPgn('1. e4 e5 2. Qh5 Ke9 *'));
});
test('chess clock adds increment and eventually flags the side',()=>{
 const c=new ChessClock('5+3');assert.equal(c.remaining.w,300000);
 c.afterMove('w','b');assert.equal(c.remaining.w,303000);
 c.lastTick-=303500;c.tick();assert.equal(c.timeout,'b');assert.equal(c.remaining.b,0);
});
test('UCI/SAN and score conversion are consistent with active FEN',()=>{
 const g=new Chess();const first=g.moves({verbose:true}).find(m=>m.san==='e4');
 assert.equal(moveToUci(first),'e2e4');assert.equal(pvToSan(g.fen(),['e2e4','e7e5']),'1. e4 e5');
 assert.equal(scoreWhite({cp:80,mate:null},'b').text,'−0.80');
});
test('emergency local opponent makes a legal move',()=>{
 const s=session();s.play('e4');const result=fallbackMove(s.game.fen(),'beginner');
 assert.ok(s.game.moves({verbose:true}).some(m=>moveToUci(m)===result));
});

test('PGN event metadata survives import and export',()=>{
 const s=session();s.importPgn('[Event "Weekend Match"]\n[White "Alice"]\n[Black "Bob"]\n\n1. d4 d5 *');
 const pgn=s.pgn();assert.match(pgn,/\[Event "Weekend Match"\]/);assert.match(pgn,/\[White "Alice"\]/);
});
test('undo restores incremented chess clock to its previous state',()=>{
 const s=new ChessSession({...settings,time:'5+3'});s.play('e4');
 s.clock.lastTick-=2100;
 s.play('e5');const elapsedTime=s.clockSnapshots.at(-1).remaining.b;
 assert.ok(s.clock.remaining.b>elapsedTime);
 s.undo();assert.ok(Math.abs(s.clock.remaining.b-elapsedTime)<25);
 assert.equal(s.clock.active,'b');
});
test('a restored clock accounts for elapsed offline time',()=>{
 const c=new ChessClock('5+0');
 c.restore({remaining:{w:300000,b:300000},active:'b',savedAt:Date.now()-3000},{accountElapsed:true});
 assert.ok(c.remaining.b<=297005&&c.remaining.b>=296000);assert.equal(c.active,'b');
});
