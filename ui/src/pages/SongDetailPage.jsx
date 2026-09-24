import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Music, Disc3, Clock, Mic2, BarChart3,
  ExternalLink, Fingerprint, Tag, History, Globe, Sparkles
} from 'lucide-react';
import { songs } from '../lib/api';
import { formatDuration, parseDuration, ROTATION_LABELS } from '../lib/utils';

const TABS = [
  { id: 'general', label: 'General', icon: Music },
  { id: 'audio', label: 'Audio', icon: Clock },
  { id: 'classification', label: 'Classification', icon: Tag },
  { id: 'artists', label: 'Artists', icon: Mic2 },
  { id: 'album', label: 'Album', icon: Disc3 },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'external', label: 'External IDs', icon: Fingerprint },
  { id: 'spotify', label: 'Spotify Features', icon: Sparkles },
  { id: 'scheduling', label: 'Scheduling', icon: History },
];

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('general');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    songs.get(id).then(data => {
      setSong(data);
      setLoading(false);
    }).catch(() => {
      navigate('/library');
    });
  }, [id]);

  const update = (path, value) => {
    setSong(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] };
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await songs.update(id, song);
      setSong(updated);
      setDirty(false);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;
  if (!song) return null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/library')}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          {song.artwork || song.images?.[0]?.url ? (
            <img src={song.artwork || song.images[0].url} className="w-16 h-16 rounded-lg object-cover" alt="" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-base-300 flex items-center justify-center">
              <Music className="w-8 h-8 text-base-content/30" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{song.title}</h1>
            <p className="text-sm text-base-content/60">{song.artistDisplay || song.primaryArtist?.name}</p>
            <div className="flex gap-1 mt-1">
              {song.rotationLabels?.map((l, i) => {
                const info = ROTATION_LABELS[l];
                return info ? <span key={i} className={`rotation-badge ${info.color}`}>{info.label}</span> : null;
              })}
            </div>
          </div>
        </div>
        <button
          className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-bordered mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab tab-sm gap-1 ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl">
        {tab === 'general' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" value={song.title} onChange={v => update('title', v)} className="col-span-2" />
            <Field label="Sort Title" value={song.sortTitle} onChange={v => update('sortTitle', v)} placeholder='e.g., without "The"' />
            <Field label="Artist Display" value={song.artistDisplay} onChange={v => update('artistDisplay', v)} placeholder="Artist ft. Artist2" />
            <Field label="Duration" value={formatDuration(song.duration)} onChange={v => update('duration', parseDuration(v))} placeholder="M:SS" />
            <Field label="BPM" value={song.bpm} onChange={v => update('bpm', Number(v))} type="number" />
            <Field label="Musical Key" value={song.musicalKey} onChange={v => update('musicalKey', v)} placeholder="e.g., Am, C#" />
            <Field label="Weight" value={song.weight} onChange={v => update('weight', Number(v))} type="number" min={0} max={100} />
            <div className="form-control col-span-2">
              <label className="label"><span className="label-text">Rotation Labels</span></label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(ROTATION_LABELS).map(([key, info]) => {
                  const active = song.rotationLabels?.includes(key);
                  return (
                    <button
                      key={key}
                      className={`rotation-badge cursor-pointer border-2 ${active ? info.color + ' border-transparent' : 'bg-base-200 text-base-content/50 border-base-300'}`}
                      onClick={() => {
                        const labels = song.rotationLabels || [];
                        update('rotationLabels', active ? labels.filter(l => l !== key) : [...labels, key]);
                      }}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Notes" value={song.notes} onChange={v => update('notes', v)} textarea className="col-span-2" />
          </div>
        )}

        {tab === 'audio' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duration (ms)" value={song.duration} onChange={v => update('duration', Number(v))} type="number" />
            <Field label="BPM" value={song.bpm} onChange={v => update('bpm', Number(v))} type="number" />
            <Field label="Intro (ms)" value={song.intro} onChange={v => update('intro', Number(v))} type="number" placeholder="Ramp time" />
            <Field label="Outro (ms)" value={song.outro} onChange={v => update('outro', Number(v))} type="number" />
            <Field label="Cue In (ms)" value={song.cueIn} onChange={v => update('cueIn', Number(v))} type="number" />
            <Field label="Cue Out (ms)" value={song.cueOut} onChange={v => update('cueOut', Number(v))} type="number" placeholder="0 = end" />
            <Field label="Hook Start (ms)" value={song.hookStart} onChange={v => update('hookStart', Number(v))} type="number" />
            <Field label="Hook End (ms)" value={song.hookEnd} onChange={v => update('hookEnd', Number(v))} type="number" />
            <SelectField label="Ending" value={song.ending} onChange={v => update('ending', v)}
              options={[['', '-'], ['fade', 'Fade'], ['cold', 'Cold End'], ['jingle', 'Jingle']]} />
            <div className="form-control">
              <label className="label"><span className="label-text">Explicit</span></label>
              <input type="checkbox" className="toggle toggle-sm" checked={song.explicit || false} onChange={e => update('explicit', e.target.checked)} />
            </div>
          </div>
        )}

        {tab === 'classification' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Genre" value={song.genre} onChange={v => update('genre', v)} />
            <Field label="Sub-Genre" value={song.subGenre} onChange={v => update('subGenre', v)} />
            <Field label="Era" value={song.era} onChange={v => update('era', v)} placeholder="e.g., 80s, 90s" />
            <Field label="Year" value={song.year} onChange={v => update('year', Number(v))} type="number" />
            <Field label="Language" value={song.language} onChange={v => update('language', v)} />
            <Field label="Country" value={song.country} onChange={v => update('country', v)} />
            <SelectField label="Mood" value={song.mood} onChange={v => update('mood', v)}
              options={[['', '-'], ['very-sad', 'Very Sad'], ['melancholy', 'Melancholy'], ['neutral', 'Neutral'], ['happy', 'Happy'], ['very-happy', 'Very Happy']]} />
            <SelectField label="Energy" value={song.energy} onChange={v => update('energy', v)}
              options={[['', '-'], ['very-low', 'Very Low'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['very-high', 'Very High']]} />
            <SelectField label="Tempo Feel" value={song.tempo} onChange={v => update('tempo', v)}
              options={[['', '-'], ['very-slow', 'Very Slow'], ['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast'], ['very-fast', 'Very Fast']]} />
            <div className="form-control col-span-2">
              <label className="label"><span className="label-text">Keywords (comma-separated)</span></label>
              <input
                className="input input-bordered input-sm"
                value={(song.keywords || []).join(', ')}
                onChange={e => update('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="love, summer, dance"
              />
            </div>
            <div className="form-control col-span-2">
              <label className="label"><span className="label-text">Custom Properties</span></label>
              <div className="space-y-2">
                {(song.properties || []).map((prop, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input input-bordered input-sm w-40"
                      value={prop.key}
                      onChange={e => {
                        const props = [...(song.properties || [])];
                        props[i] = { ...props[i], key: e.target.value };
                        update('properties', props);
                      }}
                      placeholder="Key"
                    />
                    <input
                      className="input input-bordered input-sm flex-1"
                      value={prop.value}
                      onChange={e => {
                        const props = [...(song.properties || [])];
                        props[i] = { ...props[i], value: e.target.value };
                        update('properties', props);
                      }}
                      placeholder="Value"
                    />
                    <button className="btn btn-ghost btn-sm text-error" onClick={() => {
                      update('properties', (song.properties || []).filter((_, j) => j !== i));
                    }}>x</button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-xs" onClick={() => {
                  update('properties', [...(song.properties || []), { key: '', value: '' }]);
                }}>+ Add Property</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'artists' && (
          <div className="grid grid-cols-1 gap-4">
            <div className="alert alert-info text-sm">
              <span>Primary artist: <strong>{song.primaryArtist?.name || 'Not set'}</strong>. Artist linking and Spotify enrichment coming soon.</span>
            </div>
            <Field label="Artist Display" value={song.artistDisplay} onChange={v => update('artistDisplay', v)} placeholder="Full display: Artist ft. Artist2" />
            <Field label="Composer" value={song.composer} onChange={v => update('composer', v)} />
            <Field label="Lyricist" value={song.lyricist} onChange={v => update('lyricist', v)} />
            <Field label="Producer" value={song.producer} onChange={v => update('producer', v)} />
          </div>
        )}

        {tab === 'album' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Album Title" value={song.albumTitle} onChange={v => update('albumTitle', v)} className="col-span-2" />
            <Field label="Album Artist" value={song.albumArtist} onChange={v => update('albumArtist', v)} />
            <SelectField label="Album Type" value={song.albumType} onChange={v => update('albumType', v)}
              options={[['', '-'], ['album', 'Album'], ['single', 'Single'], ['compilation', 'Compilation'], ['ep', 'EP']]} />
            <Field label="Disc Number" value={song.discNumber} onChange={v => update('discNumber', Number(v))} type="number" />
            <Field label="Track Number" value={song.trackNumber} onChange={v => update('trackNumber', Number(v))} type="number" />
            <Field label="Total Tracks" value={song.totalTracks} onChange={v => update('totalTracks', Number(v))} type="number" />
            <Field label="Release Date" value={song.releaseDate ? song.releaseDate.slice(0, 10) : ''} onChange={v => update('releaseDate', v)} type="date" />
            <Field label="Label" value={song.label} onChange={v => update('label', v)} />
            <Field label="Artwork URL" value={song.artwork} onChange={v => update('artwork', v)} className="col-span-2" />
          </div>
        )}

        {tab === 'charts' && (
          <div>
            <p className="text-sm text-base-content/60 mb-4">Chart history for this song. Charts are managed on the Charts page.</p>
            {(song.chartHistory || []).length === 0 ? (
              <p className="text-base-content/40 text-sm">No chart entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Chart</th>
                      <th>Peak Pos</th>
                      <th>Peak Date</th>
                      <th>Weeks On</th>
                      <th>Debut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {song.chartHistory.map((ch, i) => (
                      <tr key={i}>
                        <td className="font-medium">{ch.chartName}</td>
                        <td>#{ch.peakPosition}</td>
                        <td>{ch.peakDate ? new Date(ch.peakDate).toLocaleDateString() : '-'}</td>
                        <td>{ch.weeksOnChart}</td>
                        <td>{ch.debutDate ? new Date(ch.debutDate).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'external' && (
          <div className="grid grid-cols-2 gap-4">
            <h3 className="col-span-2 font-semibold text-sm text-base-content/60 uppercase tracking-wide">Spotify</h3>
            <Field label="Track ID" value={song.externalIds?.spotifyTrackId} onChange={v => update('externalIds.spotifyTrackId', v)} />
            <Field label="Track URL" value={song.externalIds?.spotifyTrackUrl} onChange={v => update('externalIds.spotifyTrackUrl', v)} />
            <Field label="Album ID" value={song.externalIds?.spotifyAlbumId} onChange={v => update('externalIds.spotifyAlbumId', v)} />
            <Field label="ISRC" value={song.externalIds?.isrc} onChange={v => update('externalIds.isrc', v)} />

            <h3 className="col-span-2 font-semibold text-sm text-base-content/60 uppercase tracking-wide mt-4">YouTube</h3>
            <Field label="Video ID" value={song.externalIds?.youtubeVideoId} onChange={v => update('externalIds.youtubeVideoId', v)} />
            <Field label="URL" value={song.externalIds?.youtubeUrl} onChange={v => update('externalIds.youtubeUrl', v)} />

            <h3 className="col-span-2 font-semibold text-sm text-base-content/60 uppercase tracking-wide mt-4">OmniPlayer</h3>
            <Field label="Item Code" value={song.externalIds?.omniItemCode} onChange={v => update('externalIds.omniItemCode', v)} placeholder="Shared item code" />
            <Field label="Title ID" value={song.externalIds?.omniTitleId} onChange={v => update('externalIds.omniTitleId', v)} placeholder="Unique title ID" />

            <h3 className="col-span-2 font-semibold text-sm text-base-content/60 uppercase tracking-wide mt-4">Other Automation Systems</h3>
            <Field label="Propfrexx ID" value={song.externalIds?.propfrexxId} onChange={v => update('externalIds.propfrexxId', v)} />
            <Field label="RadioDJ ID" value={song.externalIds?.radioDjId} onChange={v => update('externalIds.radioDjId', v)} />
            <Field label="mAirList ID" value={song.externalIds?.mairlistId} onChange={v => update('externalIds.mairlistId', v)} />
            <Field label="Generic Automation ID" value={song.externalIds?.automationId} onChange={v => update('externalIds.automationId', v)} />
            <Field label="Automation Filename" value={song.externalIds?.automationFilename} onChange={v => update('externalIds.automationFilename', v)} className="col-span-2" />
            <Field label="Automation Path" value={song.externalIds?.automationPath} onChange={v => update('externalIds.automationPath', v)} className="col-span-2" />
          </div>
        )}

        {tab === 'spotify' && (
          <div>
            <p className="text-sm text-base-content/60 mb-4">
              Audio features from the Spotify API. These are auto-populated when syncing with Spotify.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <SpotifyMeter label="Danceability" value={song.spotifyFeatures?.danceability} />
              <SpotifyMeter label="Energy" value={song.spotifyFeatures?.energy} />
              <SpotifyMeter label="Valence (Mood)" value={song.spotifyFeatures?.valence} />
              <SpotifyMeter label="Acousticness" value={song.spotifyFeatures?.acousticness} />
              <SpotifyMeter label="Instrumentalness" value={song.spotifyFeatures?.instrumentalness} />
              <SpotifyMeter label="Speechiness" value={song.spotifyFeatures?.speechiness} />
              <SpotifyMeter label="Liveness" value={song.spotifyFeatures?.liveness} />
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Tempo (BPM)</span></label>
                <span className="text-lg font-mono">{song.spotifyFeatures?.tempo?.toFixed(1) || '-'}</span>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Loudness (dB)</span></label>
                <span className="text-lg font-mono">{song.spotifyFeatures?.loudness?.toFixed(1) || '-'}</span>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Key</span></label>
                <span className="text-lg font-mono">{formatMusicalKey(song.spotifyFeatures?.key, song.spotifyFeatures?.mode)}</span>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Time Signature</span></label>
                <span className="text-lg font-mono">{song.spotifyFeatures?.timeSignature ? `${song.spotifyFeatures.timeSignature}/4` : '-'}</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'scheduling' && (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Field label="Weight (0-100)" value={song.weight} onChange={v => update('weight', Number(v))} type="number" min={0} max={100} />
              <Field label="Packet ID" value={song.packetId} onChange={v => update('packetId', v)} placeholder="Group ID for packet rotation" />
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Dayparting</span></label>
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={song.dayparting?.enabled || false}
                    onChange={e => update('dayparting', { ...song.dayparting, enabled: e.target.checked })}
                  />
                  <span className="label-text">Enable daypart restrictions</span>
                </label>
              </div>
            </div>
            <div className="alert alert-info text-sm">
              <span>Play history and scheduling statistics will be shown here once the scheduling engine is active.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components
function Field({ label, value, onChange, type = 'text', textarea, className = '', ...props }) {
  return (
    <div className={`form-control ${className}`}>
      <label className="label"><span className="label-text text-xs">{label}</span></label>
      {textarea ? (
        <textarea
          className="textarea textarea-bordered textarea-sm"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
          {...props}
        />
      ) : (
        <input
          className="input input-bordered input-sm"
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          {...props}
        />
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <div className={`form-control ${className}`}>
      <label className="label"><span className="label-text text-xs">{label}</span></label>
      <select className="select select-bordered select-sm" value={value || ''} onChange={e => onChange(e.target.value)}>
        {options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
      </select>
    </div>
  );
}

function SpotifyMeter({ label, value }) {
  const pct = value != null ? Math.round(value * 100) : null;
  return (
    <div className="form-control">
      <label className="label"><span className="label-text text-xs">{label}</span></label>
      {pct != null ? (
        <div className="flex items-center gap-2">
          <progress className="progress progress-primary w-full" value={pct} max={100} />
          <span className="text-xs font-mono w-8 text-right">{pct}%</span>
        </div>
      ) : (
        <span className="text-sm text-base-content/30">-</span>
      )}
    </div>
  );
}

function formatMusicalKey(key, mode) {
  if (key == null) return '-';
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${keys[key] || '?'}${mode === 0 ? 'm' : ''}`;
}
