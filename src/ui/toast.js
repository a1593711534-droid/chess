/** Short-lived notifications: one instance per message, at most three visible. */
export function toast(message,type='success'){
  const root=document.getElementById('toast-stack');
  if(!root||!message)return;
  // If a future caller repeats an event, never let notification stacks cover the board.
  if([...root.children].some(item=>item.textContent===String(message)&&item.dataset.type===type))return;
  while(root.childElementCount>=3)root.firstElementChild.remove();
  const item=document.createElement('div');
  item.className=`toast ${type}`;item.dataset.type=type;
  item.setAttribute('role','status');item.textContent=String(message);
  root.appendChild(item);
  setTimeout(()=>item.remove(),3400);
}
