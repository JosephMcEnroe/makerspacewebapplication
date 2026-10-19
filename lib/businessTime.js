// Reservation timestamps represent the business's Eastern wall-clock time.
export const BUSINESS_TIME_ZONE = "America/New_York";
const formatter = new Intl.DateTimeFormat("en-CA", {
 timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
 hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
export function businessDateTime(value = new Date()) {
 const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map(({type,value}) => [type,value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second;
}
// Repeated autumn hours use the first occurrence; nonexistent spring hours are invalid.
export function businessTime(value) {
 if(value instanceof Date) return value.getTime();
 if(typeof value !== 'string') return NaN;
 if(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) return Date.parse(value);
 let local=value.replace(' ','T').slice(0,19);
 if(local.length===10) local+='T00:00:00';
 const target=Date.parse(local+'Z');
 if(!Number.isFinite(target)) return NaN;
 let candidate=target;
 for(let i=0;i<4;i++) {
  const delta=target-Date.parse(businessDateTime(candidate)+'Z');
  if(delta===0) return candidate;
  candidate+=delta;
 }
 return NaN;
}
// Calendar-only Date whose fields hold Eastern time, regardless of browser timezone.
export function businessCalendarDate(value = new Date()) {
 const text=typeof value==='string' && !(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) ? value.replace(' ','T') : businessDateTime(value);
 const [y,m,d,h=0,min=0,s=0]=text.split(/[-T:]/).map(Number);
 return new Date(y,m-1,d,h,min,s);
}
