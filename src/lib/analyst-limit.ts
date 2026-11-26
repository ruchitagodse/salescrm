export function createAnalystLimiter(cooldownMs=30000,maxUsers=1000){
  const slots=new Map<string,{at:number;active:boolean}>();
  return (userId:string,now:number)=>{
    for(const [id,slot] of slots)if(!slot.active&&now-slot.at>=cooldownMs)slots.delete(id);
    if(slots.has(userId)||slots.size>=maxUsers)throw new Error('Please wait before requesting another report.');
    const slot={at:now,active:true};slots.set(userId,slot);
    return ()=>{slot.active=false;};
  };
}
