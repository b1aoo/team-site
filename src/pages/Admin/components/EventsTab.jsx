// EventsTab.jsx
import { useState, useEffect, useMemo } from "react";
import styles from "../Admin.module.css";
import ConfirmDialog from "./ConfirmDialog";

const COMMON_TIME_ZONES = [
  { value: "America/New_York", label: "EST / EDT－北美东部时间" },
  { value: "America/Chicago", label: "CST / CDT－北美中部时间" },
  { value: "America/Denver", label: "MST / MDT－北美山区时间" },
  { value: "America/Los_Angeles", label: "PST / PDT－北美太平洋时间" },
  { value: "Europe/London", label: "GMT / BST－英国时间" },
  { value: "UTC", label: "UTC" },
];

function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getTimeZoneShortName(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date());

    return parts.find((part) => part.type === "timeZoneName")?.value || timeZone;
  } catch {
    return timeZone;
  }
}

function getTimeZoneLabel(timeZone) {
  const shortName = getTimeZoneShortName(timeZone);
  const readableName = timeZone.replaceAll("_", " ");
  return `${shortName} - ${readableName}`;
}

function buildTimeZoneOptions(userTimeZone) {
  const allTimeZones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];

  const options = [];
  const seen = new Set();

  const addOption = (option) => {
    if (!option?.value || seen.has(option.value)) return;
    seen.add(option.value);
    options.push(option);
  };

  addOption({ value: userTimeZone, label: `${getTimeZoneLabel(userTimeZone)}（你的时区）` });
  COMMON_TIME_ZONES.forEach(addOption);
  allTimeZones.forEach((timeZone) => addOption({ value: timeZone, label: getTimeZoneLabel(timeZone) }));

  return options;
}

function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function toZonedDateTimeInput(isoString, timeZone) {
  if (!isoString) return "";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function parseDateTimeInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  const zonedTimeAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return zonedTimeAsUtc - date.getTime();
}

function zonedDateTimeInputToIso(value, timeZone) {
  const parts = parseDateTimeInput(value);
  if (!parts) return "";

  const localTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );

  let utcTime = localTimeAsUtc;
  for (let i = 0; i < 4; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcTime), timeZone);
    const nextUtcTime = localTimeAsUtc - offset;
    if (nextUtcTime === utcTime) break;
    utcTime = nextUtcTime;
  }

  return new Date(utcTime).toISOString();
}

export default function EventsTab({ eventDB, onCreate, onEdit, onDelete, isMutating }) {
  const emptyEvent = {
    published: true,
    title: "",
    imageLink: "",
    eventType: "",
    startDate: "",
    endDate: "",
    location: "",
    duration: "",
    scoring: "",
    natureBonus: [],
    validPokemon: [],
    targetPokemon: [],
    participatingStaff: [],
    firstPlaceWinners: [],
    secondPlaceWinners: [],
    thirdPlaceWinners: [],
    fourthPlaceWinners: [],
    firstPlacePrize: [],
    secondPlacePrize: [],
    thirdPlacePrize: [],
    fourthPlacePrize: [],
    hideAndSeekDescription: "",
    hideAndSeekRules: "",
    hideAndSeekRounds: [], 
  };

  const [eventData, setEventData] = useState(emptyEvent);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [localEvents, setLocalEvents] = useState([]);
  const [selectedTimeZone, setSelectedTimeZone] = useState(getUserTimeZone);
  const timeZoneOptions = useMemo(() => buildTimeZoneOptions(getUserTimeZone()), []);
  const [categorizedEvents, setCategorizedEvents] = useState({
    ongoing: [],
    upcoming: [],
    past: [],
  });

  useEffect(() => {
    const eventsWithIds = eventDB.map((e) => ({
      ...emptyEvent,
      ...e,
      id: e.id || crypto.randomUUID(),
    }));
    setLocalEvents(eventsWithIds);
    categorizeEvents(eventsWithIds);
  }, [eventDB]);

  const categorizeEvents = (events) => {
    const now = new Date();
    const ongoing = [];
    const upcoming = [];
    const past = [];

    events.forEach((e) => {
      const start = new Date(e.startDate);
      const end = e.endDate ? new Date(e.endDate) : start;

      if (start <= now && now <= end) ongoing.push(e);
      else if (start > now) upcoming.push(e);
      else past.push(e);
    });

    setCategorizedEvents({ ongoing, upcoming, past });
  };

  const handleCreateOrUpdate = async () => {
    if (!eventData.title || !eventData.startDate) return;

    const payload = {
      ...eventData,
      startDate: zonedDateTimeInputToIso(eventData.startDate, selectedTimeZone),
      endDate: eventData.endDate ? zonedDateTimeInputToIso(eventData.endDate, selectedTimeZone) : null,
    };

    let updatedEvents;
    if (editingId) {
      await onEdit(editingId, payload);
      updatedEvents = localEvents.map((e) => (e.id === editingId ? { ...e, ...payload } : e));
    } else {
      const newEvent = { ...payload, id: crypto.randomUUID() };
      await onCreate(newEvent);
      updatedEvents = [...localEvents, newEvent];
    }

    setLocalEvents(updatedEvents);
    categorizeEvents(updatedEvents);
    setEventData(emptyEvent);
    setEditingId(null);
    setSelectedTimeZone(getUserTimeZone());
  };

  const handleEdit = (event) => {
    const userTimeZone = getUserTimeZone();
    setEditingId(event.id);
    setSelectedTimeZone(userTimeZone);
    setEventData({
      ...emptyEvent,
      ...event,
      startDate: toZonedDateTimeInput(event.startDate, userTimeZone),
      endDate: toZonedDateTimeInput(event.endDate, userTimeZone),
      natureBonus: event.natureBonus || [],
      validPokemon: event.validPokemon || [],
      targetPokemon: event.targetPokemon || [],
      participatingStaff: event.participatingStaff || [],
      winners: event.winners || [],
      firstPlacePrize: event.firstPlacePrize || [],
      secondPlacePrize: event.secondPlacePrize || [],
      thirdPlacePrize: event.thirdPlacePrize || [],
      fourthPlacePrize: event.fourthPlacePrize || [],
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await onDelete(confirmDelete);
    const updatedEvents = localEvents.filter((e) => e.id !== confirmDelete);
    setLocalEvents(updatedEvents);
    categorizeEvents(updatedEvents);
    setConfirmDelete(null);
  };

  const addListItem = (field, defaultValue = "") =>
    setEventData((prev) => ({ ...prev, [field]: [...prev[field], defaultValue] }));

  const updateListItem = (field, index, value) => {
    const updated = [...eventData[field]];
    updated[index] = value;
    setEventData((prev) => ({ ...prev, [field]: updated }));
  };

  const removeListItem = (field, index) => {
    const updated = [...eventData[field]];
    updated.splice(index, 1);
    setEventData((prev) => ({ ...prev, [field]: updated }));
  };

  const addValidPokemon = () =>
    setEventData((prev) => ({ ...prev, validPokemon: [...prev.validPokemon, { pokemon: "", bonus: "" }] }));
  const updateValidPokemon = (index, key, value) => {
    const updated = [...eventData.validPokemon];
    updated[index][key] = value;
    setEventData((prev) => ({ ...prev, validPokemon: updated }));
  };
  const removeValidPokemon = (index) => {
    const updated = [...eventData.validPokemon];
    updated.splice(index, 1);
    setEventData((prev) => ({ ...prev, validPokemon: updated }));
  };

  const addTargetPokemon = () =>
    setEventData((prev) => ({ ...prev, targetPokemon: [...prev.targetPokemon, { pokemon: "", location: "", duration: "" }] }));
  const updateTargetPokemon = (index, key, value) => {
    const updated = [...eventData.targetPokemon];
    updated[index][key] = value;
    setEventData((prev) => ({ ...prev, targetPokemon: updated }));
  };
  const removeTargetPokemon = (index) => {
    const updated = [...eventData.targetPokemon];
    updated.splice(index, 1);
    setEventData((prev) => ({ ...prev, targetPokemon: updated }));
  };

  const addNatureBonus = () =>
    setEventData((prev) => ({ ...prev, natureBonus: [...prev.natureBonus, { nature: "", bonus: "" }] }));
  const updateNatureBonus = (index, key, value) => {
    const updated = [...eventData.natureBonus];
    updated[index][key] = value;
    setEventData((prev) => ({ ...prev, natureBonus: updated }));
  };
  const removeNatureBonus = (index) => {
    const updated = [...eventData.natureBonus];
    updated.splice(index, 1);
    setEventData((prev) => ({ ...prev, natureBonus: updated }));
  };

  const renderEventList = (events) => {
    if (!events.length) return <p className={styles.hintText}>暂无活动</p>;
    return (
      <table className={styles.shinyTable}>
        <thead>
          <tr>
            <th>标题</th>
            <th>活动类型</th>
            <th>开始</th>
            <th>结束</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.title}</td>
              <td>{e.eventType}</td>
              <td>{e.startDate ? new Date(e.startDate).toLocaleString('zh-CN') : "-"}</td>
              <td>{e.endDate ? new Date(e.endDate).toLocaleString('zh-CN') : "-"}</td>
              <td className={styles.actionBtns}>
                <button className={styles.editBtn} onClick={() => handleEdit(e)}>编辑</button>
                <button className={styles.deleteBtn} onClick={() => setConfirmDelete(e.id)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const addHideAndSeekRound = () =>
    setEventData(prev => ({ ...prev, hideAndSeekRounds: [...(prev.hideAndSeekRounds || []), { prize: '', host: '', winner: '' }] }));
  const updateHideAndSeekRound = (index, key, value) => {
    const updated = [...(eventData.hideAndSeekRounds || [])];
    updated[index][key] = value;
    setEventData(prev => ({ ...prev, hideAndSeekRounds: updated }));
  };
  const removeHideAndSeekRound = (index) => {
    const updated = [...(eventData.hideAndSeekRounds || [])];
    updated.splice(index, 1);
    setEventData(prev => ({ ...prev, hideAndSeekRounds: updated }));
  };

  const renderTimeZoneSelector = () => (
    <>
      <label>时区：</label>
      <select
        className={styles.adminInput}
        value={selectedTimeZone}
        onChange={(e) => setSelectedTimeZone(e.target.value)}
      >
        {timeZoneOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className={styles.hintText}>
        请先选择时区，再按该时区填写活动时间；系统会自动换算并以 UTC 保存。
      </p>
    </>
  );

  return (
    <div>
      <h3>{editingId ? "编辑活动" : "创建活动"}</h3>

      <div className={styles.editSection}>
        {/* Event Type */}
        <label>活动类型：</label>
        <select
          className={styles.adminInput}
          value={eventData.eventType || ""}
          onChange={(e) => setEventData({ ...eventData, eventType: e.target.value })}
        >
          <option value="" disabled hidden>选择活动类型</option>
          <option value="catchevent">捕捉活动</option>
          <option value="metronome">挥指</option>
          <option value="grouphunt">团体狩猎</option>

          <option value="hideandseek">捉迷藏</option>
        </select>


        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <input
            type="checkbox"
            checked={!!eventData.published}
            onChange={e => setEventData({ ...eventData, published: e.target.checked })}
            style={{ marginRight: '8px' }}
          />
          已发布
        </label>

        <label>名称：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={eventData.title || ""}
          onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
        />

        <label>图片链接：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={eventData.imageLink || ""}
          onChange={(e) => setEventData({ ...eventData, imageLink: e.target.value })}
        />


      <label>地点：</label>
      <input
        type="text"
        className={styles.adminInput}
        value={eventData.location || ""}
        onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
      />

        <label>时长：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={eventData.duration || ""}
          onChange={(e) => setEventData({ ...eventData, duration: e.target.value })}
        />

        {eventData.eventType === "hideandseek" && (
          <>
            <label>说明：</label>
            <textarea
              className={styles.adminInput}
              value={eventData.hideAndSeekDescription || ""}
              onChange={e => setEventData({ ...eventData, hideAndSeekDescription: e.target.value })}
            />

            <label>日期与时间：</label>
            {renderTimeZoneSelector()}
            <input
              type="datetime-local"
              className={styles.adminInput}
              value={eventData.startDate}
              onChange={e => setEventData({ ...eventData, startDate: e.target.value })}
              onFocus={e => e.target.showPicker?.()}
            />

            <label>参与工作人员：</label>
            {eventData.participatingStaff.map((s, i) => (
              <div key={i} className={styles.inputRow}>
                <input
                  placeholder="工作人员名称"
                  className={styles.adminInput}
                  value={s || ""}
                  onChange={e => updateListItem("participatingStaff", i, e.target.value)}
                />
                <button className={styles.deleteBtn} onClick={() => removeListItem("participatingStaff", i)}>移除</button>
              </div>
            ))}
            <button className={styles.editBtn} onClick={() => addListItem("participatingStaff")}>添加工作人员</button>

            <label>回合：</label>
            {(eventData.hideAndSeekRounds || []).map((round, i) => (
              <div key={i} className={styles.inputRow}>
                <input
                  placeholder="奖品"
                  className={styles.adminInput}
                  value={round.prize || ""}
                  onChange={e => updateHideAndSeekRound(i, "prize", e.target.value)}
                />
                <input
                  placeholder="奖品图片（URL）"
                  className={styles.adminInput}
                  value={round.prizeImage || ""}
                  onChange={e => updateHideAndSeekRound(i, "prizeImage", e.target.value)}
                />
                <input
                  placeholder="主持人"
                  className={styles.adminInput}
                  value={round.host || ""}
                  onChange={e => updateHideAndSeekRound(i, "host", e.target.value)}
                />
                <input
                  placeholder="获胜者"
                  className={styles.adminInput}
                  value={round.winner || ""}
                  onChange={e => updateHideAndSeekRound(i, "winner", e.target.value)}
                />
                <button className={styles.deleteBtn} onClick={() => removeHideAndSeekRound(i)}>移除</button>
              </div>
            ))}
            <button className={styles.editBtn} onClick={addHideAndSeekRound}>添加回合</button>

            <label>规则：</label>
            <textarea
              className={styles.adminInput}
              value={eventData.hideAndSeekRules || ""}
              onChange={e => setEventData({ ...eventData, hideAndSeekRules: e.target.value })}
            />
          </>
        )}
        {eventData.eventType === "catchevent" && (
          <>
            <label>计分规则：</label>
            <input
              type="text"
              className={styles.adminInput}
              value={eventData.scoring || ""}
              onChange={(e) => setEventData({ ...eventData, scoring: e.target.value })}
            />
          </>
        )}

        {eventData.eventType !== "hideandseek" && (
          <>
            {renderTimeZoneSelector()}

            <label>开始日期与时间：</label>
            <input
              type="datetime-local"
              className={styles.adminInput}
              value={eventData.startDate}
              onChange={(e) => setEventData({ ...eventData, startDate: e.target.value })}
              onFocus={(e) => e.target.showPicker?.()}
            />

            <label>结束日期与时间：</label>
            <input
              type="datetime-local"
              className={styles.adminInput}
              value={eventData.endDate}
              onChange={(e) => setEventData({ ...eventData, endDate: e.target.value })}
              onFocus={(e) => e.target.showPicker?.()}
            />
          </>
        )}

        {eventData.eventType === "catchevent" && (
          <>
            <label>性格加分：</label>
            {eventData.natureBonus.map((n, i) => (
              <div key={i} className={styles.inputRow}>
                <input
                  placeholder="性格"
                  className={styles.adminInput}
                  value={n.nature || ""}
                  onChange={(e) => updateNatureBonus(i, "nature", e.target.value)}
                />
                <input
                  placeholder="加分"
                  className={styles.adminInput}
                  value={n.bonus || ""}
                  onChange={(e) => updateNatureBonus(i, "bonus", e.target.value)}
                />
                <button className={styles.deleteBtn} onClick={() => removeNatureBonus(i)}>移除</button>
              </div>
            ))}
            <button className={styles.editBtn} onClick={addNatureBonus}>添加性格</button>

            <label>可用宝可梦：</label>
            {eventData.validPokemon.map((p, i) => (
              <div key={i} className={styles.inputRow}>
                <input
                  placeholder="宝可梦"
                  className={styles.adminInput}
                  value={p.pokemon || ""}
                  onChange={(e) => updateValidPokemon(i, "pokemon", e.target.value)}
                />
                <input
                  placeholder="加分"
                  className={styles.adminInput}
                  value={p.bonus || ""}
                  onChange={(e) => updateValidPokemon(i, "bonus", e.target.value)}
                />
                <button className={styles.deleteBtn} onClick={() => removeValidPokemon(i)}>移除</button>
              </div>
            ))}
            <button className={styles.editBtn} onClick={addValidPokemon}>添加宝可梦</button>
          </>
        )}

        {eventData.eventType === "grouphunt" && (
          <>
            <label>目标宝可梦：</label>
            {eventData.targetPokemon.map((t, i) => (
              <div key={i} className={styles.inputRow}>
                <input
                  placeholder="宝可梦"
                  className={styles.adminInput}
                  value={t.pokemon || ""}
                  onChange={(e) => updateTargetPokemon(i, "pokemon", e.target.value)}
                />
                <input
                  placeholder="地点"
                  className={styles.adminInput}
                  value={t.location || ""}
                  onChange={(e) => updateTargetPokemon(i, "location", e.target.value)}
                />
                <input
                  placeholder="时长"
                  className={styles.adminInput}
                  value={t.duration || ""}
                  onChange={(e) => updateTargetPokemon(i, "duration", e.target.value)}
                />
                <button className={styles.deleteBtn} onClick={() => removeTargetPokemon(i)}>移除</button>
              </div>
            ))}
            <button className={styles.editBtn} onClick={addTargetPokemon}>添加目标宝可梦</button>
          </>
        )}

        {eventData.eventType !== "hideandseek" && (
          <>
            <label>参与工作人员：</label>
            {eventData.participatingStaff.map((s, i) => (
              <div key={i} className={styles.inputRow}>
                <input
                  placeholder="工作人员名称"
                  className={styles.adminInput}
                  value={s || ""}
                  onChange={(e) => updateListItem("participatingStaff", i, e.target.value)}
                />
                <button className={styles.deleteBtn} onClick={() => removeListItem("participatingStaff", i)}>移除</button>
              </div>
            ))}
            <button className={styles.editBtn} onClick={() => addListItem("participatingStaff")}>添加工作人员</button>

            {["firstPlaceWinners", "secondPlaceWinners", "thirdPlaceWinners", "fourthPlaceWinners"].map((field, idx) => (
              <div key={field}>
                <label>{["第一名", "第二名", "第三名", "第四名"][idx]}获胜者：</label>
                {eventData[field].map((w, i) => (
                  <div key={i} className={styles.inputRow}>
                    <input
                      placeholder="获胜者名称"
                      className={styles.adminInput}
                      value={w || ""}
                      onChange={(e) => updateListItem(field, i, e.target.value)}
                    />
                    <button className={styles.deleteBtn} onClick={() => removeListItem(field, i)}>移除</button>
                  </div>
                ))}
                <button className={styles.editBtn} onClick={() => addListItem(field)}>添加获胜者</button>
              </div>
            ))}

            {["firstPlacePrize", "secondPlacePrize", "thirdPlacePrize", "fourthPlacePrize"].map((field, idx) => (
              <div key={field}>
                <label>{["第一名", "第二名", "第三名", "第四名"][idx]}奖品：</label>
                {eventData[field].map((p, i) => (
                  <div key={i} className={styles.inputRow}>
                    <input
                      placeholder="奖品"
                      className={styles.adminInput}
                      value={p || ""}
                      onChange={(e) => updateListItem(field, i, e.target.value)}
                    />
                    <button className={styles.deleteBtn} onClick={() => removeListItem(field, i)}>移除</button>
                  </div>
                ))}
                <button className={styles.editBtn} onClick={() => addListItem(field)}>添加奖品</button>
              </div>
            ))}
          </>
        )}

        <button
          className={styles.editBtn}
          onClick={handleCreateOrUpdate}
          disabled={isMutating || !eventData.title || !eventData.startDate}
        >
          {isMutating ? "保存中…" : editingId ? "保存修改" : "创建活动"}
        </button>
      </div>

      {/* Event Lists */}
      <h3>进行中的活动</h3>
      {renderEventList(categorizedEvents.ongoing)}
      <h3>即将开始的活动</h3>
      {renderEventList(categorizedEvents.upcoming)}
      <h3>已结束的活动</h3>
      {renderEventList(categorizedEvents.past)}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="删除活动"
          message="确定要删除这个活动吗？"
          confirmLabel="删除"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
