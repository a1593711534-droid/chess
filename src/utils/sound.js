let context=null;
let soundUnlocked=false;
function unlockSound(event){
  if(!event.isTrusted)return;
  soundUnlocked=true;
  for(const name of ['pointerdown','keydown','touchstart'])document.removeEventListener(name,unlockSound,true);
}
if(typeof document!=='undefined'){
  for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,unlockSound,{capture:true,passive:true});
}
export function playSound(type='move',enabled=true){
  // No AudioContext is created before a trusted user gesture. Browsers forbid autoplay.
  if(!enabled||!soundUnlocked)return;
  try{
    if(!context){
      const AudioAPI=window.AudioContext||window.webkitAudioContext;
      if(!AudioAPI)return;
      context=new AudioAPI();
    }
    if(context.state==='closed')return;
    if(context.state==='suspended'){
      // Handle rejection without an unhandled promise warning.
      const pending=context.resume();
      pending?.catch?.(()=>{});
    }
    const now=context.currentTime;
    const notes=type==='capture'?[220,164]:type==='check'?[440,330]:type==='end'?[350,525,700]:[280,350];
    notes.forEach((pitch,i)=>{
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.type='sine';oscillator.frequency.setValueAtTime(pitch,now+i*.064);
      gain.gain.setValueAtTime(.001,now+i*.064);
      gain.gain.exponentialRampToValueAtTime(.075,now+i*.064+.008);
      gain.gain.exponentialRampToValueAtTime(.001,now+i*.064+.095);
      oscillator.connect(gain);gain.connect(context.destination);
      oscillator.start(now+i*.064);oscillator.stop(now+i*.064+.10);
    });
  }catch{/* Sound is optional and must never interrupt a game. */}
}
