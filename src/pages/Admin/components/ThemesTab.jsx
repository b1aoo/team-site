import { useState } from "react";
import styles from "../Admin.module.css";
import ConfirmDialog from "./ConfirmDialog";

const CATEGORIES = ['Themes', 'Encounter Counters', 'Pokemon Textures', 'Other'];
const CATEGORY_LABELS = { Themes: '主题', 'Encounter Counters': '遭遇计数器', 'Pokemon Textures': '宝可梦贴图', Other: '其他' };

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

const emptyTheme = { name: "", author: "", description: "", previewImage: "", previewImages: [], detailedImages: [], link: "" };

export default function ThemesTab({ themesDB, onSave, onDelete, isMutating }) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [themeData, setThemeData] = useState(emptyTheme);
  const [editingKey, setEditingKey] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const currentItems = themesDB[activeCategory] || {};

  const handleCreateOrUpdate = async () => {
    if (!themeData.name) return;
    const itemKey = editingKey || slugify(themeData.name);
    await onSave(activeCategory, itemKey, themeData);
    setThemeData(emptyTheme);
    setEditingKey(null);
  };



  const handleEdit = (key, item) => {
    setEditingKey(key);
    setThemeData({
      ...emptyTheme,
      ...item,
      previewImages: item.previewImages || [],
      detailedImages: item.detailedImages || []
    });
  };

  // Detailed Images handlers
  const handleAddDetailedImage = () => {
    setThemeData((prev) => ({
      ...prev,
      detailedImages: [...(prev.detailedImages || []), ""]
    }));
  };

  const handleDetailedImageChange = (idx, value) => {
    setThemeData((prev) => {
      const arr = [...(prev.detailedImages || [])];
      arr[idx] = value;
      return { ...prev, detailedImages: arr };
    });
  };

  const handleRemoveDetailedImage = (idx) => {
    setThemeData((prev) => {
      const arr = [...(prev.detailedImages || [])];
      arr.splice(idx, 1);
      return { ...prev, detailedImages: arr };
    });
  };

  // Preview Images handlers
  const handleAddPreviewImage = () => {
    setThemeData((prev) => ({
      ...prev,
      previewImages: [...(prev.previewImages || []), ""]
    }));
  };

  const handlePreviewImageChange = (idx, value) => {
    setThemeData((prev) => {
      const arr = [...(prev.previewImages || [])];
      arr[idx] = value;
      return { ...prev, previewImages: arr };
    });
  };

  const handleRemovePreviewImage = (idx) => {
    setThemeData((prev) => {
      const arr = [...(prev.previewImages || [])];
      arr.splice(idx, 1);
      return { ...prev, previewImages: arr };
    });
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setThemeData(emptyTheme);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await onDelete(confirmDelete.category, confirmDelete.key, confirmDelete.name);
    setConfirmDelete(null);
  };

  return (
    <div>
      {/* Category selector */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={activeCategory === cat ? styles.tabActive : styles.tab}
            style={{ margin: 0 }}
            onClick={() => {
              setActiveCategory(cat);
              setEditingKey(null);
              setThemeData(emptyTheme);
            }}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Form */}
      <h3>{editingKey ? '编辑主题' : '添加主题'} — {CATEGORY_LABELS[activeCategory] || activeCategory}</h3>
      <div className={styles.editSection}>
        <label>名称：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={themeData.name}
          onChange={(e) => setThemeData({ ...themeData, name: e.target.value })}
        />

        <label>作者：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={themeData.author}
          onChange={(e) => setThemeData({ ...themeData, author: e.target.value })}
        />

        <label>说明：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={themeData.description}
          onChange={(e) => setThemeData({ ...themeData, description: e.target.value })}
        />


        <label>预览图片 URL：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={themeData.previewImage}
          onChange={(e) => setThemeData({ ...themeData, previewImage: e.target.value })}
        />

        <label>详情图片：</label>
        <div style={{ marginBottom: 8 }}>
          {(themeData.detailedImages || []).map((img, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <input
                type="text"
                className={styles.adminInput}
                style={{ flex: 1 }}
                value={img}
                placeholder={`Detailed Image URL #${idx + 1}`}
                onChange={e => handleDetailedImageChange(idx, e.target.value)}
              />
              <button type="button" className={styles.deleteBtn} onClick={() => handleRemoveDetailedImage(idx)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className={styles.editBtn} onClick={handleAddDetailedImage}>
            Add Detailed Image
          </button>
        </div>

        <label>下载／链接 URL：</label>
        <input
          type="text"
          className={styles.adminInput}
          value={themeData.link}
          onChange={(e) => setThemeData({ ...themeData, link: e.target.value })}
        />

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            className={styles.editBtn}
            onClick={handleCreateOrUpdate}
            disabled={isMutating || !themeData.name}
          >
            {isMutating ? '保存中…' : editingKey ? '保存修改' : '添加主题'}
          </button>
          {editingKey && (
            <button className={styles.deleteBtn} onClick={handleCancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Theme list */}
      <h3>“{CATEGORY_LABELS[activeCategory] || activeCategory}”中的主题</h3>
      {Object.keys(currentItems).length === 0 ? (
        <p className={styles.hintText}>此分类暂时没有主题。</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.shinyTable}>
            <thead>
              <tr>
                <th>预览</th>
                <th>名称</th>
                <th>作者</th>
                <th>说明</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(currentItems).map(([key, item]) => (
                <tr key={key}>
                  <td>
                    {item.previewImage ? (
                      <img
                        src={item.previewImage}
                        alt={item.name}
                        style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }}
                      />
                    ) : (
                      <span style={{ color: '#666', fontSize: '0.8rem' }}>无图片</span>
                    )}
                  </td>
                  <td>{item.name}</td>
                  <td>{item.author}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.description}
                  </td>
                  <td className={styles.actionBtns}>
                    <button className={styles.editBtn} onClick={() => handleEdit(key, item)}>
                      Edit
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setConfirmDelete({ category: activeCategory, key, name: item.name })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="删除主题"
          message={`确定要从${CATEGORY_LABELS[confirmDelete.category] || confirmDelete.category}中删除“${confirmDelete.name}”吗？`}
          confirmLabel="删除"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
