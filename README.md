# 我们的宇宙

[接手指南：当前状态、未解决问题与资源范围](docs/space-exploration/HANDOFF.md)

2026-10-29 驾驶座附近移动问题尚未通过：普通入口保留原碰撞；沿面滑行与收腿分别是 `seatSlide=1`、`seatEscape=1` 的隔离候选。收腿在一帧实景姿态的同源重建中1.2秒约29.5厘米，但另一实景首段只有约4.9厘米，截图原位置重建也未改善；右手与腿可能分别被座椅挡住。最终367项回归、类型检查和构建通过不代表移动体验通过。

2026-10-29 舱内HUD精简：[实际画面与操作](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-hud-20261029/index.html)。内舱/驾驶座撤下常驻大卡片、自动出舱步骤和诊断条；F打开唯一设备短侧栏，Tab统一查看手册、观测和设置，移动自动收回菜单。取消嵌套展开/收起，普通说明淡出，未解除的阻挡保留一行反馈；原物理/抓握/门控及模型保持。最终360项回归、类型检查与生产构建通过，整体模型美术、完整EVA与长时性能仍待验收。

2026-10-29 质感返修：[主游戏三机位原图对比与资产问题](output/hunyuan-adaptation/microgravity-cabin-20261025/surface-quality-20261029/index.html)。修正异常镜面反光和涂层金属感，保留原贴图变化，接回接触遮蔽、人物投影与有限2K近景预算；14份保护模型保持。最终355项回归、类型检查和生产构建通过，但整体仍未达到3A：来源硬边变形、混合图集/烘焙明暗、人物制服风格与冷加载/长时性能仍待解决，工程通过不等于视觉通过。

2026-10-29 端游操控与设备入口：[实景和剩余清单](output/hunyuan-adaptation/microgravity-cabin-20261025/desktop-controls-20261029/index.html)。默认辅助改为视向WASD/方向键、移动时平滑转身、Space/C升降、Shift加速、松键缓停；右键拖拽接入环视，严格惯性和实验隔离保持。原关节增加小幅渐变随动，人物比例/骨段/权重与原件保持。设备面板提供真实“抓稳设备”，服舱开柜/穿脱/检查集中；另修复自身关闭柜门误挡F查看及画布失焦残留按键。最终生产包已正常移动到服舱并完成抓稳、开柜、R穿戴、检查及F退出，先前独立连续路线完成领用/巡检暂停恢复；350项完整回归、类型检查和25.64秒生产构建通过。整体操控/动作仍待用户确认，完整EVA、实验装置及长时性能仍未通过，不能由这些数字代替验收。

2026-10-29 控制体验返修：[辅助漂浮与独立转身实景](output/hunyuan-adaptation/microgravity-cabin-20261025/assisted-controls-20261028/index.html)。上一轮只证明扶手的一次推离，未解决无支撑、撞停后的连续控制，用户已否决该体验。默认现为明确标注的游戏辅助：方向键/WASD持续移动、Q/E转身、Space减速、Z/C升降；M保留严格惯性，漂移实验自动切严格并锁定辅助。另修复微小动画跨面导致反向退出被反锁的问题，辅助姿态检查更严格，源几何及平移安全距离保持。生产构建已实测松手零速→移动→停稳→转身→再次移动→停稳，开发场景实测撞停退出；最终345项测试、类型检查与16.34秒构建通过，8份原件哈希保持。操控及整体视觉仍待用户确认，完整EVA/长时性能未通过；下方上轮记录保留为历史。

2026-10-28 宇航员移动与环视修复：方向键现按观察方向直接从真实扶手推离，Shift+方向键保留身体姿态，WASD+Space旧方式保持；无支撑时保持惯性并明确提示X重抓。普通漂浮不再被附近睡袋限制到半个环绕区，主场景已连续水平环视约一整圈；操作面板按钮后的方向键也能自动交回画布。实际仅右方向键推离约79厘米，按钮焦点下独立复验约45厘米，[实景与检查](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-controls-20261028/index.html)保留前后状态。最终340项测试、类型检查和12.07秒构建通过；8份保护原件保持。生产浏览器交互因本机预览环境未验证，未部署；整体视觉、完整EVA与长时性能仍待验收。

2026-10-28 实验装置安装前审：[原模型位置与操作检查](output/hunyuan-adaptation/microgravity-cabin-20261025/capillary-fit-20261028/index.html)保留925条原面射线、三个221点范围、原生手部可达与身体冲突证据。上方遮屏、中部挡工具，下部虽有平整区但操作姿态未通过；停止直接外挂，补右侧工具位改为实验单元的二维正面效果图与真实原件对照，尚未生成或修改三维模型。新图为窄高外形，与原前盒尺寸不同，须重新校准尺寸/控制点及一致多视图，不能套用旧触达结果。工位提示现明确巡检需要工具包、漂移观测无需工具包，并补完成后重抓返回。336项测试、类型检查和10.62秒生产构建通过；8份相关模型哈希保持，新的背部结构/工具收纳/来源和连续操作仍待确认与验证。

2026-10-28 漂移实验连续路线：修复Space推离遗漏已有收臂过渡而使左前臂碰到右舷内衬的问题，保持模型和源面碰撞。实际生产游戏已连续完成初始扶手出发、工位登记/取消重登、观测中暂停恢复、有效报告、左舷重抓及返回工位；[完整原片与实景](output/hunyuan-adaptation/microgravity-cabin-20261025/drift-route-20261028/index.html)含28.154秒正常速度录像，本机完整播放无错误。最终336项测试、类型检查和4.63秒生产构建通过，六份保护模型哈希保持。首个[密闭毛细流装置二维四视图](output/hunyuan-adaptation/microgravity-cabin-20261025/drift-route-20261028/capillary-design.html)可审阅，尚无装置模型/流体解算；整体视觉、无指导操作、完整EVA与长时性能仍未验收。

2026-10-28 设备任务与太空实验：已接通唯一工具包清单领还、抓稳工位巡检、实际照明模式、船载日志及读取真实游戏遥测的漂移观测。主游戏已连续完成初始扶手推离/漂移、重抓、设备切换、领用、巡检和归还；独立实际来源检查点完成3.0064秒/1.563328米有效观测并导出CSV。主游戏随后一次观测因源面碰撞约0.04秒中止，按无效保留，没有放宽碰撞。335项测试、类型检查与12.56秒生产构建通过，六份保护模型哈希保持。[设备与科学实验记录](output/hunyuan-adaptation/microgravity-cabin-20261025/equipment-loop-20261028/index.html)含实景、完整设备状态及NASA/ESA依据；毛细流、植物、舱外材料实验仍为设计项，完整EVA和整体视觉未通过。

2026-10-28 宇航服舱候选：按具体授权另存四片双折柜门，接入附近操作面板、真实开合避让、开柜后穿脱与取消/暂停/重载；主场景已实测从初始扶手接近服舱并显示/驱动新按钮，过近会阻止柜门展开和穿戴。327项工程测试、类型检查与生产构建通过；完整门框穿行两轮返修仍受阻，按质量门禁保留失败并停止该分支，完整EVA未通过。显式`lockerDoors=v1`查看，[本轮实景与限制](output/hunyuan-adaptation/microgravity-cabin-20261025/eva-loop-20261028/index.html)含开柜和穿戴截图，默认旧版保留。

2026-10-28 休息舱动作复查：新增[正侧面、逐帧与连续操作材料](output/hunyuan-adaptation/microgravity-cabin-20261025/visual-action-gate-20261028/index.html)。显式`sleepFit=v5&sleepPose=v2`动作候选只调整原生上胸骨链与摆臂顺序，并在固定休息末段闭眼；人物根约束点、比例、原骨段、网格/权重及全部模型文件保持。319项完整测试、类型检查和生产构建通过，整体视觉仍待确认；默认与旧动作保留。

2026-10-28 取消重试修复：已复现55 FPS下取消约0.44秒后重试、伸手约0.62秒失去可达接触的问题。设备抓点现按0.7秒伸手期间的惯性漂移筛选，并由同一只手完成；实际距离/速度/接触误差和碰撞限制保持。12组时机/帧率诊断均进入睡袋，生产构建已连续完成取消、重试、休息、暂停恢复、退出及X重抓。[最新实景与录像](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-home-review-20261027.html#retry-review)独立保存，历史失败保留；本轮未修改三维资产，整体视觉仍待用户验收。

2026-10-28 睡袋细磨：另存[v5候选](output/hunyuan-adaptation/microgravity-cabin-20261025/sleep-fit-v5-review.html?sleepFit=v5)，右侧增加最多约7.62mm软布曲率，原布纹改为等比例分段映射并调整哑光参数；原两处尾带35顶点贴合侧布，最大位移约12.95cm，实测间隙约2mm。六片及前后锚点保持，左侧几何、人物和固定结构保持，v4原件保留。316项测试、类型检查及构建通过，正常连续进出/暂停恢复/重抓已完成；取消后立即重试的一轮出现可达性拒绝，另存失败记录，不计通过。整体视觉及用户验收仍待确认，[验收包](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-home-review-20261027.html)含对照。默认旧版保持，显式`sleepFit=v5`查看。

2026-10-28 睡袋侧布接续：用户已明确授权三条右侧上限32cm，已另存[v4候选](output/hunyuan-adaptation/microgravity-cabin-20261025/sleep-fit-v4-review.html?sleepFit=v4)。左侧保持22cm候选，右侧改接前袋布面与原固定后边，实测最大约31.84cm；前袋仍不超过18cm，人物、头枕/背垫/硬框与原件保持。三床正面/右侧实景已保存，314项工程测试、类型检查及构建通过；生产构建连续进出、暂停恢复与重抓完成，59.851秒录像本机完整播放；整体及用户视觉尚未通过。默认保留旧版，显式`?sleepFit=v4`检查；[验收包](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-home-review-20261027.html)保留失败对照，下方v2/v3状态为历史。

2026-10-27 睡袋授权修整：已按明确授权另存[睡袋v2候选](output/hunyuan-adaptation/microgravity-cabin-20261025/sleep-fit-v2-review.html?sleepFit=v2)，原人物/原件/拓扑保留，前袋及带扣最多展开18cm，固定区域已核验。最新311项测试、类型检查、构建通过，实际生产候选连续进出及暂停恢复/重抓完成，59.875秒录像本机完整播放。斜侧面仍有连接缺口，**未通过视觉验收**；[侧边新增布面方案](output/hunyuan-adaptation/microgravity-cabin-20261025/sleep-side-connection-scope-20261027.html)待单独授权，未制作。默认游戏保留旧姿态，显式 `?sleepFit=v2` 查看候选；[验收包](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-home-review-20261027.html)已更新。

2026-10-27 休息舱切片接续：修复初始扶手切向推离、真实可达设备提示、退出后的重抓与取消提示；实际游戏已连续完成二号床进入/退出及暂停恢复。[回家验收包](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-home-review-20261027.html)含59.938秒实际录像、截图与已知问题。最新310项测试、类型检查和生产构建通过；人物原比例和来源网格保持。睡袋头枕/袋面适配仍未通过，拟议几何姿态修整待具体授权，完整EVA和长时性能未验收；详情见唯一活动任务末尾。没有上传、部署或发布，手机访问未验证。

2026-10-27 人物来源接入：用户确认的免费 Microsoft Rocketbox `Medical_Female_03` 已下载、核对来源并转换接入默认游戏微重力内舱；原模型网格与绑定保留，使用原有独立手指和 52 个脸部形变。点击“进入舱内行动”查看；[人物实物检查](output/hunyuan-adaptation/microgravity-cabin-20261025/rocketbox-review.html)与[完整内舱](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-experience.html)共用这一来源。旧人物以 `?crew=legacy` 对照、旧场景以 `?microgravity=0` 保留。本轮 308 项测试、类型检查和本地构建通过，实际游戏已观察到人物及扶手状态；完整动作视觉、连续到达和长时性能仍待验收。来源与 MIT 许可见 `assets-source/characters/rocketbox-medical-female-03/`、`public/licenses/microsoft-rocketbox.txt` 及唯一活动任务末尾。下方早期人物候选为历史。

2026-10-27 人物返修：[完整舱内体验](output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-experience.html)已接入小臂权重修整、保留体积的蒙皮、自然肘腕与松手动作；原网格/贴图保留。此为候选，整体美术与完整EVA仍待验收，详情见唯一活动任务末尾。

2026-10-25 舱内服与系留 EVA：[人物、宇航服舱和出舱原型](output/hunyuan-adaptation/microgravity-cabin-20261025/eva.html)补人物三方向、收纳舱开闭、气闸视觉和范围；独立二维原型可实际走完穿戴、双门互锁、系留出舱与返舱，并验证惯性、方向推进和卷收辅助。新11项检查加入本轮290项通过测试；尚未接入三维主场景，缺少来源资产、绑定、实际碰撞与绳索。另见[连续服务内衬](output/hunyuan-adaptation/microgravity-cabin-20261025/liner.html)：闭背/端面独立二维输入与有限曲面核对，未改产品模型。

2026-10-25 微重力模块细化：新增[模块四视图、尺寸接口与原壳核对](output/hunyuan-adaptation/microgravity-cabin-20261025/modules.html)。睡眠/工位四视图已定向修正侧视和背部安装点，扶手/驾驶区补二维接口；原壳 10 处截面、324 个背部点位与原角色骨链均只读取样。新模块背后需先深化连续服务内衬，有限取样不代表完整净空通过。本轮没有生成或替换三维模型、修改悬浮控制。

2026-10-25 微重力设计：按用户“先重新设计舱内”的要求完成[二维概念与布局评审](output/hunyuan-adaptation/microgravity-cabin-20261025/index.html)。参考 NASA/ESA 的实际乘员移动和睡眠方式，三床改为壁挂睡眠位、中央留漂浮通路，工作/驾驶设置抓握和约束；保留现船弧顶与前舱罩语言。本轮交付为设计稿，游戏模型与控制尚未替换，后续沿多视图、混元来源与实际试装路线制作。

2026-10-25 侧壁与动作返修：主场景原来仍加载旧 j2 船壳，现已原字节接入既有 g12，两侧喷射器对应内舱使用已授权的平整封板。行走、转向、走停、坐起、床边坐下再躺卧、挥手、手指和门旁按键均调整节奏与身体配合，支撑脚增加位置/朝向保持；模型绑定及权重保持。279 项测试、类型检查、构建通过，主场景已实测两侧墙面和完整动作流程。见[本轮检查](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/motion-wall-review-20261025.json)与[交互预览](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/review-cabin-controls.html)；整船美术仍待验收。

2026-10-25 全设备提示：现有 11 处交互点均支持靠近后按 F；三张床可躺下/起身，两座椅可坐下/起立，两组主控台显示实际仪表，工作台、储物柜和宇航服柜提供查看面板及查看记录，舱门保留真实按键开关。床铺支持过渡取消、暂停及资产重载后的姿态恢复。273 项测试、类型检查、构建与主场景实测通过；柜内物品及维护任务尚未登记，未实现物品转移或维修模拟。见[全设备检查](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/cabin-equipment-review-20261025.json)及[操作预览](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/review-cabin-controls.html)。

2026-10-25 接续修整：细磨页已补交互版/主场景入口，修复预览动作按钮后的 F 焦点、入座对位的移动取消，以及向后观察后入座仍朝后的驾驶镜头。界面统一显示实际舱外密封门。268 项测试、类型检查、构建和实景复验通过，十份模型字节保持。见[接续检查](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/cabin-controls-followup-20261025.json)。

2026-10-24 交互返修：主场景现在按距离显示 F 情境提示；靠近舱门可自动短距离对位并伸手开关，靠近左右驾驶座可坐下，入座后 F 起立。转身、走停、坐起与挥手加入过渡，移动或 Esc 可取消操作；站立时不会推进飞船。现有舱门增加表面标识、密封边涂装和按钮标识，保留通向舱外的布局。267 项测试、类型检查、构建及主场景实测通过，原模型几何/绑定保持。见[本轮返修记录](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/cabin-gameplay-review.json)和[交互预览](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/review-cabin-controls.html)；角色仍使用原骨骼原型，整船美术未验收。

2026-10-24：后舱门与宇航员基础动作已接入主场景。点击“宇航员”进入舱内行动，WASD/方向键行走，拖动转视线；靠近内侧门旁按钮后点击实物按钮或按 E/F，角色实际伸手触到后开关门。Q 挥手、G 轻屈手指、H 张手；关门遇人会回开，开门范围有人会等待。用户明确授权的中央门叶/端面/门槛避让与低位按钮另存为 d2，其余九份产品资产保持。支持暂停及资源重新载入后的角色位置/门状态恢复，不包含 EVA 或新门后通道；角色仍为原有骨骼原型。见[交互实景预览](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/review-cabin-controls.html)、[本轮检查](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/cabin-interaction-review.json)与唯一任务末尾 C/D 记录；整体美术仍为 changes_requested。

2026-10-22：按用户确认，“最新加厚＋宇航员入座版”已接入项目根页面。当前加载j2厚壳/玻璃、119个原有地板/家具/后隔舱实例，以及左驾驶座的暖白宇航员；驾驶视角位于右侧空座。远视沿用同一外壳，旧母版保留供回退。后隔舱为静态模型，门/EVA交互不开放；接缝尚未拉直、角色原型权重仍待完善，接入不代表整船美术通过。10份GLB原字节复制、来源与署名见[资产清单](src/assets/models/current-ship-20261022/manifest.json)和[许可](src/assets/models/current-ship-20261022/ATTRIBUTION.md)，实施与实测见唯一任务M-AO节。下方“产品未替换”等文字是此前历史状态。

最新内舱返修：依据实际顶棚绘制了下舱多视图并完成两次混元原件检查；三图版错误盒化，四图版地板恢复但缺一侧长墙、偏窄偏矮，两件均否决。停止这套输入路线，不以PNG轮廓相同冒称精确重建。[最新真实评审](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/main-split-20261019/lower-v3-volume/review.html)，唯一任务BC-L记录原件、朝向排查和限制。默认原内舱、外部r10、旧下舱与保留顶棚均保持，整舱仍未通过。

“我们的宇宙”是一套面向桌面 Web 的单画布太阳系探索项目。打开项目根地址即进入新版太阳系，不依赖查询参数、旧版航行入口或微信小程序。

2026-10-19 内舱接续：下舱/拱顶两份混元原件已完成同框、独显及实际船壳有限采样，墙顶缝约0.68–0.72m、端部横向偏差与拱顶肩部穿出仍未通过。已提取同一r10来源的正/侧/顶/斜视PNG作为下一轮轮廓参照；它们仍是外部表面，不直接冒充内饰生成图。[最新实景与同源轮廓](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/main-split-20261019/review.html)及唯一任务BC-J记录本轮证据；默认原内舱和外部r10保持。

2026-10-18 本地接续：玻璃局部 r10 已获用户确认，四件混元原件已完成独立等比试装，产品尚未替换、整舱未验收。最新入口为 [内舱试装](output/hunyuan-adaptation/interior-assembly-20261018/review.html)，真实限制、复现步骤与提交推送授权见[唯一任务 AY 节](docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md#ay-2026-10-18-用户授权提交推送并交回本地开发)，文件清单见 [本地交接清单](docs/local-handoff-20261018.json)。下方早期停止、玻璃黑块未修复等描述保留为历史，以最新任务节为准。

2026-10-18：用户要求继续回退，已从r13与后续家具替换版进一步退到整船统一母版v6原内舱。[默认试装入口](output/hunyuan-adaptation/interior-assembly-20261018/review.html)只加载原母版内舱与保留的r10外壳/玻璃两份既有模型，不再加载r13、10月13日混元家具替换或远端v7。来源文件和产品资产未改，整体仍待验收。当前选用与实景证据见[唯一任务 BB 节](docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md)，此前r13恢复与v7为历史记录。

2026-10-18 内部空间适配：用户明确只允许混元生产，并授权二维图片校准。已按原船壳只读采样重做[多视图与分舱输入](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/review.html)；两份整舱混元原件因前端收窄/后顶缺失被否决，转为前围护、闭合主舱、后过渡分段检查。默认原内舱和外部r10保持，任何候选均不代表已验收；实测与受理记录见唯一任务BC节及[混元原件记录](output/hunyuan-adaptation/interior-fit-hunyuan-20261018/hunyuan-runs.json)。没有本地建模、提交推送或产品替换。

用户指定的历史整合包已提供[交接附件下载](https://github.com/744619344-cell/interstellar-playground/releases/download/integration-20261008-archive-20261017/integration-20261008.zip)（1.084 GB，原包 SHA256 与远端一致）。归档说明和完整校验值见[附件页面](https://github.com/744619344-cell/interstellar-playground/releases/tag/integration-20261008-archive-20261017)；该历史包不代表包含后续 v7/v8 全部本机素材或已通过模型验收。

船壳脚本缺失依赖已另提供[依赖包下载](https://github.com/744619344-cell/interstellar-playground/releases/download/hull-build-dependencies-20261017/hull-build-dependencies-20261017.zip)（1.108 GB，含两个完整 assembly 目录、exterior-reference.glb 及补充依赖）。保留 `output/` 与 `assets-source/` 层级解压至项目根目录，包内含说明及逐文件校验清单；[附件说明](https://github.com/744619344-cell/interstellar-playground/releases/tag/hull-build-dependencies-20261017)记录完整 SHA256。本机未找到 `build_hull.fixed.py`，本次没有运行模型构建或生成修复 GLB。

在线体验：[GitHub Pages](https://744619344-cell.github.io/interstellar-playground/)

当前能力：压缩视觉尺度的太阳系全景与星体聚焦（LOD2/LOD1）、太阳系中的飞船模型与驾驶视角（跟随 / 驾驶舱 / 自由观察）、W/S 前后与 A/D 横移、鼠标拖拽与滚轮缩放、目标锁定、航向辅助和防撞、地球/月球/土星手动航线、推进反馈与基础推进声，以及仅保存在当前浏览器的本地音乐。

太阳系飞船接入（2026-10-15）：已移除“相机试验”和固定轨道图标，根页面直接加载现有飞船模型。点击模型/标签进入跟随观察，右侧卡片或“飞船”按钮进入驾驶舱；返回全景保留同一飞船的位置、姿态和航线。模型仍待完善，今后通过[统一资产配置](src/features/space-exploration/rendering/spacecraft/shipModelAssets.ts)替换总成及外观LOD；新资产需保持现有坐标、锚点和动画约定，不必重写太阳系入口或航行逻辑。重启后已实测模型显示/点击、驾驶切换、飞行位置与航线保留、缩放及加载失败重试；右侧卡片同步实际泊位/航行状态。真实页面隐藏恢复及长时性能仍待验，软件通过不代表模型美术通过。

尚未具备：太阳系浮动原点、星体 LOD0 近景、EVA、运行时资源预算检查、20 分钟性能验收；基础舱内行走/手部动作见上方 2026-10-24 记录，角色权重和管线仍待完善。路线图校准见 [开发路线](docs/space-exploration/04-DELIVERY-ROADMAP.md)。

模型资产进度（2026-09-13）：外部 LOD0/1/2 与静态内舱 LOD0/1 均已通过资产级验收，内舱布局已获用户确认。开发服务支持 [外部预览](assets-source/blender/spacecraft/viewer.html) 与 [内舱预览](assets-source/blender/spacecraft/interior/viewer.html)，这些独立查看器尚未接入游戏流程。

P3-T04 机械动画已通过资产级验收：[机械预览](assets-source/blender/spacecraft/mechanisms/viewer.html)，支持内外门、控制台、推进器反馈及暂停/复位。[任务记录](docs/tasks/2026-09-13-p3-t04-spacecraft-mechanisms.md)与[资产登记](docs/space-exploration/12-SPACECRAFT-MECHANISM-ASSETS.md)包含复现方式；尚未接入游戏运行时。

P3-T05 图集优化已验收：[PBR 预览](assets-source/blender/spacecraft/pbr/viewer.html) 仍是独立资产检查入口，不是产品驾驶流程；完整装配视角绘制次数 45 → 24，保留几何和六个动画。[资产登记](docs/space-exploration/13-SPACECRAFT-PBR-ASSETS.md)记录纹理内存与文件体积取舍。

P3-T06 / P3-T07 已接入真实驾驶座、七个锚点、控制台及内外舱门，支持按钮/`F` 键、机械互锁、暂停与复位。历史验收见 [P3-T06](docs/tasks/2026-09-13-p3-t06-spacecraft-visibility.md)和 [P3-T07](docs/tasks/2026-09-20-p3-t07-spacecraft-interactions.md)。

当前活动任务为 [P3-R01 飞船重制](docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md)（2026-10-09），状态 `changes_requested`：用户已否决 Codex 自主建模方式及整舱 v6 视觉，明确要求今后未经明确授权不得自主建模，包括程序化几何、接口母版和补洞。后续路线改为整舱统一视觉设计、模块一致多视图与尺寸/接口说明、混元 3D 生成、来源检查和逐件试装，详见任务 AG 节及根目录 AGENTS.md。被否决的自建 v6、25 类拆件与技术检查仅保留历史记录；实际产品仍加载该版本，本次规则调整没有替换资产。完整 LOD、人体净空及长时性能仍未验收，技术自查不能代表美术合格。

2026-10-17：v7圆弧肩顶/舱长/空后门联合返修已完成，选4张图（侧图换槽，上传5次），V3.1/50k免费单次16→15、累计46。官方原件38.70MB/59,243面，八方向实看与9张真实装船检查完成：后门贯通恢复，按宽7.1m为7.10×4.35×11.52m，向后不再明显露第二层原顶；但上部余量、后段和前口衔接、发白地板及接缝粗糙仍未通过。按长13.2m为8.14×4.98×13.20m，原壳穿插拒绝。15份GLB原字节不变，产品未替换，玻璃黑块未修复，整体changes_requested，不自动再受理。 [查看v7实际原件、三轮对照与试装](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/全空间重设计-v7-20261017/主结构-v7/主结构审查.html)。

此前重设计方向与诊断（2026-10-16）：用户要求整舱适配现有船壳，先生成完整内舱结构，再评估旧设备复用；前窗与舱罩同步重设计。[整舱与前窗设计历史](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/设计评审.html)保留旧件和来源记录。黑块已定位为原壳实体表面与深色贴图，仍未修复，二维图的通透玻璃不代表实际模型问题已解决。

装船接续（2026-10-16）：[新整舱实际试装](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/装船试装.html)已加入原船壳、摆正并整件等比至4.40×2.95×12.46m的新舱、旧座椅/主台v2/中央台与后舱重新试排的两床/工作台；驾驶区地板有限采样校准。新前窗原件明显偏矮/短且不透明，未采用；当前使用原舱罩玻璃节点的标准PBR透射候选。后舱右侧低顶、墙面固定、人体与连续穿插待验，黑块未修复，整体仍changes_requested。九份来源哈希一致，本轮新受理0、累计40，产品未替换。

拆图生成接续（2026-10-16）：用户明确要求拆开上传并生成。内舱先纠正完整屋顶并补背面，前窗沿已有四视角机械拆图；两对象各上传四张独立图片，V3.1/50k分别单次受理，免费次数19→17，无付款、累计受理40。已下载[整舱原件](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/整舱-混元-v1/混元原始模型.glb)（38.12MB/50,056面）和[前窗原件](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/前窗-混元-v1/混元原始模型.glb)（41.45MB/50,014面），基本只读检查及[真实GLB查看器](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/模型原件查看.html)加载/视角实测完成。前窗窗框与窗面共用一个OPAQUE材质，真实透射未保留；实际装船、旧件复用与原壳黑块仍未完成，不把生成成功当适配通过。原件和产品未替换，详情见唯一任务AP末尾。

AK 逐件试装：v3、v4实物接边不合格；v15使用4张独立多视图，混元V3.0/50k免费接收1次，额度15→14，累计15个已接收任务。当前：第十五版V3.0原件及实测内墙净宽六角度试装完成；隔舱视觉试装候选可保留，进入匹配门叶。合适才处理下一件，没有自主建模，产品仍未替换。 见[舱内逐件试装](output/hunyuan-adaptation/hunyuan-design-20261009/舱内逐件试装.html)和任务AK节。

匹配门叶v1因上角干涉拒绝；v2原件八向及六角度槽内试装完成，按宽1.538m等比接边可保留为静态候选，继续前窗总成。四输入原字节复用V3.0/50k，额度13→12，累计17个已接收任务；原件未改、产品未替换，整舱未验收。见[门叶同框试装](output/hunyuan-adaptation/hunyuan-design-20261009/门叶同框试装-v2.html)。

本仓库不包含移动端适配、微信小程序、H5 多端抽象、旧十星体独立玩法、照片球或旧航行回退。唯一目标平台是桌面 Web。

开发需求、架构、资产规范和路线从 [单画布太阳系探索计划](docs/space-exploration/README.md) 进入。

## 技术栈

- React 18
- Vite
- TypeScript
- Three.js
- Node Test Runner + TSX

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- 桌面浏览器，最小支持宽度 1280px

## 安装

```bash
npm install
```

## 开发

```bash
npm run dev
```

默认访问 `http://localhost:5173/`，无需任何 feature flag。

### 浏览器连接超时后的桌面重启

下次浏览器控制无法连接时，可双击项目根目录的[重启Codex.cmd](重启Codex.cmd)。程序会倒计时8秒，先正常关闭当前商店版ChatGPT/Codex桌面应用，仍未退出时才结束同一Windows会话、同一可执行文件的进程，再重新启动。倒计时内可按Ctrl+C取消；重启会关闭该应用全部窗口，并可能中断正在执行的任务。项目已保存文件保留。

只检查目标和本地服务，不重启：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-codex.ps1 -CheckOnly
```

显式运行或预演：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-codex.ps1 -Restart
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-codex.ps1 -Restart -WhatIf
```

直接运行PowerShell脚本而不传`-Restart`也只检查。入口适配当前`OpenAI.Codex`商店安装包，每次动态读取版本位置和启动标识；身份无法确认即退出。结果日志在忽略目录`.cache/codex-restart/`，不写账号、Cookie或本机路径。仅检查项目服务，不关闭Chrome/Node、不修改浏览器资料、不安装依赖/定时任务、不永久改变执行策略。进程重新出现只代表桌面应用启动，浏览器控制是否恢复需再测试。2026-10-15用户确认重开后，浏览器控制已实际恢复；脚本日志仅记录到关闭阶段，未确认自动激活完成，不能视为完整自动重开实测通过。

实现参考微软的[AUMID应用标识](https://learn.microsoft.com/en-us/windows/configuration/store/find-aumid)、[应用启动](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/debugging)与[正常关闭窗口](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.closemainwindow)文档。

2026-10-15反复卡住复核：内置浏览器与Chrome的轻量页面点击、文件选择均正常；经用户明确授权重启Chrome，完整关闭/重开和标签恢复已观察到，重启后基础操作再次通过，但混元生成页切换模式和随后读取仍超时。因此上传权限可用，Chrome重启没有修复当前混元控制故障，根因尚未确认；不重复开启文件权限或循环重启。主仪表台v2四张输入保留，未上传、未生成。实测证据见[浏览器连接诊断](output/hunyuan-adaptation/hunyuan-design-20261009/浏览器连接诊断-20261015/诊断结果.json)，后续按[官方扩展排障](https://learn.chatgpt.com/docs/chrome-extension)处理；桌面重启脚本只能作为一次恢复手段，不能保证修复此类故障。

2026-10-16续查：恢复离线的5173开发服务，并通过专用浏览器接口实际验证太阳系画面、说明打开/关闭、截图和本地文件选择。此前仅据函数编排清单判断接口未加载的推断已撤回，今后直接验证已声明的接口，不反复要求用户重选插件或重启。混元页面的初始化/截图/读取仍超时，上传生成继续受阻；基础浏览器恢复不代表该流程修复。见[本轮更正与实测](output/hunyuan-adaptation/hunyuan-design-20261009/浏览器连接诊断-20261015/修复复查-20261016.json)。

## 构建

```bash
npm run build
```

生产构建输出到 `dist`。预览使用 `npm run preview`。

GitHub Pages 项目站点构建使用：

```bash
npm run build:pages
```

## 质量检查

```bash
npm run typecheck
npm test
```

项目实行文件规模约束：React 页面/业务组件不超过 300 行，通用工具不超过 200 行，渲染引擎不超过 400 行。后续开发采用 Codex × Grok Build 联合模式，见 [AI 开发与验收流程](docs/DEVELOPMENT_WORKFLOW.md) 与 [Codex × Grok Build 联合开发工作流](docs/CODEX_GROK_WORKFLOW.md)。

前窗v1顶棚穿入拒绝；v2原件八向与两组六向试装完成，仅刚性安装定位后保留静态视觉接边候选，继续驾驶围护一致设计。原件未改、产品未替换，整舱未验收。见[前窗同舱试装](output/hunyuan-adaptation/hunyuan-design-20261009/前窗同舱试装-v2.html)。

驾驶围护（2026-10-13）：暂停云端重生成，v11六图留存、未受理。用户明确允许只修选中的混元v9前窗/顶棚接口、两处变形把手和缺失灯带，不重建整舱。局部修订已另存并完成八角度对照、观察移动、缩放与切页恢复实测，见[原件/局部修订预览](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)。来源原件、地板及授权区域以外几何保留；产品未替换。当前为局部修订候选，整舱无缝、完整几何质量和用户美术尚未验收，详见同一任务AK节。

交接后续修（2026-10-13）：局部预览默认r13，修正灯带遮挡与端部、缩小前窗上框及肩角间距，支持同机位修订前对照、左右肩角近景、WASD/方向键移动和Q/E升降。八视角及观察操作完成本轮复验；来源贴图折痕仍保留，整舱/用户美术未验收，产品未替换。详情见同一任务AM及AN节；这些续修文件尚未提交推送，920d1ed云端交接快照仍为r9。

接口图像续修（2026-10-13）：两次内置图像编辑已另存局部UV诊断纹理并完成实际模型同机位对照；r15/r16/r17因剩余折痕及不自然局部过渡均未通过，默认继续保留r13。预览中的r17链接明确标为“未通过，仅对照”；完整提示词、范围外像素/逐面属性检查和本轮实测记录见同一任务AO节。接口视觉修复仍未完成，产品未替换，未提交推送。

路线恢复（2026-10-14）：用户弃用Nomad等外部模型方案，恢复混元模块生成与实际试装。r13与四类混元设备候选保留，继续后舱长侧墙、地板、顶棚；长侧墙已单次V3.1/50k受理，等待原件检查，详见同一任务AP末尾。默认[混元试装入口](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)保持，产品与用户美术尚未验收。

装配返修（2026-10-15）：用户否决外侧落地台堵塞座椅两侧过道，两台已从默认布局撤下，原件及否决证据保留；旧扶手杆不恢复。两侧通路留空，操纵杆方案待整体重排，驾驶控制尚不完整。隔舱v15/门叶v2继续静态试装；来源静帧不代替WebGL、可达性、门机构及用户美术验收。后舱其他生成暂停，详见同一任务AP末尾。

内外装配（2026-10-15）：同一[试装入口](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)恢复已选外壳/舱罩玻璃，并复用现有前窗玻璃节点，支持整船与驾驶眼位切换。来源静帧发现内舱顶棚在曲面舱罩下显出盒状轮廓，整船视觉未通过；没有以隐藏外壳或改变透明度掩盖问题，没有修改源几何或替换产品。证据与接续点见同一任务AP末尾。

离机远程续作（2026-10-15）：已保存[统一适配设计v2](output/hunyuan-adaptation/hunyuan-design-20261009/内外舱装配-20261015/统一适配设计-v2.png)及[集成操纵杆主仪表台四视图](output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/一致四视图.png)。这是二维候选；浏览器控制超时期间尚未上传混元或生成新模型，r13和既有来源未改，详见同一任务AP末尾。

主仪表台八视图（2026-10-16）：按用户纠正改以V3.1正面主图+七辅助视图为目标，原四图不改，内置imagegen补顶/底及左右前45°候选。见[八视图同屏检查与完整提示词](output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/八视图补充-20261016/八视图候选检查.html)。八张均已在本机检查页加载；独立二维图不证明共用几何，网页槽位/免费设置与用户视觉仍待验，尚未上传、生成新GLB或替换原件。

主仪表台生成与装配接续（2026-10-16）：上述生成前断点已推进。八图V3.1/50k单次生成完成，原始GLB及来源哈希已保存，额度20→19、无付款；[原件与v1/v2同机位试装](output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/来源试装.html)已实际检查。用户委托Codex把关后，保留v2作为整舱试装候选，现有[整舱试装入口](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)代码默认加载集成双握把的v2，支持旧主台v1显式对照；原件、r13和产品资产保留。有限包络/射线检查未见座椅相交或所测前向遮挡，但不是人体净空或完整碰撞通过。内置浏览器本轮已完成带外壳/玻璃的驾驶眼位、驾驶席、左右过道及台下观察并保存新截图，读取/点击/后续读取通过，控制台error/warn为空。双握把与留空过道可见；来源细节、人体可达和膝部净空、顶棚与外壳匹配及整舱美术仍未验收，详见唯一活动任务AP末尾。

内舱云端素材补齐（2026-10-18）：截图缺失的主结构 v7、主仪表台 v2、折叠床 v1、工作台 v1 原始 GLB 及其直接设计输入/来源记录已补入本分支，云端拉取即可获得。见[获取、校验与接续说明](docs/CLOUD_INTERIOR_HANDOFF_20261018.md)。这次补齐不覆盖云端已确认的玻璃 r10，不代表整舱验收通过。
