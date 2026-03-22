// 전역 에러 핸들러
export function errorHandler(err, req, res, next) {
  console.error(`❌ [${req.method} ${req.path}]`, err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? '서버 오류가 발생했습니다' : err.message,
  });
}

// async 라우트 래퍼
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
