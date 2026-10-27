"""Generate clearly synthetic, synchronized camera assets; requires Pillow, numpy, ffmpeg."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, math, subprocess, os
W,H=960,540
OUT='public/demo';os.makedirs(OUT,exist_ok=True)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(fontpath,12)
class Scene:
 def __init__(self,eye):
  self.eye=np.array(eye,float);target=np.array([0,0,1.1]);self.f=(target-self.eye);self.f/=np.linalg.norm(self.f);self.r=np.cross(self.f,[0,0,1]);self.r/=np.linalg.norm(self.r);self.u=np.cross(self.r,self.f);self.polys=[]
 def project(self,p):
  v=np.array(p)-self.eye;z=np.dot(v,self.f);return (W/2+740*np.dot(v,self.r)/z,H/2-740*np.dot(v,self.u)/z)
 def poly(self,pts,color):
  self.polys.append((np.linalg.norm(np.mean(pts,axis=0)-self.eye),[self.project(p) for p in pts],color))
 def box(self,x,y,z,w,d,h,color):
  p=np.array([[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z],[x-w/2,y-d/2,z+h],[x+w/2,y-d/2,z+h],[x+w/2,y+d/2,z+h],[x-w/2,y+d/2,z+h]])
  for ix,shade in [([0,1,5,4],.78),([1,2,6,5],.68),([2,3,7,6],.83),([3,0,4,7],.9),([4,5,6,7],1.08)]:self.poly(p[ix],tuple(min(255,int(v*shade)) for v in color))
 def rod(self,a,b,r,col):
  a=np.array(a);b=np.array(b);v=b-a;v=v/np.linalg.norm(v);u=np.cross(v,[0,0,1]);
  if np.linalg.norm(u)<.01:u=np.array([1.,0,0])
  u/=np.linalg.norm(u);w=np.cross(v,u)
  ring=[r*(math.cos(i*math.pi/6)*u+math.sin(i*math.pi/6)*w) for i in range(12)]
  for i in range(12):self.poly([a+ring[i],a+ring[(i+1)%12],b+ring[(i+1)%12],b+ring[i]],tuple(int(c*(.65+.3*(i%6)/5)) for c in col))
  self.poly([b+q for q in ring],col)
 def render(self,role,t):
  im=Image.new('RGB',(W,H),(187,194,178));d=ImageDraw.Draw(im)
  for y in range(H):
   c=int(193-29*y/H);d.line((0,y,W,y),fill=(c-5,c+2,c-13))
  for _,p,c in sorted(self.polys,reverse=True,key=lambda x:x[0]):d.polygon(p,fill=c)
  # Fine film grain and instrument overlay make the source unmistakably synthetic.
  d.rectangle((22,20,198,47),fill=(42,61,44));d.text((32,27),'ARGUS / SYNTHETIC LAB',font=font,fill=(207,223,188))
  d.ellipse((W-38,27,W-31,34),fill=(162,190,123));d.text((W-160,24),f'{role.upper()}   {t:05.2f}s',font=font,fill=(48,71,45))
  d.line((22,H-38,22,H-22,40,H-22),fill=(236,242,224),width=2);d.line((W-22,H-38,W-22,H-22,W-40,H-22),fill=(236,242,224),width=2)
  return im
for role,eye in [('ego',(0,-8.4,7.6)),('left',(-5.3,-4.5,4.8)),('right',(5.3,-4.5,4.8))]:
 p=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r','24','-i','-','-an','-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',f'{OUT}/{role}.mp4'],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
 for frame in range(288):
  t=frame/24;s=Scene(eye)
  # Floor, workbench, olive work surface and receiving tray.
  s.box(0,0,-.4,25,25,.1,(156,165,148))
  s.box(0,0,.65,7.7,4.7,.25,(177,158,123))
  for x in [-3.3,3.3]:
   for y in [-1.8,1.8]:s.box(x,y,-.3,.22,.22,1,(70,85,72))
  s.box(0,0,.91,6.6,3.7,.035,(105,126,91))
  # Work mat grid as thin flat cuboids.
  for x in np.arange(-3,3.1,.5):s.box(x,0,.948,.008,3.4,.002,(129,147,113))
  for y in np.arange(-1.5,1.6,.5):s.box(0,y,.948,6.2,.008,.002,(129,147,113))
  s.box(1.65,.45,.97,1.65,1.6,.08,(174,183,163))
  for x in [.84,2.46]:s.box(x,.45,1.04,.06,1.65,.16,(196,203,184))
  for y in [-.34,1.24]:s.box(1.65,y,1.04,1.65,.06,.16,(196,203,184))
  s.box(-2.1,.8,.97,.5,.5,.5,(94,125,137));s.box(-2.5,-.4,.97,.45,.45,.45,(187,178,113))
  progress=min(1,max(0,(t-3)/4));smooth=progress*progress*(3-2*progress)
  x=-.9+2.45*smooth;y=-.35+.8*smooth;z=.97+.9*math.sin(math.pi*smooth)
  s.box(x,y,z,.56,.56,.56,(202,124,67))
  # Two simplified articulated robot arms.
  for side in [-1,1]:
   base=(side*3.25,-1.65,1.0);elbow=(side*2.3,-.8,2.7)
   grasp=t>2.5 and t<8
   gx=x+side*.48 if grasp else side*1.25
   gy=y if grasp else -.5
   gz=z+.55 if grasp else 1.9+.08*math.sin(t)
   wrist=(gx,gy,gz)
   s.box(base[0],base[1],.95,.65,.6,.25,(63,78,64))
   s.rod(base,elbow,.16,(198,207,192));s.rod(elbow,wrist,.13,(187,198,182))
   s.box(*elbow,.38,.38,.3,(66,83,65));s.box(gx,gy,gz-.12,.28,.38,.24,(58,75,58))
   for dy in [-.21,.21]:s.box(gx,gy+dy,gz-.43,.1,.08,.32,(78,91,76))
  image=s.render(role,t)
  if frame==0:image.save(f'{OUT}/{role}.jpg',quality=92)
  p.stdin.write(image.tobytes())
 p.stdin.close();assert p.wait()==0
 print(role,'generated',flush=True)
