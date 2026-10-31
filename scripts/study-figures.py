from pathlib import Path
import json
from reportlab.graphics.shapes import Drawing, String, Rect, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics import renderSVG
from reportlab.lib import colors
base=Path(__file__).resolve().parent.parent/'results/depth-study'
study=json.loads((base/'study.json').read_text());rows=study['rows']
BLUE=colors.HexColor('#3e6bb3');GREEN=colors.HexColor('#2c957a');GREY=colors.HexColor('#e4e7eb');GOLD=colors.HexColor('#e2ae49')
def label(d,x,y,text,size=11,color=colors.black):d.add(String(x,y,text,fontName='Helvetica',fontSize=size,fillColor=color))
def save(d,name):
 p=base/(name+'.svg')
 renderSVG.drawToFile(d,str(p))
 # ReportLab can emit Python None as a CSS fill value for open polylines.
 # SVG requires lowercase none; otherwise renderers fill line graphs black.
 p.write_text(p.read_text().replace('fill: None;', 'fill: none;'))
variants=['base','smooth','smoothEdge','full','withoutSmooth','withoutMinEdge']
d=Drawing(1000,430);d.add(Rect(0,0,1000,430,fillColor=colors.white,strokeColor=None));label(d,35,400,'Ablation: maximum sampled free-boundary turning angle',16)
b=VerticalBarChart();b.x=70;b.y=85;b.width=850;b.height=265;b.data=[[next(r['maxFreeTurn'] for r in rows if r['protocol']=='pressure' and r['solver']==s and r['recovery']==False and r['variant']==v) for v in variants] for s in ['pbd','spring']];b.categoryAxis.categoryNames=['Base','Smooth','Smooth+edge','Full','No smooth','No edge'];b.valueAxis.valueMin=0;b.valueAxis.valueMax=180;b.valueAxis.valueStep=30;b.bars[0].fillColor=BLUE;b.bars[1].fillColor=GREEN;b.bars.strokeColor=None;b.categoryAxis.labels.fontSize=10;b.valueAxis.labels.fontSize=10;b.valueAxis.visibleGrid=True;b.valueAxis.gridStrokeColor=colors.HexColor('#dddddd');d.add(b);label(d,70,55,'PBD',11,BLUE);label(d,145,55,'Spring',11,GREEN);label(d,70,30,'64 particles / stiffness 0.05 / global recovery disabled / identical pressure script / 0.1 s samples',10);save(d,'ablation-turn')
d=Drawing(1000,620);d.add(Rect(0,0,1000,620,fillColor=colors.white,strokeColor=None));label(d,25,590,'Slit width and passage quality',17)
for panel,(solver,k) in enumerate([(s,k) for s in ['pbd','spring'] for k in [.05,.8]]):
 x=30+(panel%2)*500;y=330-(panel//2)*255;label(d,x,y+215,f'{solver.upper()} / stiffness {k}',13)
 for col,gap in enumerate([100,84,72,60,48,36]):label(d,x+135+col*52,y+185,str(gap),11)
 for row,v in enumerate(['base','smooth','smoothEdge','full']):
  yy=y+140-row*36;label(d,x,yy+10,{'base':'Base','smooth':'Smooth','smoothEdge':'Smooth+edge','full':'Full'}[v],11)
  for col,gap in enumerate([100,84,72,60,48,36]):
   r=next(r for r in rows if r['protocol']=='gap' and r['solver']==solver and r['stiffness']==k and r['variant']==v and r['gap']==gap)
   color=GREEN if r['acceptedPass'] else GOLD if r['geometricPassed'] else GREY
   d.add(Rect(x+125+col*52,yy,44,28,fillColor=color,strokeColor=colors.white))
   label(d,x+137+col*52,yy+9,'OK' if r['acceptedPass'] else '!' if r['geometricPassed'] else '-',10,colors.white if r['acceptedPass'] else colors.black)
label(d,30,43,'Gap width in px; undeformed diameter 84 px. Global recovery enabled.',10)
for i,(text,color) in enumerate([('Meets sampled quality limits',GREEN),('Crossed, but quality rejected',GOLD),('Not fully crossed in 15 s',GREY)]):
 x=30+i*320;d.add(Rect(x,15,12,12,fillColor=color,strokeColor=None));label(d,x+20,17,text,10)
save(d,'gap-pass')
after=json.loads((base/'impact.json').read_text())['rows'];before=json.loads((base/'impact-before.json').read_text())['rows'];d=Drawing(1000,430);d.add(Rect(0,0,1000,430,fillColor=colors.white,strokeColor=None));label(d,30,400,'Impact response before and after material coupling',16)
for panel,solver in enumerate(['pbd','spring']):
 x=60+panel*490;label(d,x,365,solver.upper(),13);p=LinePlot();p.x=x;p.y=95;p.width=370;p.height=240;p.data=[[(r['stiffness'],(84-r['minHeight'])/84*100) for r in src if r['solver']==solver] for src in [before,after]];p.xValueAxis.valueMin=0;p.xValueAxis.valueMax=1;p.xValueAxis.valueSteps=[.05,.35,.9];p.yValueAxis.valueMin=0;p.yValueAxis.valueMax=40;p.yValueAxis.valueStep=10;p.lines[0].strokeColor=BLUE;p.lines[1].strokeColor=GREEN;p.lines[0].strokeWidth=2;p.lines[1].strokeWidth=2;d.add(p);label(d,x,65,'Stiffness slider value',11)
label(d,30,35,'Y: peak height compression (%) within 1.5 s after first floor contact; same initial drop height.',10);label(d,30,15,'Before',11,BLUE);label(d,100,15,'After',11,GREEN);save(d,'impact-response')
print('Three SVG study figures generated.')
