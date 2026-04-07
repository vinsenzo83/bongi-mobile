/**
 * 이미지를 자동 리사이즈하여 base64로 반환
 * @param {File} file - 원본 이미지 파일
 * @param {Object} options
 * @param {number} options.maxWidth - 최대 너비 (기본 1200)
 * @param {number} options.maxHeight - 최대 높이 (기본 1200)
 * @param {number} options.quality - JPEG 품질 0~1 (기본 0.8)
 * @param {number} options.maxSizeKB - 최대 파일 크기 KB (기본 1024 = 1MB)
 * @returns {Promise<string>} base64 데이터 URL
 */
export default function resizeImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    maxSizeKB = 1024,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
      img.onload = () => {
        let { width, height } = img;

        // 리사이즈 비율 계산
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 품질 단계적 감소로 목표 크기 이하로
        let q = quality;
        let result = canvas.toDataURL('image/jpeg', q);

        while (result.length * 0.75 > maxSizeKB * 1024 && q > 0.3) {
          q -= 0.1;
          result = canvas.toDataURL('image/jpeg', q);
        }

        resolve(result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
