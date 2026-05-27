import rateLimit from 'express-rate-limit';

// 일반 API (분당 100회)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 인증 API (분당 10회 — 브루트포스 방지)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 신청 API (분당 5회 — 스팸 방지)
export const applicationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '신청 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 파일 업로드 API (분당 15회·5MB×15 = 75MB cap per IP — Storage 폭증 방지)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: '업로드 요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
