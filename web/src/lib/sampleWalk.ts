import type { Project } from './types'
import type { ProjectStore } from './store'
import { todayIso, uid } from './util'

// Deliberately fictional: no real site plans or customer photography in the lab.
export async function sampleWalk(store: ProjectStore): Promise<string> {
  const id = uid('sample'), now = new Date().toISOString()
  const canvas = document.createElement('canvas')
  canvas.width = 1200; canvas.height = 840
  const x = canvas.getContext('2d')!
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 840)
  x.strokeStyle = '#e9eef0'; x.lineWidth = 1
  for (let n = 60; n < 1150; n += 30) { x.beginPath(); x.moveTo(n, 60); x.lineTo(n, 760); x.stroke() }
  for (let n = 60; n < 770; n += 30) { x.beginPath(); x.moveTo(60, n); x.lineTo(1140, n); x.stroke() }
  const rooms: [number, number, number, number, string][] = [
    [60,60,270,220,'Walk-in cooler'],[330,60,460,220,'Prep kitchen'],[790,60,350,220,'Dish room'],
    [60,280,270,270,'Dry storage'],[330,280,460,270,'Cook line'],[790,280,350,270,'Service / expo'],
    [60,550,460,210,'Dining room'],[520,550,330,210,'Bar'],[850,550,290,210,'Entry / host'],
  ]
  for (const [rx, ry, w, h, label] of rooms) {
    x.strokeStyle = '#395566'; x.lineWidth = 5; x.strokeRect(rx, ry, w, h)
    x.fillStyle = '#fff'; x.fillRect(rx+16, ry+12, x.measureText(label).width+20, 35)
    x.font = '500 19px Segoe UI'; x.fillStyle = '#3d5665'; x.fillText(label, rx+20, ry+38)
  }
  x.fillStyle = '#dce7e9'; x.strokeStyle = '#8da5ae'; x.lineWidth = 2
  for (const [rx,ry,w,h] of [[390,135,320,55],[390,370,330,70],[860,165,210,50],[870,395,190,65],[565,640,220,48]]) { x.fillRect(rx,ry,w,h); x.strokeRect(rx,ry,w,h) }
  x.font = '16px Segoe UI'; x.fillStyle = '#687c87'; x.fillText('Fictional restaurant · Sample floor plan · Not to scale',60,810)
  const png = (c: HTMLCanvasElement) => new Promise<Blob>((resolve,reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('Could not create sample')), 'image/png'))
  const planId = uid('plan'); await store.putBlob(planId, await png(canvas))
  const p: Project = { id, name: 'Northside kitchen walk', subject: 'restaurant', template: 'scope-bid', issueSet: ['floors','equipment'],
    plan: { blobId: planId, w:1200,h:840,source:'image',name:'Northside · sample floor plan' }, pins:[],photos:[],order:[],nextNo:9,
    report:{site:'Northside restaurant — fictional sample',preparedBy:'Demo operator',date:todayIso(),logoBlobId:null,accent:'#22235B',surface:'Kitchen and service areas',findings:'Design demonstration only. All photos are illustrations, not evidence of site conditions.',link:''},
    onboarded:true, keepGps:false,createdAt:now,updatedAt:now,schemaVersion:1 }
  const spots: [string,number,number,string,string][] = [
    ['Walk-in threshold',.19,.23,'grout','open'],['Prep sink',.51,.27,'grout','sched'],['Dish room drain',.82,.23,'cracked','open'],
    ['Cook line',.49,.54,'chipped','open'],['Expo counter',.82,.58,'service','sched'],['Dry storage',.18,.52,'loose','done'],
    ['Bar station',.58,.83,'grout','done'],['Host stand',.83,.83,'other','open']]
  for (const [i,[area,px,py,issue,status]] of spots.entries()) {
    const pin = {id:uid('pin'),no:i+1,x:px,y:py,area,issue,status,note:i===2?'Water collects around the drain after close. Check the surrounding grout.':'',photoIds:[] as string[],createdAt:now,updatedAt:now}
    if (i!==4 && i!==7) {
      const c=document.createElement('canvas');c.width=640;c.height=480
      const t=c.getContext('2d')!;t.fillStyle=['#958577','#859396','#b08b70'][i%3];t.fillRect(0,0,640,480)
      t.strokeStyle='#d8d0c7';t.lineWidth=7
      for(let n=-300;n<800;n+=105){t.beginPath();t.moveTo(n,0);t.lineTo(n+100,480);t.stroke()}
      for(let n=70;n<480;n+=110){t.beginPath();t.moveTo(0,n);t.lineTo(640,n);t.stroke()}
      t.strokeStyle='#3d3a34';t.lineWidth=4;t.beginPath();t.moveTo(250,125);t.lineTo(283,202);t.lineTo(265,225);t.lineTo(340,345);t.stroke()
      t.fillStyle='#183849';t.fillRect(0,392,640,88);t.fillStyle='#fff';t.font='24px Segoe UI';t.fillText(area,24,427);t.font='16px Segoe UI';t.fillText('Sample illustration — not a site photograph',24,458)
      const blob=await png(c), blobId=uid('photo'),thumbId=uid('thumb'),photoId=uid('p')
      await store.putBlob(blobId,blob);await store.putBlob(thumbId,blob)
      p.photos.push({id:photoId,blobId,thumbId,name:`Sample ${area}`,takenAt:null,gps:null,w:640,h:480,bytes:blob.size});p.order.push(photoId);pin.photoIds.push(photoId)
    }
    p.pins.push(pin)
  }
  await store.put(p)
  return id
}
