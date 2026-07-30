import { useReducer, useEffect, useMemo } from 'react'
import Autocomplete from './Autocomplete'
import pokemonData from '../../../data/pokemmo_data/pokemon-data.json'
import { translateLocationName } from '../../../utils/pokemonTermsZh'
import { translatePokemonName } from '../../../utils/pokemon'




const MONTHS = [ 'January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_ZH = { January: '一月', February: '二月', March: '三月', April: '四月', May: '五月', June: '六月', July: '七月', August: '八月', September: '九月', October: '十月', November: '十一月', December: '十二月' }
const YEARS = ['2025','2026','2027','2028','2029','2030']
const ENCOUNTER_TYPES = [
  { value: '5x horde', label: '5只群聚' },
  { value: '3x horde', label: '3只群聚' },
  { value: 'single', label: '单只遭遇' },
  { value: 'fishing', label: '垂钓' },
  { value: 'honey tree', label: '甜甜蜜树' },
  { value: 'egg', label: '孵化' },
  { value: 'safari', label: '狩猎地带' },
  { value: 'fossil', label: '化石' },
  { value: 'swarm', label: '群聚' },
  { value: 'gift', label: '赠送' },
]
const NATURES = [ 'Adamant','Bashful','Bold','Brave','Calm','Careful','Docile','Gentle','Hardy','Hasty','Impish','Jolly','Lax','Lonely','Mild','Modest','Naive','Naughty','Quiet','Quirky','Rash','Relaxed','Sassy','Serious','Timid']
const NATURE_NAMES_ZH = {
  Adamant: '固执', Bashful: '害羞', Bold: '大胆', Brave: '勇敢', Calm: '沉着', Careful: '慎重', Docile: '坦率', Gentle: '温和', Hardy: '勤奋', Hasty: '急躁', Impish: '淘气', Jolly: '爽朗', Lax: '乐天', Lonely: '孤独', Mild: '慢吞吞', Modest: '内敛', Naive: '天真', Naughty: '顽皮', Quiet: '冷静', Quirky: '浮躁', Rash: '马虎', Relaxed: '悠闲', Sassy: '自大', Serious: '认真', Timid: '胆小',
}
const YES_NO_FIELDS = [
  { key: 'Egg', label: '孵化' },
  { key: 'Favourite', label: '收藏' },
  { key: 'Secret Shiny', label: '秘密闪光' },
  { key: 'Alpha', label: '头目' },
  { key: 'Sold', label: '已售出' },
  { key: 'Event', label: '活动' },
  { key: 'Reaction', label: '反应' },
  { key: 'MysteriousBall', label: '神秘球' },
  { key: 'Safari', label: '狩猎地带' },
  { key: 'Honey Tree', label: '甜甜蜜树' },
  { key: 'Fossil', label: '化石' },
  { key : 'Swarm', label: '群聚' },
  { key: 'Fishing', label: '垂钓' },
  { key: 'Headbutt', label: '头锤树' },
  { key: 'Legendary', label: '传说宝可梦' },
]

const POKEMON_KEY_MAP = {}
Object.keys(pokemonData).forEach(key => {
  POKEMON_KEY_MAP[key] = key
  POKEMON_KEY_MAP[key.replace(/-/g, ' ')] = key
  POKEMON_KEY_MAP[key.replace(/-/g, '')] = key
})
function lookupEncounters(name) {
  if (!name) return []
  const n = name.toLowerCase().trim()
  const key = POKEMON_KEY_MAP[n] || POKEMON_KEY_MAP[n.replace(/\s+/g,'-')] || POKEMON_KEY_MAP[n.replace(/[^a-z0-9]/g,'')]
  return key ? (pokemonData[key]?.location_area_encounters || []) : []
}

// Default state
function getDefaultState() {
  return {
    Pokemon: '',
    Month: '',
    Year: '',
    encounter_method: '',
    location: '',
    encounter_count: '',
    date_caught: null,
    nature: '',
    ivs: '',
    nickname: '',
    variant: '',
    Egg: 'No',
    Favourite: 'No',
    'Secret Shiny': 'No',
    Alpha: 'No',
    Sold: 'No',
    Event: 'No',
    Reaction: 'No',
    MysteriousBall: 'No',
    Safari: 'No',
    'Honey Tree': 'No',
    Fossil: 'No',
    Fishing: 'No',
    Swarm: 'No',
    Headbutt: 'No',
    Legendary: 'No',
    'Reaction Link': '',
  }
}

function reducer(state, action) {
  switch(action.type){
    case 'SET_FIELD': return { ...state, [action.field]: action.value }
    case 'RESET': return getDefaultState()
    case 'LOAD':
      const normalizedDate = action.data?.date_caught ? action.data.date_caught.split('T')[0] : null
      return {
        ...getDefaultState(),
        ...action.data,
        encounter_method: action.data?.encounter_method ?? normalizeLegacyEncounterMethod(action.data?.['Encounter Type']) ?? '',
        location: action.data?.location ?? action.data?.Location ?? '',
        encounter_count: action.data?.encounter_count ?? action.data?.['Encounter Count'] ?? '',
        date_caught: normalizedDate
      }
    default: return state
  }
}

function normalizeLegacyEncounterMethod(method) {
  if (!method) return ''
  const normalized = String(method).trim().toLowerCase()
  const values = new Set(ENCOUNTER_TYPES.map(type => type.value))
  return values.has(normalized) ? normalized : ''
}

export default function ShinyForm({ initialData, onSubmit, submitLabel='Add', allPokemonNames=[], isMutating=false }) {
  const [form, dispatch] = useReducer(reducer, initialData || getDefaultState())

  useEffect(() => { if(initialData) dispatch({ type:'LOAD', data:initialData }) }, [initialData])

  useEffect(() => {
    const listener = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [form])

  const encounters = useMemo(() => lookupEncounters(form.Pokemon), [form.Pokemon])
  const locationOptions = useMemo(() => {
    const seen = new Set()
    encounters.forEach(e => { if(e.location && e.region_name) seen.add(`${e.location} (${e.region_name})`) })
    return Array.from(seen).sort()
  }, [encounters])

  const handlePokemonChange = val => {
    dispatch({ type:'SET_FIELD', field:'Pokemon', value:val })
    dispatch({ type:'SET_FIELD', field:'location', value:'' })
  }
  const handleLocationChange = val => dispatch({ type:'SET_FIELD', field:'location', value:val })
  const handleDateCaughtChange = val => {
    dispatch({ type:'SET_FIELD', field:'date_caught', value:val })
    if(val){
      const [year, month] = val.split('-')
      dispatch({ type:'SET_FIELD', field:'Month', value:MONTHS[parseInt(month,10)-1] })
      dispatch({ type:'SET_FIELD', field:'Year', value:year })
    } else {
      dispatch({ type:'SET_FIELD', field:'Month', value:'' })
      dispatch({ type:'SET_FIELD', field:'Year', value:'' })
    }
  }


  const handleSubmit = (e) => {
    if(e) e.preventDefault()
    if(!form.Pokemon.trim()) return
    const cleaned = {
      ...form,
      Month: form.Month || null,
      Year: form.Year || null,
      date_caught: form.date_caught || null,
      encounter_count: form.encounter_count === '' ? null : Number(form.encounter_count),
    }
    delete cleaned.Location
    delete cleaned['Encounter Type']
    delete cleaned['Encounter Count']
    onSubmit(cleaned)
  }

  const handleKeyDown = (e) => {
    if(e.key === 'Enter') {
      const tag = e.target.tagName.toLowerCase()
      console.log('KeyDown:', { key: e.key, tag, classList: e.target.classList })
      if(tag !== 'textarea' && !e.target.classList.contains('autocomplete-input')) {
        e.preventDefault()
        handleSubmit()
      }
    }
  }



  const handleReset = () => dispatch({ type:'RESET' })

  const formatIVs = raw => raw

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <label>宝可梦名称：</label>
      <Autocomplete
        id="shinyFormPokemon"
        value={form.Pokemon}
        className="autocomplete-input"
        onChange={handlePokemonChange}
        getOptions={() => allPokemonNames.map((name) => ({ value: name, label: translatePokemonName(name) }))}
        placeholder="梦幻"
      />

      <label>遭遇方式：</label>
      <select value={form.encounter_method} onChange={e=>dispatch({ type:'SET_FIELD', field:'encounter_method', value:e.target.value })}>
        <option value="">选择遭遇方式</option>
        {ENCOUNTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <label>地点：</label>
      {locationOptions.length > 0 ? (
        <select value={form.location} onChange={e=>handleLocationChange(e.target.value)}>
          <option value="">选择地点</option>
          {locationOptions.map(loc => <option key={loc} value={loc}>{translateLocationName(loc)}</option>)}
        </select>
      ) : (
        <input type="text" value={form.location} onChange={e=>handleLocationChange(e.target.value)} placeholder="输入地点" />
      )}

      <label>遭遇次数：</label>
      <input type="number" min="0" value={form.encounter_count ?? ''} onChange={e=>dispatch({ type:'SET_FIELD', field:'encounter_count', value:e.target.value })} placeholder="如：3240" />

      <label>月份：</label>
      <select value={form.Month||''} onChange={e=>dispatch({ type:'SET_FIELD', field:'Month', value:e.target.value })}>
        <option value="">选择月份</option>
        {MONTHS.map(m => <option key={m} value={m}>{MONTHS_ZH[m]}</option>)}
      </select>

      <label>年份：</label>
      <select value={form.Year||''} onChange={e=>dispatch({ type:'SET_FIELD', field:'Year', value:e.target.value })}>
        <option value="">选择年份</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <label>获得日期：</label>
      <input type="date" value={form.date_caught||''} onChange={e=>handleDateCaughtChange(e.target.value)} />

      <label>性格：</label>
      <select value={form.nature} onChange={e=>dispatch({ type:'SET_FIELD', field:'nature', value:e.target.value })}>
        <option value="">选择性格</option>
        {NATURES.map(n => <option key={n} value={n}>{NATURE_NAMES_ZH[n] || n}</option>)}
      </select>

      <label>个体值：</label>
      <input type="text" value={form.ivs} onChange={e=>dispatch({ type:'SET_FIELD', field:'ivs', value:formatIVs(e.target.value) })} placeholder="31/31/31/31/31/31" maxLength={17} />

      <label>昵称：</label>
      <input type="text" value={form.nickname} onChange={e=>dispatch({ type:'SET_FIELD', field:'nickname', value:e.target.value })} placeholder="可选昵称" />

      <label>形态：</label>
      <input type="text" value={form.variant} onChange={e=>dispatch({ type:'SET_FIELD', field:'variant', value:e.target.value })} placeholder="可选形态" />

      {YES_NO_FIELDS.map(({key,label})=>(
        <div key={key}>
          <label>{label}:</label>
          <select value={form[key]} onChange={e=>dispatch({ type:'SET_FIELD', field:key, value:e.target.value })}>
            <option value="Yes">是</option>
            <option value="No">否</option>
          </select>
        </div>
      ))}

      <label>反应链接：</label>
      <input type="text" value={form['Reaction Link']} onChange={e=>dispatch({ type:'SET_FIELD', field:'Reaction Link', value:e.target.value })} placeholder="可选 URL" />

      <div style={{ display:'flex', gap:10, marginTop:16 }}>
        <button type="submit" disabled={isMutating || !form.Pokemon.trim()}>{isMutating ? '保存中…' : submitLabel}</button>
        <button type="button" onClick={() => dispatch({ type:'RESET' })} style={{ backgroundColor:'#555' }}>重置</button>
      </div>
    </form>
  )
}

export { getDefaultState }
