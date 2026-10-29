export class ChessClock {
  constructor(control='none'){this.configure(control);}
  configure(control){
    const match=/^(\d+)\+(\d+)$/.exec(control||'');
    this.enabled=!!match;this.increment=match?Number(match[2])*1000:0;
    const initial=match?Number(match[1])*60*1000:0;
    this.remaining={w:initial,b:initial};this.active=null;this.lastTick=0;this.timeout=null;
  }
  pause(){this.tick();this.active=null;this.lastTick=0;}
  /** Return the flagging side only on the transition to timeout (once). */
  tick(now=performance.now()){
    if(!this.enabled||this.timeout||!this.active)return null;
    const elapsed=Math.max(0,now-this.lastTick);
    this.remaining[this.active]=Math.max(0,this.remaining[this.active]-elapsed);
    this.lastTick=now;
    if(this.remaining[this.active]===0){
      this.timeout=this.active;
      this.active=null;
      this.lastTick=0;
      return this.timeout;
    }
    return null;
  }
  afterMove(mover,next){
    if(!this.enabled||this.timeout)return;
    this.tick();if(this.timeout)return;
    this.remaining[mover]+=this.increment;
    this.active=next;this.lastTick=performance.now();
  }
  restore(value,{resume=false,accountElapsed=false}={}){
    if(!value)return;
    for(const s of ['w','b'])if(Number.isFinite(value.remaining?.[s]))this.remaining[s]=Math.max(0,value.remaining[s]);
    this.timeout=null;this.active=null;this.lastTick=0;
    if(!this.enabled)return;
    // Preserve the result through reloads, including saves after the clock stopped.
    if(['w','b'].includes(value.timeout))this.timeout=value.timeout;
    // Older saves did not include timeout. A zeroed side is already flagged.
    if(!this.timeout){
      for(const side of ['w','b'])if(this.remaining[side]===0){this.timeout=side;break;}
    }
    if(!this.timeout&&['w','b'].includes(value.active)){
      if(accountElapsed&&Number.isFinite(value.savedAt)){
        const elapsed=Math.max(0,Date.now()-value.savedAt);
        this.remaining[value.active]=Math.max(0,this.remaining[value.active]-elapsed);
      }
      if(this.remaining[value.active]===0)this.timeout=value.active;
      else if(resume||accountElapsed){this.active=value.active;this.lastTick=performance.now();}
    }
  }
  snapshot(){this.tick();return {remaining:{...this.remaining},active:this.active,timeout:this.timeout,savedAt:Date.now()};}
  format(side){if(!this.enabled)return '∞';const n=Math.ceil(this.remaining[side]/1000);return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;}
}
