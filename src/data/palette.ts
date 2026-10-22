// 여러 개를 선택했을 때 서로 구분되도록 돌아가며 쓰는 색 (흰 바탕에서 잘 보이는 색)
export const SELECTION_COLORS = [
  '#3b82f6', // 파랑
  '#f97316', // 주황
  '#10b981', // 초록
  '#a855f7', // 보라
  '#ef4444', // 빨강
  '#eab308', // 노랑
  '#06b6d4', // 청록
  '#ec4899', // 분홍
];

export const colorAt = (i: number) => SELECTION_COLORS[i % SELECTION_COLORS.length];
