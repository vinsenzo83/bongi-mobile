import { useState } from 'react';

export default function InlineForm({ fields, onSubmit, submitLabel }) {
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = () => {
    if (submitted) return;
    // 필수 필드 확인
    const missing = (fields || []).filter(f => f.required && !values[f.key]?.trim());
    if (missing.length > 0) return;

    setSubmitted(true);
    onSubmit(values);
  };

  if (submitted) {
    return (
      <div style={styles.confirmed}>
        ✅ 접수 완료! 곧 연락드릴게요.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {(fields || []).map(field => (
        <div key={field.key} style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label} {field.required && <span style={{ color: '#f87171' }}>*</span>}
          </label>
          <input
            type={field.type || 'text'}
            placeholder={field.placeholder || ''}
            value={values[field.key] || ''}
            onChange={e => handleChange(field.key, e.target.value)}
            style={styles.input}
          />
        </div>
      ))}
      <button onClick={handleSubmit} style={styles.submitBtn}>
        {submitLabel || '신청하기'}
      </button>
    </div>
  );
}

const styles = {
  container: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#999',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#ececec',
    fontSize: 14,
    outline: 'none',
  },
  submitBtn: {
    padding: '9px 0',
    borderRadius: 8,
    border: 'none',
    background: '#5b5fc7',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  confirmed: {
    background: '#0f2d1e',
    border: '1px solid #166534',
    borderRadius: 10,
    padding: '10px 14px',
    marginTop: 8,
    fontSize: 14,
    color: '#4ade80',
  },
};
