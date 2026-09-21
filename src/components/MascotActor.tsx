import type {CSSProperties} from 'react';
export function MascotActor({mood='welcome',className=''}:{mood?:'welcome'|'point'|'celebrate'|'idle';className?:string}){
 const index={idle:0,welcome:1,point:2,celebrate:3}[mood];
 return <div className={`mascot-actor mood-${mood} ${className}`} style={{'--pose':index} as CSSProperties} role="img" aria-label={`Mascota oficial ${mood==='celebrate'?'celebrant':mood==='point'?'anunciant les parelles':'donant la benvinguda'}`}><div className="mascot-aura"/><div className="mascot-shadow"/><div className="mascot-pose"/><i className="mascot-spark s1"/><i className="mascot-spark s2"/><i className="mascot-spark s3"/></div>;
}
