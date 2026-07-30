import { useDocumentHead } from '../../hooks/useDocumentHead';
import React, { useState, useMemo } from 'react';
import styles from './ShinyOdds.module.css'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';



export default function ShinyOdds() {
  useDocumentHead({
    title: '闪光概率计算器',
    description: '结合加成、当前进度与概率曲线，计算你的闪光遭遇概率。',
    canonicalPath: '/shiny-odds',
    breadcrumbs: [
      { name: '首页', url: '/' },
      { name: '工具', url: '/tools' },
      { name: '闪光概率', url: '/shiny-odds' }
    ]
  });

  return (
    <div className={styles.shinyOddsPage}>
      <h1>闪光概率计算器</h1>

      <p className={styles.copingCenter}>
        <strong>不是我在嘴硬，是概率在说话！</strong>
      </p>

      <ShinyProbabilityCalculator />
    </div>
  );
}


function ShinyProbabilityCalculator() {
  const BASE_DENOMINATOR = 30000;
  const POPULATION = 1000000;

  const [donator, setDonator] = useState(false);
  const [charm, setCharm] = useState(false);
  const [customBoost, setCustomBoost] = useState('');

  const [encounters, setEncounters] = useState(1000);
  const [currentEncountersInput, setCurrentEncountersInput] = useState('0');
  const sanitizedCurrentEncounters = Math.max(0, parseInt(currentEncountersInput, 10) || 0);

  const {
    effectiveDenominator,
    probability,
    percentile,
    expected50,
    expected90,
    expected99,
    chartData,
    maxX
  } = useMemo(() => {
    let totalBoost = 0;
    if (donator) totalBoost += 10;
    if (charm) totalBoost += 10;
    totalBoost += parseFloat(customBoost) || 0;

    const boostPercent = Math.min(totalBoost, 99.9);
    const effectiveDenominator = BASE_DENOMINATOR * (1 - boostPercent / 100);
    const effectiveRate = 1 / effectiveDenominator;

    const probability = 1 - Math.pow(1 - effectiveRate, encounters);
    const currentProbability = 1 - Math.pow(1 - effectiveRate, sanitizedCurrentEncounters);
    const percentile = currentProbability * POPULATION;

    const expected50 = Math.log(0.5) / Math.log(1 - effectiveRate);
    const expected90 = Math.log(0.1) / Math.log(1 - effectiveRate);
    const expected99 = Math.log(0.01) / Math.log(1 - effectiveRate);

    const baseMaxX = Math.ceil(expected99 * 1.2);
    const maxX = Math.max(baseMaxX, sanitizedCurrentEncounters * 1.1);

    const step = Math.max(50, Math.floor(maxX / 200));
    const chartData = [];
    for (let i = 0; i <= maxX; i += step) {
      chartData.push({ encounters: i, people: POPULATION * (1 - Math.pow(1 - effectiveRate, i)) });
    }

    return { effectiveDenominator, probability, percentile, expected50, expected90, expected99, chartData, maxX };
  }, [donator, charm, customBoost, encounters, sanitizedCurrentEncounters]);

  return (
    <div style={{ marginTop: '2em' }}>
      <h2>概率加成</h2>
      <label>
        <input type="checkbox" checked={donator} onChange={() => setDonator(!donator)} className={styles.shinyInput} />
        捐赠者状态（+10%）
      </label>
      <br />
      <label>
        <input type="checkbox" checked={charm} onChange={() => setCharm(!charm)} className={styles.shinyInput} />
        闪耀护符（+10%）
      </label>
      <br />
      <label>
        自定义加成（%）：{' '}
        <input
          type="number"
          value={customBoost}
          onChange={e => setCustomBoost(e.target.value)}
          className={styles.shinyInput}
          style={{ width: 80 }}
        />
      </label>

      <hr />

      <h2>遭遇次数</h2>
      <label>
        当前遭遇次数：{' '}
        <input
          type="number"
          value={currentEncountersInput}
          onChange={e => setCurrentEncountersInput(e.target.value)}
          className={styles.shinyInput}
        />
      </label>

      <hr />

      <h2>计算结果</h2>
      <p><strong>实际闪光概率：</strong>1 / {Math.round(effectiveDenominator).toLocaleString()}</p>
      <p><strong>每 100 万名玩家中：</strong>约有 {Math.round(percentile).toLocaleString()} 人已出闪</p>
      <p><strong>达到 50% 概率：</strong>{Math.round(expected50).toLocaleString()} 次遭遇</p>
      <p><strong>达到 90% 概率：</strong>{Math.round(expected90).toLocaleString()} 次遭遇</p>
      <p><strong>达到 99% 概率：</strong>{Math.round(expected99).toLocaleString()} 次遭遇</p>

      <hr />

      {/* Chart */}
      <h2>闪光概率分布（以 100 万人为样本）</h2>
      <div style={{ width: "100%", maxWidth: 900, height: 400, margin: "0 auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
            <XAxis dataKey="encounters" type="number" domain={[0, maxX]} />
            <YAxis domain={[0, POPULATION]} tickFormatter={v => Math.round(v).toLocaleString()} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                // Only consider the line's 'people' dataKey
                const lineEntry = payload.find(p => p.dataKey === "people");
                if (!lineEntry) return null;
                const d = lineEntry.payload;
                return (
                  <div className={styles.customTooltip}>
                    <div>
                      <strong>遭遇次数：</strong> {d.encounters.toLocaleString()}
                    </div>
                    <div>
                      <strong>已出闪玩家数：</strong>{" "}
                      {Math.round(d.people).toLocaleString()}
                    </div>
                  </div>
                );
              }}
              shared={false}
            />
            <Line
              type="monotone"
              dataKey="people"
              stroke="#4f46e5"
              strokeWidth={3}
              dot={(props) => {
                // Only render a custom dot for the user's current encounters
                const { cx, cy, payload } = props;
                if (payload.encounters === sanitizedCurrentEncounters && sanitizedCurrentEncounters > 0) {
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill="#e11d48"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                }
                return null;
              }}
            />
            {sanitizedCurrentEncounters > 0 && (
              <ReferenceLine
                x={sanitizedCurrentEncounters}
                stroke="#e11d48"
                strokeDasharray="4 2"
                label={{ value: "你的位置", position: "top", fill: "#e11d48", fontWeight: "bold" }}
              />
            )}
            <ReferenceLine x={expected50} stroke="green" label="50%" />
            <ReferenceLine x={expected90} stroke="orange" label="90%" />
            <ReferenceLine x={expected99} stroke="red" label="99%" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="indexLegend" style={{ marginTop: "1.5em" }}>
        <h3>图例</h3>
        <ul>
          <li><span className="indicator line-main"></span> <strong>紫色</strong> — 闪光概率分布（主曲线）</li>
          <li><span className="indicator line-50"></span> <strong>绿色</strong> — 50% 概率（竖线）</li>
          <li><span className="indicator line-90"></span> <strong>橙色</strong> — 90% 概率（竖线）</li>
          <li><span className="indicator line-99"></span> <strong>红色</strong> — 99% 概率（竖线）</li>
          <li><span className="indicator line-user"></span> <strong>粉色虚线</strong> — 你当前的遭遇次数</li>
        </ul>
      </div>
    </div>
  );
}
