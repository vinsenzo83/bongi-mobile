import ActionButtons from './ActionButtons.jsx';
import ProductCard from './ProductCard.jsx';
import CompareTable from './CompareTable.jsx';
import InlineForm from './InlineForm.jsx';
import MobilePriceCard from './MobilePriceCard.jsx';
import RentalCard from './RentalCard.jsx';
import { useIsMobile } from '../../hooks/useIsMobile.js';

export default function MessageBubble({ message, onAction }) {
  const isUser = message.role === 'user';
  const isMobile = useIsMobile();

  return (
    <div style={{ ...styles.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={styles.avatar}>🐟</div>}

      <div style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.aiBubble),
        ...(isMobile ? styles.bubbleMobile : {}),
      }}>
        {/* 마크다운 렌더링 */}
        <div
          style={styles.content}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '') }}
        />

        {/* 리치 UI 요소 */}
        {message.ui_elements?.map((el, i) => (
          <RichElement key={i} element={el} onAction={onAction} />
        ))}
      </div>

      {isUser && <div style={styles.userAvatar}>👤</div>}
    </div>
  );
}

function RichElement({ element, onAction }) {
  if (!element) return null;

  switch (element.type) {
    case 'actions':
      return <ActionButtons buttons={element.buttons} onAction={onAction} />;
    case 'product_cards':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {element.products?.map((p, i) => (
            <ProductCard key={i} product={p} onAction={onAction} />
          ))}
        </div>
      );
    case 'rental_cards':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {element.products?.map((p, i) => (
            <RentalCard key={i} product={p} onAction={onAction} />
          ))}
        </div>
      );
    case 'compare_table':
      return <CompareTable items={element.items} onAction={onAction} />;
    case 'mobile_price_cards':
      return (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {element.items?.map((item, i) => {
              const carrierKey = { 'SK': 'skt', 'KT': 'kt', 'LG U+': 'lg' }[item.통신사] || '';
              const services = element.services?.[item.통신사] || element.services?.[carrierKey] || [];
              const plan = element.plans?.[item.통신사] || element.plans?.[carrierKey] || null;
              return <MobilePriceCard key={i} item={item} services={services} plan={plan} onAction={onAction} />;
            })}
          </div>
          {element.date && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 8, textAlign: 'center' }}>
              📅 {element.date} 기준 시세 | 변동될 수 있으며 자세한 내용은 매장에 문의 바랍니다
            </div>
          )}
        </div>
      );
    case 'form':
      return (
        <InlineForm
          fields={element.fields}
          submitLabel={element.submitLabel}
          onSubmit={values => {
            const parts = Object.entries(values).map(([k, v]) => `${k}: ${v}`).join(', ');
            onAction(`상담 신청합니다. ${parts}`);
          }}
        />
      );
    default:
      return null;
  }
}

// 마크다운 테이블 → HTML 테이블
function renderTable(tableLines) {
  const rows = tableLines.map(line =>
    line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
  );
  if (rows.length < 2) return '';

  const header = rows[0];
  // 구분선(---|---) 스킵
  const startIdx = /^[-:\s]+$/.test(rows[1].join('')) ? 2 : 1;
  const body = rows.slice(startIdx);

  const thCells = header.map(h =>
    `<th style="padding:6px 12px;border-bottom:2px solid #444;text-align:left;color:#fff;font-size:13px;white-space:nowrap">${renderInline(h)}</th>`
  ).join('');

  const bodyRows = body.map(row => {
    const cells = row.map(c =>
      `<td style="padding:5px 12px;border-bottom:1px solid #333;font-size:13px;white-space:nowrap">${renderInline(c)}</td>`
    ).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:8px 0"><table style="border-collapse:collapse;width:max-content;min-width:100%;background:#1a1a1a;border-radius:8px">`
    + `<thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

// 안전한 이미지 URL 검증 (javascript: 프로토콜 차단)
function isSafeImageUrl(url) {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

// 인라인 마크다운 (볼드, 이탤릭, 코드, 이미지)
function renderInline(text) {
  if (!text) return '';
  return text
    // 이미지: ![alt](url)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      if (!isSafeImageUrl(url)) return `![${alt}](${url})`;
      const safeAlt = alt.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeUrl = url.replace(/"/g, '&quot;');
      return `<img src="${safeUrl}" alt="${safeAlt}" style="max-width:120px;max-height:120px;border-radius:8px;margin:8px 0;display:block;object-fit:contain;background:#fff;padding:4px" loading="lazy" />`;
    })
    .replace(/`([^`]+)`/g, '<code style="background:#333;padding:1px 6px;border-radius:4px;font-size:13px;color:#7ee787">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// 마크다운 → HTML (테이블 지원)
function renderMarkdown(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const parts = [];
  let tableBuffer = [];

  for (const line of lines) {
    const isTableLine = /^\|.*\|/.test(line.trim());

    if (isTableLine) {
      tableBuffer.push(line.trim());
    } else {
      if (tableBuffer.length > 0) {
        parts.push(renderTable(tableBuffer));
        tableBuffer = [];
      }
      // 일반 텍스트
      parts.push(renderInline(line));
    }
  }

  // 마지막 테이블 버퍼 처리
  if (tableBuffer.length > 0) {
    parts.push(renderTable(tableBuffer));
  }

  return parts.join('<br/>');
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#5b5fc7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    flexShrink: 0,
    marginTop: 2,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: '10px 16px',
    lineHeight: 1.7,
    fontSize: 15,
  },
  bubbleMobile: {
    maxWidth: '88%',
    fontSize: 14,
    padding: '8px 12px',
  },
  userBubble: {
    background: '#303030',
    borderBottomRightRadius: 4,
    color: '#ececec',
  },
  aiBubble: {
    background: 'transparent',
    borderBottomLeftRadius: 4,
    color: '#d1d5db',
  },
  content: {
    wordBreak: 'break-word',
    overflowX: 'auto',
  },
};
