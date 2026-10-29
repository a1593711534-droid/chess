import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../vendor/chess.js';
import {ChessSession} from '../src/chess/session.js';
import {GameHistoryIndex} from '../src/chess/history-index.js';

const prefs={mode:'local',side:'w',level:'skill-10',time:'none'};
test('history and historical board views are cached per revision, not rebuilt per read',()=>{
  const session=new ChessSession(prefs),board=session.game;
  let replays=0;const original=board.history.bind(board);
  board.history=(...args)=>{replays++;return original(...args);};
  assert.equal(session.moves.length,0);
  assert.equal(session.ply,0);
  for(let i=0;i<500;i++){assert.equal(session.moves.length,0);assert.equal(session.ply,0);}
  assert.equal(replays,0,'index is initially populated with the blank game');
  assert.ok(session.play('e4'));assert.ok(session.play('e5'));
  const once=replays;
  for(let i=0;i<300;i++){assert.equal(session.ply,2);assert.equal(session.moves[0].san,'e4');}
  assert.equal(replays,once,'position unchanged: no chess.js undo/replay history call');
  session.goTo(1);
  const view=session.current;
  for(let i=0;i<200;i++)assert.equal(session.current,view);
  session.undo();
  assert.notEqual(session.current,view,'undo invalidates the historical view');
});
test('repetition index updates after moves, undo and direct Chess modifications',()=>{
  const s=new ChessSession(prefs);
  for(let i=0;i<2;i++)for(const san of ['Nf3','Nf6','Ng1','Ng8'])assert.ok(s.play(san));
  assert.equal(s.historyIndex.repetitions(),3);assert.equal(s.canClaimDraw(),true);
  s.undo();assert.equal(s.historyIndex.repetitions(),2);
  assert.ok(s.play('Ng8'));assert.equal(s.historyIndex.repetitions(),3);
  s.game.move('e4'); // external use must still trigger a rebuild on the next read
  assert.equal(s.ply,9);assert.equal(s.historyIndex.repetitions(),1);
});
test('long imported histories need only one replay to populate the index',()=>{
  const game=new Chess();
  for(let i=0;i<250;i++)for(const san of ['Nf3','Nf6','Ng1','Ng8'])game.move(san);
  let calls=0;const original=game.history.bind(game);
  game.history=(...args)=>{calls++;return original(...args);};
  const session=new ChessSession(prefs);session.game=game;
  assert.equal(session.ply,1000);
  const afterBuild=calls;assert.equal(afterBuild,1);
  for(let i=0;i<100;i++){assert.equal(session.moves.length,1000);assert.equal(session.ply,1000);}
  assert.equal(calls,afterBuild,'render-time accesses must not reconstruct 1,000 plies');
  session.goTo(500);
  const historical=session.current;assert.equal(historical.history().length,500);
  assert.equal(session.current,historical);
  assert.equal(session.isFivefoldRepetition(),true);
});
test('position-count helpers preserve FIDE repetition identity',()=>{
  assert.equal(GameHistoryIndex.key('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    GameHistoryIndex.key('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 50 26'));
});
