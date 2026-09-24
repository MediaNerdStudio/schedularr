import { useState, useEffect } from 'react';
import { Blocks, Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { blocks, categories as categoriesApi } from '../lib/api';
import { formatDuration, CLOCK_ELEMENT_TYPES } from '../lib/utils';

export default function BlocksPage() {
  const [blockList, setBlockList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', color: '#8b5cf6', targetDuration: 1200000, elements: [] });

  const load = async () => {
    try {
      const [blockData, catData] = await Promise.all([blocks.list(), categoriesApi.list()]);
      setBlockList(blockData);
      setCategoryList(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', description: '', color: '#8b5cf6', targetDuration: 1200000, elements: [] });
    setShowModal(true);
  };

  const openEdit = (block) => {
    setEditing(block);
    setForm({
      name: block.name, code: block.code, description: block.description || '',
      color: block.color, targetDuration: block.targetDuration, elements: block.elements || [],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await blocks.update(editing._id, form);
      } else {
        await blocks.create(form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (block) => {
    if (!confirm(`Delete block "${block.name}"?`)) return;
    try {
      await blocks.delete(block._id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const addBlockElement = () => {
    setForm(f => ({
      ...f,
      elements: [...f.elements, { type: 'fixed', position: f.elements.length, category: '', label: '', estimatedDuration: 0 }],
    }));
  };

  const removeBlockElement = (i) => {
    setForm(f => ({
      ...f,
      elements: f.elements.filter((_, j) => j !== i).map((el, j) => ({ ...el, position: j })),
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Blocks className="w-6 h-6 text-primary" />
            Blocks
          </h1>
          <p className="text-sm text-base-content/60 mt-1">Mini-formats — self-contained sequences like "20 min dance block".</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus className="w-4 h-4" /> New Block</button>
      </div>

      {blockList.length === 0 ? (
        <div className="text-center py-20">
          <Blocks className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
          <h2 className="text-lg font-medium text-base-content/60">No blocks yet</h2>
          <button className="btn btn-primary btn-sm mt-4" onClick={openCreate}><Plus className="w-4 h-4" /> Create Block</button>
        </div>
      ) : (
        <div className="grid gap-2">
          {blockList.map(block => (
            <div key={block._id} className="flex items-center gap-3 p-3 rounded-lg bg-base-200">
              <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: block.color }}>
                <Blocks className="w-4 h-4 text-white" />
              </div>
              <span className="font-mono text-sm font-bold w-16">{block.code}</span>
              <span className="font-medium flex-1">{block.name}</span>
              <span className="text-xs text-base-content/40 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDuration(block.targetDuration)}
              </span>
              <span className="text-xs text-base-content/40">{block.elements?.length || 0} elements</span>
              <button className="btn btn-ghost btn-xs" onClick={() => openEdit(block)}><Pencil className="w-3 h-3" /></button>
              <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(block)}><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg">{editing ? 'Edit Block' : 'New Block'}</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Code</span></label>
                <input className="input input-bordered input-sm font-mono uppercase" maxLength={6}
                  value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Name</span></label>
                <input className="input input-bordered input-sm"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Target Duration (min)</span></label>
                <input className="input input-bordered input-sm" type="number"
                  value={Math.round(form.targetDuration / 60000)}
                  onChange={e => setForm({ ...form, targetDuration: Number(e.target.value) * 60000 })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Color</span></label>
                <input type="color" className="w-12 h-8 rounded cursor-pointer"
                  value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>

            <div className="divider text-xs">Elements</div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {form.elements.map((el, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-base-200">
                  <span className="text-xs font-mono w-4">{i + 1}</span>
                  <select className="select select-xs" value={el.type}
                    onChange={e => {
                      const els = [...form.elements];
                      els[i] = { ...els[i], type: e.target.value };
                      setForm({ ...form, elements: els });
                    }}>
                    <option value="fixed">Fixed</option>
                    <option value="imaging">Imaging</option>
                    <option value="note">Note</option>
                  </select>
                  <select className="select select-xs flex-1" value={el.category || ''}
                    onChange={e => {
                      const els = [...form.elements];
                      els[i] = { ...els[i], category: e.target.value };
                      setForm({ ...form, elements: els });
                    }}>
                    <option value="">No category</option>
                    {categoryList.map(c => <option key={c._id} value={c._id}>{c.code} - {c.name}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => removeBlockElement(i)}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-xs mt-2" onClick={addBlockElement}>
              <Plus className="w-3 h-3" /> Add Element
            </button>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code || !form.name}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
}
