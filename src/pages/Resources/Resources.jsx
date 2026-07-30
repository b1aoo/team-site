import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import resourcesData from '../../data/resources.json'
import { translatePokemonName } from '../../utils/pokemon'
import styles from './Resources.module.css'

const RESOURCE_LABELS_ZH = {
  'Content Creators': '内容创作者',
  'Twitch Streamers': 'Twitch 主播',
  YouTubers: 'YouTube 创作者',
  Events: '活动',
  Guides: '攻略',
  Tools: '工具',
  'Rock Smash Routes': '碎岩地点',
  'Money Making': '赚钱',
  'Gym Re-Runs': '道馆复战',
  'Shiny Hunting': '闪光狩猎',
  'Safari Zone': '狩猎地带',
  Raids: '团体战',
  '6 Pillars': '六柱队',
  '7 Hells': '七狱队',
  'Prehistoric 5': '史前五人队',
  'Double Typhlosion': '双火暴兽',
  'Safari Zone Guide': '狩猎地带指南',
  'The Ultimate Christmas Event Guide': '圣诞活动终极指南',
  'Ultimate Halloween Guide': '万圣节终极指南',
  'The Ultimate Lunar New Year Event Guide': '农历新年活动终极指南',
  'Mystery Ball Drop Rates': '神秘球掉落率',
  'Pumpcat Spawn Locations 2025': '2025 南瓜猫出没地点',
  'Raids Den Discord': '团体战巢穴 Discord',
  'Christmas Event Raids': '圣诞活动团体战',
  'Halloween Event Raids': '万圣节活动团体战',
  'Lunar New Year Event Raids': '农历新年活动团体战',
  'Money Per Hour': '每小时收益',
  'Cost of Team': '队伍成本',
  Difficulty: '难度',
  'Medium - High depending on Route': '中等至高（取决于路线）',
  'Easy - Medium': '简单至中等',
  Hard: '困难',
  'Medium - High': '中等至高',
  Easy: '简单',
  Medium: '中等',
  guides: '攻略',
  gameplay: '游戏实况',
  news: '新闻',
  music: '音乐',
  'shiny hunting': '闪光狩猎',
  en: '英语',
  pvp: '对战',
  description: '简介',
  credits: '鸣谢',
  tags: '标签',
}

function translateResourceLabel(value) {
  if (typeof value !== 'string') return value
  return RESOURCE_LABELS_ZH[value] || translatePokemonName(value)
}

function translateResourceDescription(item) {
  const name = translateResourceLabel(item?.name || '此资源')
  if (item?.link || item?.url) {
    return `点击下方链接查看“${name}”的详细攻略、说明或原作者内容。`
  }
  return `“${name}”的相关资料。`
}

function translateResourceTags(tags) {
  if (typeof tags !== 'string') return tags
  return tags.split(',').map((tag) => translateResourceLabel(tag.trim())).join('、')
}

// Utility function to convert text to URL slug
const toSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-') // collapse multiple dashes
    .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
}

// Utility function to find key by slug
const findKeyBySlug = (obj, slug) => {
  if (!obj) return null
  return Object.keys(obj).find(key => toSlug(key) === slug)
}

// Function to calculate leaderboard from resources data
const calculateLeaderboard = (data) => {
  const credits = {}

  // Recursively traverse the data structure to find all credits fields
  const traverse = (obj) => {
    if (!obj || typeof obj !== 'object') return
    
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item))
      return
    }

    // Check if this object has a credits field
    if (obj.credits && typeof obj.credits === 'string') {
      // Split by comma in case multiple credits are listed
      const creditsArray = obj.credits.split(',').map(c => c.trim()).filter(c => c)
      creditsArray.forEach(credit => {
        credits[credit] = (credits[credit] || 0) + 1
      })
    }

    // Traverse nested objects
    Object.values(obj).forEach(value => {
      if (value && typeof value === 'object') {
        traverse(value)
      }
    })
  }

  traverse(data)

  // Sort by count descending and get top 5
  return Object.entries(credits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry, idx) => ({
      rank: idx + 1,
      name: entry[0],
      count: entry[1]
    }))
}

export default function Resources() {
  const navigate = useNavigate()
  const { category: urlCategory, subcategory: urlSubcategory, nested: urlNested } = useParams()
  
  // Get initial values from URL params and find actual keys
  const defaultCategory = Object.keys(resourcesData)[0]
  const actualCategory = urlCategory ? findKeyBySlug(resourcesData, urlCategory) : defaultCategory
  
  const categoryData = resourcesData[actualCategory]
  const actualSubcategory = urlSubcategory ? findKeyBySlug(categoryData, urlSubcategory) : null
  
  const subcategoryData = actualCategory && actualSubcategory ? categoryData[actualSubcategory] : null
  const actualNested = urlNested && subcategoryData && typeof subcategoryData === 'object' && !Array.isArray(subcategoryData)
    ? findKeyBySlug(subcategoryData, urlNested)
    : null

  // State for navigation through tabs
  const [activeCategory, setActiveCategory] = useState(actualCategory)
  const [activeSubcategory, setActiveSubcategory] = useState(actualSubcategory)
  const [activeNestedTab, setActiveNestedTab] = useState(actualNested)
  const [expandedIndexCategories, setExpandedIndexCategories] = useState({})
  const [showIndex, setShowIndex] = useState(false)

  // Extract metadata for SEO
  const categoryMeta = categoryData?._meta
  const subcategoryMeta = subcategoryData?._meta
  const nestedTabData = activeNestedTab && subcategoryData ? subcategoryData[activeNestedTab] : null
  const nestedMeta = nestedTabData?._meta

  // Build breadcrumbs with dynamic metadata
  const buildBreadcrumbs = () => {
    const crumbs = [
      { name: '首页', url: '/' },
      { name: '资源', url: '/resources/' }
    ]
    
    if (activeCategory) {
      crumbs.push({ name: translateResourceLabel(activeCategory), url: `/resources/${toSlug(activeCategory)}/` })
    }
    if (activeSubcategory) {
      crumbs.push({ name: translateResourceLabel(activeSubcategory), url: `/resources/${toSlug(activeCategory)}/${toSlug(activeSubcategory)}/` })
    }
    if (activeNestedTab) {
      crumbs.push({ name: translateResourceLabel(activeNestedTab), url: `/resources/${toSlug(activeCategory)}/${toSlug(activeSubcategory)}/${toSlug(activeNestedTab)}/` })
    }
    
    return crumbs
  }

  // Determine which metadata to use for the page head
  const seoMeta = nestedMeta || subcategoryMeta || categoryMeta || {}
  let currentCanonicalPath = `/resources${activeCategory ? `/${toSlug(activeCategory)}` : ''}${activeSubcategory ? `/${toSlug(activeSubcategory)}` : ''}${activeNestedTab ? `/${toSlug(activeNestedTab)}` : ''}/`;

  useDocumentHead({
    title: `PokeMMO 资源中心${activeNestedTab || activeSubcategory || activeCategory ? `｜${translateResourceLabel(activeNestedTab || activeSubcategory || activeCategory)}` : ''}`,
    description: '浏览 PokeMMO 攻略、工具、计算器、社区链接与实用技巧。',
    canonicalPath: currentCanonicalPath,
    breadcrumbs: buildBreadcrumbs()
  })

  // Get available categories
  const categories = Object.keys(resourcesData).filter(key => !key.startsWith('_'))
  const currentCategory = resourcesData[activeCategory]
  
  // For subcategories: check if category has nested structure (subcats) or if it's flat (_items)
  const isFlatCategory = currentCategory && currentCategory._items && Array.isArray(currentCategory._items) && !Object.keys(currentCategory).some(k => !k.startsWith('_') && k !== '_items')
  const subcategories = !isFlatCategory && activeCategory ? Object.keys(currentCategory || {}).filter(key => !key.startsWith('_')) : []

  // Update URL when tab changes
  useEffect(() => {
    let newPath = '/resources/'
    
    if (activeCategory) {
      newPath += `${toSlug(activeCategory)}/`
    }
    if (activeSubcategory) {
      newPath += `${toSlug(activeSubcategory)}/`
    }
    if (activeNestedTab) {
      newPath += `${toSlug(activeNestedTab)}/`
    }
    
    // Only navigate if necessary
    const currentPath = window.location.pathname
    if (currentPath !== newPath) {
      navigate(newPath, { replace: true })
    }
  }, [activeCategory, activeSubcategory, activeNestedTab, navigate])

  // Set initial subcategory when category changes
  useEffect(() => {
    const newSubcategories = currentCategory ? Object.keys(currentCategory).filter(key => !key.startsWith('_')) : []
    if (newSubcategories.length > 0) {
      // Only set if not already set from URL
      if (!activeSubcategory) {
        setActiveSubcategory(newSubcategories[0])
        setActiveNestedTab(null)
      }
    }
  }, [activeCategory, currentCategory, activeSubcategory])

  // Check if current subcategory has nested structure
  const getSubcategoryContent = () => {
    if (!activeSubcategory || !currentCategory) return null
    return currentCategory[activeSubcategory]
  }

  const subcategoryContent = getSubcategoryContent()
  const isNested = subcategoryContent && typeof subcategoryContent === 'object' && !Array.isArray(subcategoryContent)
  const nestedKeys = isNested ? Object.keys(subcategoryContent).filter(key => !key.startsWith('_')) : []

  // Set initial nested tab when subcategory changes
  useEffect(() => {
    if (!activeSubcategory) {
      setActiveNestedTab(null)
      return
    }
    
    const subcatContent = resourcesData[activeCategory]?.[activeSubcategory]
    const hasNesting = subcatContent && typeof subcatContent === 'object' && !Array.isArray(subcatContent)
    
    if (hasNesting) {
      const keys = Object.keys(subcatContent).filter(key => !key.startsWith('_'))
      setActiveNestedTab(keys[0] || null)
    } else {
      setActiveNestedTab(null)
    }
  }, [activeSubcategory, activeCategory])

  // Get items for current view
  const getItems = () => {
    // First check if category itself has _items (flat structure like Events)
    if (!activeSubcategory && currentCategory && currentCategory._items && Array.isArray(currentCategory._items)) {
      return currentCategory._items.filter(item => item !== null && item !== undefined)
    }

    if (!subcategoryContent) return []

    // If it's a direct array (old format)
    if (Array.isArray(subcategoryContent)) {
      return subcategoryContent.filter(item => item !== null && item !== undefined)
    }

    // If the subcategory content has _items directly (like Rock Smash Routes)
    if (subcategoryContent._items && Array.isArray(subcategoryContent._items)) {
      return subcategoryContent._items.filter(item => item !== null && item !== undefined)
    }

    // If it's nested and we have a selected nested tab
    if (isNested && activeNestedTab) {
      const nestedContent = subcategoryContent[activeNestedTab]
      
      // Check for new format with _items array
      if (nestedContent && typeof nestedContent === 'object' && !Array.isArray(nestedContent) && nestedContent._items) {
        return nestedContent._items.filter(item => item !== null && item !== undefined)
      }
      
      // Check for old direct array format
      if (Array.isArray(nestedContent)) {
        return nestedContent.filter(item => item !== null && item !== undefined)
      }
    }

    return []
  }

  const items = getItems()

  // Dynamically render item fields, excluding certain keys
  const renderItemFields = (item) => {
    if (!item || typeof item !== 'object') return null

    const excludeKeys = ['name', 'profileImage'] // Keys to exclude from display
    const entries = Object.entries(item).filter(([key]) => !excludeKeys.includes(key))

    return entries.map(([key, value]) => {
      // Special handling for links
      if (key === 'link' || key === 'url') {
        return null // Handled separately in the card
      }
      if (key === 'description') {
        return (
          <p key={key} className={styles.itemDescription}>
            {translateResourceDescription(item)}
          </p>
        )
      }
      return (
        <>
          <strong key={`${key}-label`} className={styles.itemFieldLabel}>{translateResourceLabel(key)}：</strong>
          <span key={`${key}-value`} className={styles.itemFieldValue}>{key === 'tags' ? translateResourceTags(value) : translateResourceLabel(String(value))}</span>
        </>
      )
    })
  }

  // Toggle index category expansion
  const toggleIndexCategory = (categoryKey) => {
    setExpandedIndexCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }))
  }

  // Navigate to a resource section
  const navigateToResource = (catSlug, subcatSlug = null, nestedSlug = null) => {
    let path = `/resources/${catSlug}/`
    if (subcatSlug) path += `${subcatSlug}/`
    if (nestedSlug) path += `${nestedSlug}/`
    navigate(path)
    setShowIndex(false)
  }

  // Filter items by selected tags (if any)
  const filterItemsByTags = (items) => {
    if (!selectedTags.length) return items
    return items.filter(item => {
      if (!item.tags) return false
      const tagsArr = item.tags.split(',').map(t => t.trim())
      return selectedTags.every(tag => tagsArr.includes(tag))
    })
  }

  // Tag filtering for Content Creators (must always be defined)
  const [selectedTags, setSelectedTags] = useState([])
  let allContentCreatorTags = []
  if (activeCategory === 'Content Creators') {
    const cc = resourcesData['Content Creators']
    const tagSet = new Set()
    // If a subcategory is selected, only show tags from that subcategory
    const subcats = activeSubcategory && cc[activeSubcategory] && cc[activeSubcategory]._items
      ? [activeSubcategory]
      : ['YouTubers', 'Twitch Streamers']
    subcats.forEach(subcat => {
      if (cc[subcat] && cc[subcat]._items) {
        cc[subcat]._items.forEach(item => {
          if (item.tags) {
            item.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t))
          }
        })
      }
    })
    allContentCreatorTags = Array.from(tagSet).sort()
  }

  return (
    <div className={styles.container}>
      <h1>PokeMMO 资源中心</h1>
      <p className={styles.intro}>
        发现攻略、工具和社区链接，提升你的 PokeMMO 游戏体验。
      </p>

        <h4 className={styles.intro}>如果此处收录了你的内容且希望移除，或你有值得加入的攻略或工具，请通过 Discord 联系 ohypers。</h4>

      {/* Index/Table of Contents */}
      <div className={styles.indexContainer}>
        <button 
          className={styles.indexToggleButton}
          onClick={() => setShowIndex(!showIndex)}
        >
          <span className={styles.indexToggleIcon}>{showIndex ? '▼' : '▶'}</span>
          📑 目录
        </button>
        
        {showIndex && (
          <div className={styles.indexDropdown}>
            {categories.map(category => {
              const categoryKey = category
              const categoryContent = resourcesData[categoryKey]
              // Always show subcategories if any (even if _items exists)
              const subcategoryKeys = Object.keys(categoryContent || {}).filter(key => !key.startsWith('_') && key !== '_items')
              return (
                <div key={categoryKey} className={styles.indexCategoryWrapper}>
                  <div className={styles.indexCategoryHeader}>
                    <button
                      className={styles.indexCategoryLink}
                      onClick={() => {
                        setActiveCategory(categoryKey)
                        setActiveSubcategory(null)
                        setActiveNestedTab(null)
                        navigate(`/resources/${toSlug(categoryKey)}/`)
                        setShowIndex(false)
                      }}
                    >
                      {translateResourceLabel(categoryKey)}
                    </button>
                  </div>
                  {subcategoryKeys.length > 0 && (
                    <div className={styles.indexSubcategoryList}>
                      {subcategoryKeys.map(subcategoryKey => {
                        const subcategoryContent = categoryContent[subcategoryKey]
                        const nestedKeys = subcategoryContent && typeof subcategoryContent === 'object' && !Array.isArray(subcategoryContent)
                          ? Object.keys(subcategoryContent).filter(key => !key.startsWith('_') && key !== '_items')
                          : []
                        return (
                          <div key={subcategoryKey} className={styles.indexSubcategoryWrapper}>
                            <div className={styles.indexSubcategoryHeader}>
                              <button
                                className={styles.indexSubcategoryLink}
                                onClick={() => {
                                  setActiveCategory(categoryKey)
                                  setActiveSubcategory(subcategoryKey)
                                  setActiveNestedTab(null)
                                  navigate(`/resources/${toSlug(categoryKey)}/${toSlug(subcategoryKey)}/`)
                                  setShowIndex(false)
                                }}
                              >
                                {translateResourceLabel(subcategoryKey)}
                              </button>
                            </div>
                            {nestedKeys.length > 0 && (
                              <div className={styles.indexNestedList}>
                                {nestedKeys.map(nestedKey => (
                                  <button
                                    key={nestedKey}
                                    className={styles.indexNestedLink}
                                    onClick={() => {
                                      setActiveCategory(categoryKey)
                                      setActiveSubcategory(subcategoryKey)
                                      setActiveNestedTab(nestedKey)
                                      navigate(`/resources/${toSlug(categoryKey)}/${toSlug(subcategoryKey)}/${toSlug(nestedKey)}/`)
                                      setShowIndex(false)
                                    }}
                                  >
                                  {translateResourceLabel(nestedKey)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Main Category Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          {categories.map(category => (
            <button
              key={category}
              className={`${styles.tab} ${activeCategory === category ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveCategory(category)
                setActiveSubcategory(null)
                setActiveNestedTab(null)
              }}
            >
              {translateResourceLabel(category)}
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory Tabs */}
      {subcategories.length > 0 && (
        <div className={styles.subTabsContainer}>
          <div className={styles.subTabs}>
            {subcategories.map(subcategory => (
              <button
                key={subcategory}
                className={`${styles.subTab} ${activeSubcategory === subcategory ? styles.activeSubTab : ''}`}
                onClick={() => {
                  setActiveSubcategory(subcategory)
                  setActiveNestedTab(null)
                }}
              >
                {translateResourceLabel(subcategory)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nested Tabs (for third level) */}
      {isNested && nestedKeys.length > 0 && (
        <div className={styles.nestedTabsContainer}>
          <div className={styles.nestedTabs}>
            {nestedKeys.map(nestedKey => (
              <button
                key={nestedKey}
                className={`${styles.nestedTab} ${activeNestedTab === nestedKey ? styles.activeNestedTab : ''}`}
                onClick={() => setActiveNestedTab(nestedKey)}
              >
                {translateResourceLabel(nestedKey)}
              </button>
            ))}
          </div>
        </div>
      )}

            {/* Subcategory Description - Only show for Twitch Streamers */}
      {activeCategory === 'Content Creators' && activeSubcategory === 'Twitch Streamers' && subcategoryContent?._meta?.description && (
        <div className={styles.subcategoryDescription}>
          <p>
            浏览 Team Synergy 收录的 PokeMMO 主播与直播内容。
            {' '}
            {(() => {
              return <Link to="/streamers/">主播页面</Link>;
            })()}
          </p>
        </div>
      )}

            {/* Subcategory Description - Show for Twitch Streamers and YouTubers */}
      {activeCategory === 'Content Creators' &&
        (activeSubcategory === 'Twitch Streamers' || activeSubcategory === 'YouTubers') && (
        <div className={styles.contentCreatoradd}>
          <p>希望被收录？请在 Discord 私信 ohypers。</p>
        </div>
      )}

      {/* Tag Filter UI for Content Creators */}
      {activeCategory === 'Content Creators' && allContentCreatorTags.length > 0 && (
        <div className={styles.tagFilterContainer}>
          <span className={styles.tagFilterLabel}>按标签筛选：</span>
          {allContentCreatorTags.map(tag => (
            <button
              key={tag}
              className={selectedTags.includes(tag) ? styles.tagFilterButtonActive : styles.tagFilterButton}
              onClick={() => {
                setSelectedTags(selectedTags.includes(tag)
                  ? selectedTags.filter(t => t !== tag)
                  : [...selectedTags, tag])
              }}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button className={styles.tagFilterClearButton} onClick={() => setSelectedTags([])}>
              清除
            </button>
          )}
        </div>
      )}

      {/* Items Grid */}
      {filterItemsByTags(items).length > 0 && (
        <div className={styles.itemsGrid}>
          {filterItemsByTags(items).map((item, idx) => (
            item && (
              <div key={idx} className={styles.resourceCard}>
                {item.profileImage && (
                  <div className={styles.cardImageContainer}>
                    <img 
                      src={getAssetUrl(item.profileImage)} 
                      alt={item.name || '个人资料'}
                      className={styles.cardImage}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                )}
                <div className={styles.cardContent}>
                  <h3 className={styles.itemName}>{translateResourceLabel(item.name || '未命名条目')}</h3>
                  {renderItemFields(item)}
                </div>
                {(item.link || item.url) && (
                  <a
                    href={item.link || item.url}
                    target={(item.link || item.url).startsWith('http') ? '_blank' : '_self'}
                    rel={(item.link || item.url).startsWith('http') ? 'noopener noreferrer' : ''}
                    className={styles.itemLink}
                  >
                    前往 {translateResourceLabel(item.name || '资源')}
                    {(item.link || item.url).startsWith('http') && (
                      <span className={styles.externalIcon}>↗</span>
                    )}
                  </a>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {filterItemsByTags(items).length === 0 && (
        <div className={styles.emptyState}>
          <p>此分区暂时没有可用资源。</p>
        </div>
      )}

      {/* Leaderboard Section */}
      <div className={styles.leaderboardSection}>
        <h2>贡献者排行</h2>
        <div className={styles.leaderboard}>
          {calculateLeaderboard(resourcesData).map((contributor) => (
            <div key={contributor.name} className={styles.leaderboardEntry}>
              <div className={styles.leaderboardRank}>#{contributor.rank}</div>
              <div className={styles.leaderboardName}>{contributor.name}</div>
              <div className={styles.leaderboardCount}>{contributor.count} 份攻略／资源</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
