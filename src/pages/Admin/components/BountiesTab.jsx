import { useEffect, useMemo, useState } from "react";
import styles from "../Admin.module.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toCategoryLabel(value) {
  if (!value) return "";
  const cleaned = String(value).trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return "";
  if (cleaned === "perm") return "Perm";
  const monthMatch = MONTH_NAMES.find((m) => m.toLowerCase() === cleaned);
  if (monthMatch) return monthMatch;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getIdPrefix(id) {
  if (!id) return "";
  const match = String(id).trim().match(/^([a-z]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function getCategoryFromBounty(bounty) {
  const idPrefix = getIdPrefix(bounty?.id);
  if (idPrefix) {
    const fromId = toCategoryLabel(idPrefix);
    if (fromId) return fromId;
  }
  if (bounty?.perm) return "Perm";
  return toCategoryLabel(bounty?.month) || "Uncategorized";
}

function sortCategoryNames(categories) {
  const unique = Array.from(new Set(categories.filter(Boolean)));
  return unique.sort((a, b) => {
    if (a === "Perm") return 1;
    if (b === "Perm") return -1;
    const aIdx = MONTH_NAMES.indexOf(a);
    const bIdx = MONTH_NAMES.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
}

function parsePokemonInput(value) {
  if (value == null) return [];
  const text = String(value).trim();
  if (!text) return [];
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function formatPokemonList(value) {
  if (!value && value !== 0) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value).trim();
}

export default function BountiesTab({ bounties, onAdd, onEdit, onDelete, isMutating }) {
  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const [editingBounty, setEditingBounty] = useState(null);
  const [form, setForm] = useState({
    title: "",
    month: currentMonth,
    pokemon: "",
    host: "",
    reward: "",
    description: "",
    perm: false,
    claimed: "",
  });
  const [bountyFilter, setBountyFilter] = useState(currentMonth);

  const categoryOrder = useMemo(() => {
    const fromKeys = Object.keys(bounties || {});
    const fromBounties = Object.values(bounties || {})
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .map(getCategoryFromBounty);
    return sortCategoryNames([...fromKeys, ...fromBounties]);
  }, [bounties]);

  const monthCategories = useMemo(
    () => categoryOrder.filter((category) => category !== "Perm"),
    [categoryOrder]
  );

  const hasPermCategory = useMemo(
    () => categoryOrder.includes("Perm"),
    [categoryOrder]
  );

  const filterOptions = useMemo(() => {
    const options = [...monthCategories];
    if (hasPermCategory) options.push("Perm");
    options.push("Claimed");
    return options;
  }, [monthCategories, hasPermCategory]);

  useEffect(() => {
    if (!filterOptions.includes(bountyFilter)) {
      setBountyFilter(monthCategories[0] || (hasPermCategory ? "Perm" : "Claimed"));
    }
  }, [bountyFilter, filterOptions, hasPermCategory, monthCategories]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      if (name === "perm") {
        return {
          ...prev,
          perm: checked,
          month: checked ? "" : prev.month || currentMonth,
        };
      }
      return { ...prev, [name]: type === "checkbox" ? checked : value };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const bountyData = { ...form };
    const normalizedMonth = toCategoryLabel(bountyData.month) || currentMonth;

    const pokemonList = parsePokemonInput(bountyData.pokemon);
    bountyData.pokemon = pokemonList.length === 1 ? pokemonList[0] : pokemonList;

    if (bountyData.perm) {
      bountyData.month = "";
      bountyData.perm = true;
    } else {
      bountyData.month = normalizedMonth;
      bountyData.perm = false;
    }

    if (!bountyData.claimed) delete bountyData.claimed;

    if (editingBounty?.id) bountyData.id = editingBounty.id;

    if (!bountyData.id) {
      const prefix = bountyData.perm ? "perm" : (toCategoryLabel(bountyData.month) || "month").toLowerCase();
      const usedNums = Object.values(bounties || {})
        .flatMap((list) => (Array.isArray(list) ? list : []))
        .filter((b) => String(b.id || "").toLowerCase().startsWith(prefix))
        .map((b) => {
          const match = String(b.id).match(new RegExp(`^${prefix}(\\d+)$`, "i"));
          return match ? Number(match[1]) : 0;
        })
        .filter((n) => !Number.isNaN(n) && n > 0);

      const idNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : 1;
      bountyData.id = `${prefix}${idNum}`;
    }

    if (editingBounty) {
      onEdit(bountyData);
    } else {
      onAdd(bountyData);
    }

    setForm({
      title: "",
      month: currentMonth,
      pokemon: "",
      host: "",
      reward: "",
      description: "",
      perm: false,
      claimed: "",
    });
    setEditingBounty(null);
  }

  function handleEdit(bounty) {
    const category = getCategoryFromBounty(bounty);
    setEditingBounty(bounty);
    setForm({
      title: bounty.title || "",
      month: category === "Perm" ? "" : (toCategoryLabel(bounty.month) || category),
      pokemon: formatPokemonList(bounty.pokemon),
      host: bounty.host || "",
      reward: bounty.reward || "",
      description: bounty.description || "",
      perm: category === "Perm",
      claimed: bounty.claimed || "",
    });
  }

  async function handleDelete(bountyId) {
    if (window.confirm("确定要删除此悬赏吗？")) {
      try {
        await onDelete(bountyId);
      } catch (err) {
      }
    }
  }

  function handleCancel() {
    setEditingBounty(null);
    setForm({
      title: "",
      month: currentMonth,
      pokemon: "",
      host: "",
      reward: "",
      description: "",
      perm: false,
      claimed: "",
    });
  }

  const filteredBounties = Object.fromEntries(
    Object.entries(bounties || {}).map(([category, list]) => [
      category,
      (Array.isArray(list) ? list : []).filter((b) => !b.claimed),
    ])
  );

  const claimedBounties = Object.fromEntries(
    Object.entries(bounties || {}).map(([category, list]) => [
      category,
      (Array.isArray(list) ? list : []).filter((b) => b.claimed),
    ])
  );

  function renderTable(category, showClaimed = false) {
    const list = (showClaimed ? claimedBounties[category] : filteredBounties[category]) || [];
    const isPerm = category === "Perm";

    if (!list.length) {
      return (
        <tr>
          <td
            colSpan={showClaimed ? (isPerm ? 9 : 10) : (isPerm ? 8 : 9)}
            className={styles.hintText}
          >
            {showClaimed ? `暂无已领取的${category === 'Perm' ? '永久' : category}悬赏。` : `暂无未领取的${category === 'Perm' ? '永久' : category}悬赏。`}
          </td>
        </tr>
      );
    }

    const truncate = (str, n = 40) => (str && str.length > n ? `${str.slice(0, n)}...` : str);

    return list.map((b) => (
      <tr key={b.id}>
        <td>{b.id}</td>
        <td>{b.title}</td>
        {!isPerm && <td>{toCategoryLabel(b.month) || category}</td>}
        <td title={formatPokemonList(b.pokemon)}>{formatPokemonList(b.pokemon)}</td>
        <td>{b.host}</td>
        <td>{b.reward}</td>
        <td title={b.description}>{truncate(b.description)}</td>
        <td>{(b.perm || isPerm) ? "\u2714\ufe0f" : ""}</td>
        {showClaimed && <td>{b.claimed}</td>}
        <td className={styles.actionBtns}>
          <button className={styles.editBtn} onClick={() => handleEdit(b)}>编辑</button>
          <button className={styles.deleteBtn} onClick={() => handleDelete(b.id)}>删除</button>
        </td>
      </tr>
    ));
  }

  return (
    <div>
      <h3>{editingBounty ? '编辑悬赏' : '添加悬赏'}</h3>
      <form className={styles.editSection} onSubmit={handleSubmit}>
        <label>标题：</label>
        <input name="title" value={form.title} onChange={handleChange} className={styles.adminInput} required />
        <label>月份（永久悬赏请留空）：</label>
        <input name="month" value={form.month} onChange={handleChange} className={styles.adminInput} disabled={form.perm} />
        <label>宝可梦（多只请用逗号分隔）：</label>
        <input
          name="pokemon"
          value={form.pokemon}
          onChange={handleChange}
          className={styles.adminInput}
          placeholder="如：皮卡丘，雷丘"
          required
        />
        <label>主办人：</label>
        <input name="host" value={form.host} onChange={handleChange} className={styles.adminInput} required />
        <label>奖励：</label>
        <input name="reward" value={form.reward} onChange={handleChange} className={styles.adminInput} required />
        <label>说明：</label>
        <textarea name="description" value={form.description} onChange={handleChange} className={styles.adminInput} rows={2} />
        <label>
          <input type="checkbox" name="perm" checked={form.perm} onChange={handleChange} /> 永久悬赏
        </label>
        <label>
          领取人：
          <input name="claimed" value={form.claimed} onChange={handleChange} className={styles.adminInput} placeholder="（未领取请留空）" />
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className={styles.editBtn} type="submit" disabled={isMutating}>
            {isMutating ? '保存中…' : editingBounty ? '保存修改' : '添加悬赏'}
          </button>
          {editingBounty && (
            <button className={styles.deleteBtn} type="button" onClick={handleCancel}>取消</button>
          )}
        </div>
      </form>

      <h3>悬赏列表</h3>

      <div style={{ margin: "16px 0" }}>
        <label htmlFor="bountyFilter" style={{ fontWeight: 600, marginRight: 8 }}>显示：</label>
        <select
          id="bountyFilter"
          value={bountyFilter}
          onChange={(e) => setBountyFilter(e.target.value)}
          className={styles.adminInput}
          style={{ width: 140 }}
        >
          {monthCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
          {hasPermCategory && <option value="Perm">永久</option>}
          <option value="Claimed">已领取</option>
        </select>
      </div>

      {bountyFilter !== "Claimed" && (
        <>
          <h4>{bountyFilter === 'Perm' ? '永久悬赏' : `${bountyFilter} 悬赏`}</h4>
          <div className={styles.tableWrapper}>
            <table className={styles.shinyTable}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  {bountyFilter !== 'Perm' && <th>月份</th>}
                  <th>宝可梦</th>
                  <th>主办人</th>
                  <th>奖励</th>
                  <th>说明</th>
                  <th>永久</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>{renderTable(bountyFilter)}</tbody>
            </table>
          </div>
        </>
      )}

      {bountyFilter === "Claimed" && (() => {
        const claimedCategories = categoryOrder.filter(
          (category) => (claimedBounties[category] || []).length > 0
        );

        if (!claimedCategories.length) {
          return <div className={styles.hintText} style={{ margin: '16px 0' }}>没有已领取的悬赏。</div>;
        }

        return (
          <>
            <h4>已领取悬赏</h4>
            {claimedCategories.map((category) => (
              <div key={category}>
                <h4 style={{ marginBottom: 8 }}>{category === "Perm" ? "永久悬赏" : category}</h4>
                <div className={styles.tableWrapper}>
                  <table className={styles.shinyTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>标题</th>
                        {category !== "Perm" && <th>月份</th>}
                        <th>宝可梦</th>
                        <th>主办人</th>
                        <th>奖励</th>
                        <th>说明</th>
                        <th>永久</th>
                        <th>领取人</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>{renderTable(category, true)}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        );
      })()}
    </div>
  );
}
