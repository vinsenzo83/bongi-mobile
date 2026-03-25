import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { api } from '../../utils/api.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

const ALARM_CATEGORIES = [
  { type: 'plan_change', label: '요금제 변경 가능일', icon: '\uD83D\uDCF1', defaultTitle: '요금제 변경 가능' },
  { type: 'addon_cancel', label: '부가서비스 해지일', icon: '\uD83D\uDDD1\uFE0F', defaultTitle: '부가서비스 해지' },
  { type: 'internet_expire', label: '인터넷 약정 종료일', icon: '\uD83C\uDF10', defaultTitle: '인터넷 약정 종료' },
  { type: 'rental_expire', label: '렌탈 약정 종료일', icon: '\uD83C\uDFE0', defaultTitle: '렌탈 약정 종료', multiple: true },
];

function calcDday(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate + 'T00:00:00');
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatDday(dday) {
  if (dday === 0) return 'D-DAY';
  if (dday > 0) return `D-${dday}`;
  return `D+${Math.abs(dday)}`;
}

function getDdayColor(dday) {
  if (dday <= 0) return '#ef4444';
  if (dday <= 7) return '#ef4444';
  if (dday <= 30) return '#f59e0b';
  return '#6b7280';
}

export default function DonJikimi() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [alarms, setAlarms] = useState([]);
  // 모바일에서는 기본 접기
  const [expanded, setExpanded] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', target_date: '', memo: '' });
  const [editingId, setEditingId] = useState(null);

  const STORAGE_KEY = 'donjikimi_alarms';

  const getLocalAlarms = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  };
  const saveLocalAlarms = (items) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const fetchAlarms = useCallback(async () => {
    if (user) {
      try {
        const data = await api.alarms.list();
        setAlarms(data.alarms || []);
      } catch {
        setAlarms(getLocalAlarms());
      }
    } else {
      setAlarms(getLocalAlarms());
    }
  }, [user]);

  useEffect(() => { fetchAlarms(); }, [fetchAlarms]);

  const handleSave = async () => {
    if (!editForm.target_date) return;
    try {
      const category = ALARM_CATEGORIES.find(c => c.type === editingType);
      const payload = {
        alarm_type: editingType,
        title: editForm.title || category?.defaultTitle || '',
        target_date: editForm.target_date,
        memo: editForm.memo,
      };

      if (user) {
        if (editingId) {
          await api.alarms.update(editingId, payload);
        } else {
          await api.alarms.create(payload);
        }
      } else {
        const local = getLocalAlarms();
        if (editingId) {
          const updated = local.map(a => a.id === editingId ? { ...a, ...payload } : a);
          saveLocalAlarms(updated);
        } else {
          saveLocalAlarms([...local, { ...payload, id: `local_${Date.now()}`, created_at: new Date().toISOString() }]);
        }
      }
      setEditingType(null);
      setEditingId(null);
      setEditForm({ title: '', target_date: '', memo: '' });
      fetchAlarms();
    } catch (e) {
      alert(e.message || '저장 실패');
    }
  };

  const handleDelete = async (id) => {
    try {
      if (user) {
        await api.alarms.remove(id);
      } else {
        saveLocalAlarms(getLocalAlarms().filter(a => a.id !== id));
      }
      fetchAlarms();
    } catch (e) {
      alert(e.message || '삭제 실패');
    }
  };

  const openEdit = (type, alarm = null) => {
    setEditingType(type);
    if (alarm) {
      setEditingId(alarm.id);
      setEditForm({ title: alarm.title, target_date: alarm.target_date, memo: alarm.memo || '' });
    } else {
      const category = ALARM_CATEGORIES.find(c => c.type === type);
      setEditingId(null);
      setEditForm({ title: category?.defaultTitle || '', target_date: '', memo: '' });
    }
  };

  const cancelEdit = () => {
    setEditingType(null);
    setEditingId(null);
    setEditForm({ title: '', target_date: '', memo: '' });
  };

  const getAlarmsForType = (type) => alarms.filter(a => a.alarm_type === type);

  // 긴급 알람 개수 (D-30 이내)
  const urgentCount = alarms.filter(a => {
    const d = calcDday(a.target_date);
    return d >= 0 && d <= 30;
  }).length;

  // 모바일 컴팩트 모드: 접힌 상태에서 긴급 알람 요약 표시
  const urgentAlarms = alarms.filter(a => {
    const d = calcDday(a.target_date);
    return d >= 0 && d <= 30;
  });

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.headerIcon}>{'\uD83D\uDEE1\uFE0F'}</span>
        <span style={styles.headerTitle}>돈지키미</span>
        {urgentCount > 0 && <span style={styles.badge}>{urgentCount}</span>}
        <span style={styles.chevron}>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {/* 모바일 컴팩트 요약: 접힌 상태에서 긴급 알람만 표시 */}
      {!expanded && isMobile && urgentAlarms.length > 0 && (
        <div style={styles.compactSummary}>
          {urgentAlarms.slice(0, 2).map(a => {
            const dday = calcDday(a.target_date);
            return (
              <div key={a.id} style={styles.compactItem}>
                <span style={styles.compactTitle}>{a.title}</span>
                <span style={{ ...styles.compactDday, color: getDdayColor(dday) }}>
                  {formatDday(dday)}
                </span>
              </div>
            );
          })}
          {urgentAlarms.length > 2 && (
            <div style={styles.compactMore}>+{urgentAlarms.length - 2}건 더</div>
          )}
        </div>
      )}

      {/* 카테고리 목록 */}
      {expanded && (
        <div style={styles.body}>
          {ALARM_CATEGORIES.map(cat => {
            const items = getAlarmsForType(cat.type);
            return (
              <div key={cat.type} style={styles.category}>
                <div style={styles.catHeader}>
                  <span style={styles.catIcon}>{cat.icon}</span>
                  <span style={styles.catLabel}>{cat.label}</span>
                  {cat.multiple && (
                    <button
                      onClick={() => openEdit(cat.type)}
                      style={styles.addBtn}
                      title="항목 추가"
                    >+</button>
                  )}
                </div>

                {items.length === 0 ? (
                  <div
                    style={styles.emptyItem}
                    onClick={() => openEdit(cat.type)}
                  >
                    날짜를 설정해주세요
                  </div>
                ) : (
                  items.map(alarm => {
                    const dday = calcDday(alarm.target_date);
                    const ddayColor = getDdayColor(dday);
                    return (
                      <div
                        key={alarm.id}
                        style={styles.alarmItem}
                        onClick={() => openEdit(cat.type, alarm)}
                      >
                        <div style={styles.alarmInfo}>
                          <span style={styles.alarmTitle}>{alarm.title}</span>
                          <span style={styles.alarmDate}>{alarm.target_date}</span>
                        </div>
                        <span style={{ ...styles.dday, color: ddayColor }}>
                          {formatDday(dday)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}

          {/* 편집 패널 */}
          {editingType && (
            <div style={styles.editPanel}>
              <div style={styles.editHeader}>
                {editingId ? '알람 수정' : '알람 추가'}
              </div>
              <input
                type="text"
                placeholder="제목"
                value={editForm.title}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                style={styles.input}
              />
              <input
                type="date"
                value={editForm.target_date}
                onChange={e => setEditForm({ ...editForm, target_date: e.target.value })}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="메모 (선택)"
                value={editForm.memo}
                onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                style={styles.input}
              />
              <div style={styles.editActions}>
                <button onClick={handleSave} style={styles.saveBtn}>저장</button>
                {editingId && (
                  <button onClick={() => handleDelete(editingId)} style={styles.delBtn}>삭제</button>
                )}
                <button onClick={cancelEdit} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginBottom: 8,
    borderRadius: 8,
    border: '1px solid #444',
    background: '#2a2a2a',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerIcon: { fontSize: 14 },
  headerTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ddd',
    flex: 1,
  },
  badge: {
    background: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 10,
    padding: '1px 6px',
    minWidth: 16,
    textAlign: 'center',
  },
  chevron: { fontSize: 10, color: '#666' },
  compactSummary: {
    padding: '0 12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  compactItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
  },
  compactTitle: {
    color: '#aaa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    marginRight: 8,
  },
  compactDday: {
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  compactMore: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
  },
  body: { padding: '0 8px 8px' },
  loginNotice: {
    padding: '12px',
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  category: {
    marginBottom: 6,
  },
  catHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 4px 2px',
  },
  catIcon: { fontSize: 12 },
  catLabel: { fontSize: 11, color: '#999', flex: 1 },
  addBtn: {
    background: 'none',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#aaa',
    fontSize: 12,
    cursor: 'pointer',
    padding: '0 5px',
    lineHeight: '18px',
  },
  emptyItem: {
    padding: '6px 8px',
    fontSize: 12,
    color: '#555',
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'background 0.1s',
  },
  alarmItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  alarmInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    flex: 1,
    minWidth: 0,
  },
  alarmTitle: {
    fontSize: 12,
    color: '#ccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  alarmDate: { fontSize: 10, color: '#666' },
  dday: {
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    marginLeft: 8,
  },
  editPanel: {
    marginTop: 8,
    padding: 10,
    background: '#252525',
    borderRadius: 8,
    border: '1px solid #444',
  },
  editHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ddd',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: '7px 8px',
    marginBottom: 6,
    borderRadius: 6,
    border: '1px solid #444',
    background: '#1a1a1a',
    color: '#ddd',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  },
  editActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  saveBtn: {
    flex: 1,
    padding: '6px 0',
    borderRadius: 6,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  delBtn: {
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #555',
    background: 'transparent',
    color: '#aaa',
    fontSize: 12,
    cursor: 'pointer',
  },
};
