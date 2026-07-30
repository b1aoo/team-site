import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import RoamingLegendaries from '../../components/RoamingLegendaries/RoamingLegendaries'
import { getAssetUrl } from '../../utils/assets'
import styles from './Home.module.css'
import { useInGameClock } from '../../hooks/useInGameClock'
const IN_GAME_DAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const DAY_OFFSET = 5;
const PERIOD_LABELS = { Morning: '清晨', Day: '白天', Night: '夜晚' };

function InGameClockDisplay() {
  const state = useInGameClock(DAY_OFFSET, IN_GAME_DAYS);

  const timeStr = `${String(state.hours).padStart(2,'0')}:${String(state.mins).padStart(2,'0')}`;
  const realMins = state.realMinsLeft;
  const countdownStr = realMins >= 60
    ? `${Math.floor(realMins / 60)}小时 ${realMins % 60}分钟`
    : `${realMins}分钟`;
  
  return (
    <div className={styles.clockContainer}>
      <div className={styles.clockMain}>
        <div className={styles.clockTime}>{timeStr}</div>
        <div className={styles.clockDetails}>
          <span className={styles.clockDay}>{state.day}</span>
          <span className={styles.clockDay}>{state.season}</span>
          <span className={`${styles.clockPeriod} ${styles[`period${state.period}`]}`}>{PERIOD_LABELS[state.period] || state.period}</span>
          <span className={styles.clockCountdown}>距离下个时段还有 {countdownStr}</span>
        </div>
      </div>
      <div className={styles.clockButtonRow}>
        <Link to="/time-display/" className={styles.clockButton}>
          查看游戏内时间表
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  useDocumentHead({
    title: 'Team Synergy - PokeMMO 闪光狩猎社区',
    description: 'Team Synergy 是 PokeMMO 闪光狩猎社区。浏览 140 多位玩家的闪光收藏，用图鉴追踪进度，观看 Twitch 直播并参与竞赛。',
    canonicalPath: '/',
    robots: 'index, follow, max-image-preview:large',
  })

  return (
    <div className={styles.container}>
      <h1 className="seo-optimized">
        Team Synergy：PokeMMO 闪光狩猎社区
      </h1>
      
      <p className="seo-intro">
        PokeMMO 闪光狩猎的一站式据点：浏览 140 多位玩家的收藏，查阅详尽图鉴，观看 Twitch 直播，并参与各类竞赛。
      </p>

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <RoamingLegendaries />

      <InGameClockDisplay />

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.featuresSection}>
        <h2>欢迎来到 Team Synergy</h2>
        <img
          src={getAssetUrl('images/teamsyn.gif')}
          alt="Team Synergy 公会"
          className={styles.teamSynGif}
        />
        <p>
          Team Synergy 是一个专注于刷闪的 PokeMMO 社区。我们一起狩猎、举办有趣的活动，并分享对 PokeMMO 的热爱！
        </p>
        <p>
          借助主播、竞赛活动和不断完善的社区网站，Team Synergy 将来自世界各地的玩家聚在一起，共同享受 PokeMMO。无论你是休闲刷闪，还是追求名次的闪光猎人，这里都有你的位置！
        </p>
        <p>
          Team Synergy 是充满活力的 PokeMMO 闪光狩猎社区。加入数千名玩家，一起记录闪光收藏、参加活动、共同刷闪。
        </p>

        <div className={styles.featuresGrid}>
          <Link to="/shiny-showcase/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/reuniclus.gif" alt="人造细胞卵" />
            </div>
            <h3>闪光收藏展示</h3>
            <p>浏览 140 多位成员的闪光收藏，并查看排名</p>
          </Link>

          <Link to="/pokedex/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/pikachu.gif" alt="皮卡丘" />
            </div>
            <h3>宝可梦图鉴</h3>
            <p>查询刷闪地点、头目宝可梦与详尽的宝可梦资料</p>
          </Link>

          <Link to="/streamers/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/rotom.gif" alt="洛托姆" />
            </div>
            <h3>主播</h3>
            <p>观看 Team Synergy 成员的 Twitch 直播</p>
          </Link>

          <Link to="/resources/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/porygon.gif" alt="多边兽" />
            </div>
            <h3>资料库</h3>
            <p>查阅实用的 PokeMMO 攻略与资料</p>
          </Link>

          <Link to="/safari-zones/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/riolu.gif" alt="利欧路" />
            </div>
            <h3>狩猎地带</h3>
            <p>查看各地区狩猎地带的详细资料</p>
          </Link>

          <Link to="/roaming-legendaries/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/suicune.gif" alt="水君" />
            </div>
            <h3>游走传说宝可梦</h3>
            <p>追踪游走传说宝可梦的出现周期</p>
          </Link>
        </div>
      </section>
      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.applySection}>
        <h2>如何申请加入</h2>
        <p>
          想加入 Team Synergy 吗？我们始终欢迎投入、友善的 PokeMMO 玩家。申请方式如下：
        </p>
        <h3>申请条件</h3>
        <ul>
          <li><strong>年龄：</strong>18 岁以上</li>
          <li><strong>完成全部 5 个地区的主线</strong></li>
          <li><strong>游戏时长至少 500 小时</strong></li>
          <li><strong>至少拥有 3 只闪光宝可梦</strong></li>
        </ul>
        <h3>申请步骤</h3>
        <ol>
          <li>加入我们的 <a href="https://discord.gg/2BEUq6fWAj" target="_blank" rel="noopener noreferrer">Discord 服务器</a></li>
          <li>查看 #applications 频道，确认当前是否开放申请</li>
          <li>填写申请表</li>
          <li>管理团队会审核你的申请</li>
        </ol>
        <p>
          如果你符合以上条件，也热爱 PokeMMO，我们期待你的申请！
        </p>
      </section>

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.changelogSection}>
        <h2>更新日志</h2>
        <div className={styles.changelog}>
          <div className={styles.changelogEntry}>
            <h3>2026 年 4 月 20 日</h3>
            <ul>
              <li><strong>路线查找器</strong>－新增 PokeMMO 路线与地点详情查询工具</li>
              <li><strong>地区地图</strong>－新增互动地区地图，可浏览路线、出没点与兴趣点</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 23 日</h3>
            <ul>
              <li><strong>闪光概率页面</strong>－新增追踪当前刷闪运气走势的工具</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 17 日</h3>
            <ul>
              <li><strong>狩猎地带</strong>－新增四个地区的狩猎地带详细资料页（感谢 Mitchell）</li>
              <li>移除“关于”页面，内容并入新的首页</li>
              <li>合并相关分页，释放导航栏空间</li>
              <li><strong>资源中心</strong>－新增 PokeMMO 攻略与资料页面</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 14 日</h3>
            <ul>
              <li><strong>统计页现支持部分数据</strong>－不再要求一次拥有全部数据类型</li>
              <li>遭遇数据达到 50% 时，可查看总体统计、遭遇分析与分级分布</li>
              <li>地点数据达到 50% 时，可查看地区分布</li>
              <li>刷闪方式数据达到 50% 时，可查看刷闪方式</li>
              <li>闪光大战中的宝可梦现可点击前往对应图鉴页面</li>
              <li>“关于”页面样式与全站统一</li>
              <li><strong>图鉴筛选面板重制</strong>－优化布局，加入招式、基础信息与种族值分区</li>
              <li>头目筛选－可按头目状态筛选宝可梦</li>
              <li>蛋组选择－现可选择最多两个蛋组，并使用“任一”或“两者皆是”匹配</li>
              <li>支持仅查看头目形态</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 13 日</h3>
            <ul>
              <li><strong>新增闪光数据合并系统</strong>－提供同步 ShinyBoard API 数据的 NPM 脚本</li>
              <li>可配置字段合并：个体值、性格、地点、遭遇方式、获得日期、遭遇次数、昵称与形态</li>
              <li>通过 API 获取资料；宝可梦的名称与进化链必须一致才能正确匹配</li>
              <li>修正悬浮信息框显示，现会显示未收录的宝可梦</li>
              <li>如雌性轻飘飘、东海无壳海兔等形态现在能正确合并</li>
              <li>排行榜的训练家统计数据完整度门槛提升至 65%</li>
              <li>训练家排行榜下拉菜单新增点击空白处关闭功能</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 12 日</h3>
            <ul>
              <li>地点搜索新增稀有宝可梦分区</li>
              <li>修正精灵图渲染问题</li>
              <li>移动端布局不再重叠</li>
              <li>“特殊”形态的龙卷云、雷电云与土地云现已正常显示</li>
              <li>修正美洛耶塔与凯路迪欧的形态</li>
              <li>修正结草贵妇的显示</li>
              <li>全面改善移动端适配</li>
              <li>新增“关于”页面</li>
              <li>宝可梦页面新增努力值产出</li>
              <li>修正移动设备上宝可梦页面显示错误的问题</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 11 日</h3>
            <ul>
              <li>使用更完善的 JSON 数据重写精灵图系统</li>
              <li>新增形态与性别选择器</li>
              <li>图鉴样式现与月度闪光猎人页面统一</li>
              <li>修正宝可梦 GIF 缩放问题</li>
              <li>捕捉计算器新增先机球</li>
              <li>移动端筛选菜单现可折叠</li>
              <li>大幅优化能力值条表现</li>
              <li>宝可梦时间显示加入季节</li>
              <li>新增进化链与特性说明浮窗</li>
              <li>分支进化现已正常运作</li>
              <li>点击地点卡片即可筛选图鉴</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 10 日</h3>
            <ul>
              <li>推出宝可梦详情页面！</li>
              <li>支持按地点与遭遇方式搜索</li>
              <li>新增属性克制与能力值搜索工具</li>
              <li>全面重制图鉴，筛选功能大幅增强</li>
              <li>追踪传说宝可梦与特殊遭遇</li>
              <li>修正无性别宝可梦处理</li>
              <li>仅雌性宝可梦现可正确显示</li>
              <li>新增性别比例与排序</li>
              <li>新增化石宝可梦追踪</li>
              <li>将图鉴页面加入站点地图</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 9 日</h3>
            <ul>
              <li>奖杯页面上线</li>
              <li>新增 2025 闪光大战页面，收录 2025 OSW 的完整战果</li>
              <li>鼠标悬停时，隐藏闪光会显示发光效果</li>
              <li>新增公会主播页面</li>
              <li>全站加入嵌入式链接，导航更方便</li>
              <li>活动与成就新增自定义信息框</li>
              <li>修正发布时的崩溃问题</li>
              <li>已出售／逃跑的宝可梦现在显示在月度闪光猎人中，但不计入积分</li>
              <li>移动端实时预览恢复正常</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 8 日</h3>
            <ul>
              <li>新增活动系统</li>
              <li>改用 Puppeteer 进行预渲染</li>
              <li>整体预渲染速度更快</li>
              <li>新增活动类型设置，便于创建不同类型的活动</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>2026 年 2 月 6－7 日</h3>
            <ul>
              <li>主播页面现直接使用 Twitch 数据</li>
              <li>修正后台主播分页的问题</li>
              <li>修正计数器生成器按钮样式</li>
              <li>后台分页现可在移动端自动换行</li>
              <li>降低移动端过大的悬停缩放效果</li>
              <li>整体触控交互更流畅</li>
              <li>修正移动端信息框位置</li>
            </ul>
          </div>
        </div>
        <div className={styles.metadata}>
          <p><strong>最后更新：</strong>2026 年 4 月 20 日</p>
          <p><strong>联系方式：</strong>Discord 上的 oHypers</p>
        </div>
      </section>
    </div>
  )
}
