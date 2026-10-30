const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),base=path.join(__dirname,'../results/depth-study'),{metadata,rows}=JSON.parse(fs.readFileSync(path.join(base,'study.json'))),impact=JSON.parse(fs.readFileSync(path.join(base,'impact.json'))).rows,before=JSON.parse(fs.readFileSync(path.join(base,'impact-before.json'))).rows,border=JSON.parse(fs.readFileSync(path.join(base,'border-impact.json'))).rows;
for(const [f,hash] of Object.entries(metadata.sourceHashes))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../src',f))).digest('hex')!==hash)throw Error('core changed since experiment: '+f);
const names={base:'基础模型',smooth:'仅平滑',smoothEdge:'平滑＋短边',full:'完整处理',withoutSmooth:'去掉平滑',withoutMinEdge:'去掉短边'};let lines=[];const add=s=>lines.push(s),f=(n,d=2)=>Number(n).toFixed(d);
add('# 轮廓稳定性 窄缝通行与材质响应实验\n');
add('## 实验目的\n');add('本实验研究柔软变形、形状保持和碰撞之间的取舍，并核对软硬滑块是否能产生可见的撞击差异。结果用于后续报告，不是最终报告；不以功能数量代替算法效果。\n');
add('## 可复现条件\n');add(`环境：${JSON.stringify(metadata.environment)}。固定步长1/120秒，64个等质量粒子、相同连接、主求解8轮，保留同样的6轮收尾与接触处理。120组条件均预热一次后重复三次，三次在每0.1秒及最终采样点的完整坐标指纹一致。`);
add('所有消融组保持同样的粒子密度和循环安排。基础组仅关闭曲率平滑、短边保护和转角限制，不使用此前32粒子的旧版，以避免密度和收尾次数成为混杂变量。软硬参数同时影响结构约束与开启时的全局恢复，两种模型未做等效材料标定。\n');
add('形状、面积、穿透、自由轮廓折角和自交指标每12步采样一次，加上最终状态。文中最大值是这些采样的最大值，不能保证捕获两次采样之间的短暂异常。单步耗时只围绕核心step计时，排除指标计算与渲染，取三次平均单步耗时的中位数。\n');
add('## 持续挤压与消融\n');add('前6秒顶向第一面墙，6至9秒引导到窄口外侧，9秒时撤除引导和障碍，再观察6秒。折角在距障碍至少10像素的粒子上测量；自交仅计非相邻边的严格交叉，不含相切和共线重叠。\n');
for(const solver of ['pbd','spring'])for(const recovery of [true,false]){
 add(`### ${solver.toUpperCase()} 全局恢复${recovery?'开启':'关闭'}\n`);add('| 配置 | 最大自由折角 ° | 最大自交数 | 最大面积偏差 % | 核心毫秒每步 |\n|---|---:|---:|---:|---:|');
 for(const r of rows.filter(r=>r.protocol==='pressure'&&r.solver===solver&&r.recovery===recovery))add(`| ${names[r.variant]} | ${f(r.maxFreeTurn,1)} | ${r.maxSelfCrossings} | ${f(100*r.peakArea)} | ${f(r.coreMsPerStep,4)} |`);add('');
}
add('关闭全局恢复的组用于检查局部处理是否被全局恢复掩盖。基础模型中面积误差小不代表轮廓正确：有向面积无法可靠反映自交轮廓的真实占据区域，必须结合自交和折角判断。\n');
add('平滑已解决多数测试中的尖角；完整处理在极软弹簧模型的持续挤压中进一步降低折角。去掉短边保护的影响依场景而异，不能据这些结果宣称每个子项在所有条件下都不可缺少。完整处理会增加开销，且不保证通行宽度单调改善。\n');
add('恢复阶段位于引导穿缝之后，部分组在撤力前已接近原形，原始恢复时间因此接近一个采样起点；这些值不用于比较恢复速度。恢复阈值为六个连续采样点形状误差低于2%，跨度0.5秒。\n');
add('![消融折角图](ablation-turn.svg)\n');
add('## 缝隙宽度扫描\n');add('单面厚40像素的竖墙，中心狭缝宽度分别为100、84、72、60、48、36像素；初始角色直径84像素，质心位于(170,270)。先静置1秒，再引导到(780,270)，总时长15秒，不施加重力。\n');
add('完整几何通过要求所有轮廓粒子到达墙右侧x>482并持续60步。表中“通过”还要求所有采样满足面积偏差≤10%、侵入≤0.5像素、自由折角≤60°、有向面积为正且没有检测到严格自交。“形状异常”表示几何通过但未满足上述质量标准。这些是本实验的操作性阈值，不是真实材料定律或课程评分标准。“未通过”只表示15秒内未完整通过。\n');
for(const solver of ['pbd','spring'])for(const stiffness of [.05,.8]){
 add(`### ${solver.toUpperCase()} 软硬参数 ${stiffness}\n`);add('| 配置 | 100 px | 84 px | 72 px | 60 px | 48 px | 36 px |\n|---|---|---|---|---|---|---|');
 for(const variant of ['base','smooth','smoothEdge','full']){const r=rows.filter(r=>r.protocol==='gap'&&r.solver===solver&&r.stiffness===stiffness&&r.variant===variant);add(`| ${names[variant]} | ${[100,84,72,60,48,36].map(g=>{const x=r.find(x=>x.gap===g);return x.acceptedPass?'通过':x.geometricPassed?'形状异常':'未通过'}).join(' | ')} |`)}add('');
}
const gaps=rows.filter(r=>r.protocol==='gap');add(`共96组缝隙条件中，几何通过${gaps.filter(r=>r.geometricPassed).length}组，满足采样质量条件${gaps.filter(r=>r.acceptedPass).length}组，几何通过但形状不合格${gaps.filter(r=>r.geometricPassed&&!r.acceptedPass).length}组。不能把折叠或自交后挤到另一侧当作成功。\n`);add('在每种配置各24组缝隙条件中，基础模型几何通过20组，但只有10组满足采样质量标准；平滑、平滑加短边、完整处理均为19组满足标准。因此不能据此宣称短边和抗折提高了本扫描的通过数，它们的作用应结合持续挤压下的异常轮廓判断。\n');
add('完整弹簧模型在k=0.05时未在15秒内通过48像素缝隙，而k=0.8时通过，说明此动画模型并非越软越容易通过。这可能与驱动、保形和局部约束共同作用有关；本实验没有进一步分离驱动强度的贡献。\n');
add('![窄缝通行图](gap-pass.svg)\n');
add('## 软硬滑块与撞击形变\n');add('原版所有档位使用相同的全局恢复系数0.012，固定保形处理使撞地差异很弱。现在开启形状恢复时，每轮系数改为 alpha=0.001+0.011×(k/0.35)²，默认k=0.35仍为0.012。关闭该开关后，此恢复项同样关闭；抗折和接触处理仍保留。\n');
add('固定初始质心(480,100)、半径42像素、重力650，比较首次接触地面后1.5秒内的最小高度。这里测量的是形变，不是恢复系数、能量守恒或真实材料弹性。\n');add('| 模型 | 软硬参数 | 修正前最小高度 px | 修正后最小高度 px | 修正后最大宽度 px |\n|---|---:|---:|---:|---:|');
for(const r of impact){const old=before.find(x=>x.solver===r.solver&&x.stiffness===r.stiffness);add(`| ${r.solver.toUpperCase()} | ${r.stiffness} | ${f(old.minHeight)} | ${f(r.minHeight)} | ${f(r.maxWidth)} |`)}add('');
add('地面、顶边、左右边框共24组检查均验证了软、中、硬三档在碰撞法向上的最小尺寸按预期递增。侧边与顶边使用相同初始位移速度发射，地面使用同高重力落下；每个方向内比较，不能将四个方向的绝对数值直接视为同一冲击强度。\n');add('![撞击响应图](impact-response.svg)\n');
add('## 限制与结果边界\n');add('- 这些是确定的单角色二维动画测试，不是对任意用户操作的稳定性证明。\n- 质量检查按0.1秒采样；自交检查不覆盖相切、重合及连续时间事件。\n- 有向面积在自交时不等于实际占据面积，因此同时报告轮廓几何问题。\n- 碰撞投影、速度限幅、几何平滑与全局恢复都改变能量，不用于材料参数反演。\n- 时间结果来自本机离线核心，固定条件顺序运行，受JIT、机器负载和温度影响；不能代替浏览器帧率与实际手感验收。\n- 恢复段不构成有效的恢复速度对比；本轮主要结论来自轮廓稳定性、缝隙通行和同高撞击。\n- 缝隙只测试六个离散宽度；某宽度通过而更窄一档未通过，不证明已找到精确的最小可通宽度。\n');
add('## 复现\n');add('项目目录执行：\n```sh\nnode scripts/check-ablation.js\nnode scripts/impact.js --baseline\nnode scripts/impact.js\nnode scripts/border-impact.js\nnode scripts/depth-study.js\nnode scripts/study-summary.js\n```\n');add('数据实验只需Node.js；可选图表生成使用Python reportlab执行scripts/study-figures.py。study.json保留条件、环境、核心源码SHA256、原始指标与代表帧；summary.csv用于快速查看，runs.jsonl保留每组的独立记录。\n');
fs.writeFileSync(path.join(base,'实验分析.md'),lines.join('\n'));console.log('实验分析已按实际数据生成，核心源码指纹一致。');
