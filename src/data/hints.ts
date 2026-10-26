// 수능 지리 힌트 모드 문제 데이터 (테스트용).
// 국가 문제는 world-atlas 의 ISO 숫자 코드(countryId)로, 도시 문제는 좌표(lon/lat)로 정답을 판정한다.
// 새 문제는 이 배열에 객체를 추가하기만 하면 된다.

export type HintTag = '기후' | '지형' | '자원' | '농업' | '산업' | '인구·문화';

interface HintBase {
  id: string;
  /** 정답 이름 (해설·오답 노트에 표시) */
  answer: string;
  /** 문제로 나오는 교과서식 설명 */
  hint: string;
  /** 기후 특징 (쾨펜 기후 구분 포함) */
  climate: string;
  /** 대표 자원·산물 */
  resources: string[];
  tags: HintTag[];
  /** 정답 공개 후 보여 줄 해설 */
  explanation: string;
}

export interface CountryHint extends HintBase {
  kind: 'country';
  countryId: string;
}

export interface CityHint extends HintBase {
  kind: 'city';
  countryId: string; // 도시가 속한 나라 (학습 모드 연결용)
  lon: number;
  lat: number;
}

export type GeoHint = CountryHint | CityHint;

export const GEO_HINTS: GeoHint[] = [
  {
    id: 'argentina',
    kind: 'country',
    countryId: '032',
    answer: '아르헨티나',
    hint: '온대 초원인 팜파스에서 기업적 목축과 밀 재배가 활발하며, 소고기 수출이 많은 남아메리카 국가는?',
    climate: '온대 기후(Cfa) · 남부는 건조 기후',
    resources: ['소고기', '밀', '대두'],
    tags: ['농업', '기후'],
    explanation: '팜파스는 비옥한 온대 초원으로, 대규모 기업적 목축과 밀·대두 재배가 이루어진다.',
  },
  {
    id: 'brazil',
    kind: 'country',
    countryId: '076',
    answer: '브라질',
    hint: '세계 최대의 열대 우림(셀바스)이 분포하고, 철광석·커피·대두 수출이 많은 남아메리카 최대 국가는?',
    climate: '열대 우림 기후(Af) · 열대 사바나 기후(Aw)',
    resources: ['철광석', '커피', '대두', '사탕수수'],
    tags: ['기후', '자원', '농업'],
    explanation: '아마존강 유역의 셀바스는 세계 최대 열대 우림이며, 카라자스 철광산과 커피 플랜테이션이 유명하다.',
  },
  {
    id: 'chile',
    kind: 'country',
    countryId: '152',
    answer: '칠레',
    hint: '세계 최대의 구리 생산국으로, 남북으로 길게 뻗어 북부에는 아타카마 사막이 나타나는 국가는?',
    climate: '북부 사막 기후(BW) · 중부 지중해성 기후(Cs) · 남부 서안 해양성 기후(Cfb)',
    resources: ['구리', '리튬', '포도(와인)'],
    tags: ['자원', '기후', '지형'],
    explanation: '안데스산맥을 따라 남북으로 길어 기후가 다양하며, 추키카마타 등 대규모 구리 광산이 있다.',
  },
  {
    id: 'australia',
    kind: 'country',
    countryId: '036',
    answer: '오스트레일리아',
    hint: '국토의 대부분이 건조 기후이며, 철광석·석탄 수출이 많고 대찬정 분지에서 양을 기르는 국가는?',
    climate: '건조 기후(BW·BS)가 대부분 · 남동부 온대 기후',
    resources: ['철광석', '석탄', '양모', '보크사이트'],
    tags: ['기후', '자원', '농업'],
    explanation: '내륙은 사막과 스텝이며, 대찬정 분지의 지하수를 이용한 목양업과 서부 필바라 지역의 철광석이 유명하다.',
  },
  {
    id: 'saudi',
    kind: 'country',
    countryId: '682',
    answer: '사우디아라비아',
    hint: '국토 대부분이 사막 기후이며, 세계적인 석유 수출국이자 이슬람교 성지 메카가 있는 국가는?',
    climate: '사막 기후(BW)',
    resources: ['석유', '천연가스'],
    tags: ['자원', '기후', '인구·문화'],
    explanation: '페르시아만 연안에 대규모 유전이 분포하며, 이슬람교 최대 성지인 메카와 메디나가 있다.',
  },
  {
    id: 'india',
    kind: 'country',
    countryId: '356',
    answer: '인도',
    hint: '계절풍(몬순)의 영향으로 여름에 비가 집중되며, 아삼 지방의 차와 데칸고원의 목화 재배로 유명한 국가는?',
    climate: '열대 몬순 기후(Am) · 사바나 기후(Aw)',
    resources: ['차', '목화', '쌀', '철광석'],
    tags: ['기후', '농업'],
    explanation: '여름 계절풍이 많은 비를 내려 벼농사가 활발하고, 아삼 지방의 차·데칸고원의 흑색토(레구르)에서 목화를 재배한다.',
  },
  {
    id: 'russia',
    kind: 'country',
    countryId: '643',
    answer: '러시아',
    hint: '국토 면적이 세계에서 가장 넓고, 냉대 기후의 타이가가 넓게 분포하며 천연가스 수출이 많은 국가는?',
    climate: '냉대 기후(Df·Dw) · 북부 한대 기후(ET)',
    resources: ['천연가스', '석유', '목재'],
    tags: ['기후', '자원'],
    explanation: '시베리아의 침엽수림(타이가)은 세계 최대 규모이며, 파이프라인으로 유럽·아시아에 천연가스를 수출한다.',
  },
  {
    id: 'norway',
    kind: 'country',
    countryId: '578',
    answer: '노르웨이',
    hint: '빙하 침식으로 형성된 피오르 해안이 발달하고, 북해 유전에서 석유·천연가스를 생산하는 북유럽 국가는?',
    climate: '서안 해양성 기후(Cfb) · 내륙 냉대 기후',
    resources: ['석유', '천연가스', '수산물(연어)'],
    tags: ['지형', '자원'],
    explanation: '빙식곡에 바닷물이 들어와 만들어진 피오르가 해안을 따라 발달하며, 북해 유전 개발로 소득 수준이 높다.',
  },
  {
    id: 'indonesia',
    kind: 'country',
    countryId: '360',
    answer: '인도네시아',
    hint: '환태평양 조산대에 위치한 세계 최대의 섬나라로, 팜유 생산량이 세계 1위인 국가는?',
    climate: '열대 우림 기후(Af)',
    resources: ['팜유', '석탄', '천연고무', '주석'],
    tags: ['지형', '농업', '자원'],
    explanation: '1만 7천여 개의 섬으로 이루어져 화산·지진이 잦으며, 열대 우림을 개간한 기름야자 플랜테이션이 많다.',
  },
  {
    id: 'quito',
    kind: 'city',
    countryId: '218',
    lon: -78.47,
    lat: -0.18,
    answer: '키토 (에콰도르)',
    hint: '적도 부근이지만 해발 약 2,800m의 고산 지대에 있어, 연중 봄과 같은 기후가 나타나는 수도는?',
    climate: '고산 기후 · 연교차가 매우 작음',
    resources: ['바나나(저지대)', '석유'],
    tags: ['기후', '지형'],
    explanation: '안데스산맥의 고산 도시로, 적도에 있지만 해발 고도가 높아 연중 기온이 13~14℃ 정도로 온화하다.',
  },
  {
    id: 'rome',
    kind: 'city',
    countryId: '380',
    lon: 12.5,
    lat: 41.9,
    answer: '로마 (이탈리아)',
    hint: '여름은 고온 건조하고 겨울은 온난 습윤한 지중해성 기후 지역으로, 수목 농업(포도·올리브)이 발달한 나라의 수도는?',
    climate: '지중해성 기후(Cs)',
    resources: ['올리브', '포도', '코르크'],
    tags: ['기후', '농업'],
    explanation: '여름에 아열대 고압대의 영향으로 건조해 올리브·포도 같은 수목 작물을 재배한다.',
  },
  {
    id: 'dubai',
    kind: 'city',
    countryId: '784',
    lon: 55.27,
    lat: 25.2,
    answer: '두바이 (아랍에미리트)',
    hint: '사막 기후 지역에 있으며, 석유 수입을 바탕으로 관광·금융·항공 교통의 중심지로 성장한 페르시아만 연안 도시는?',
    climate: '사막 기후(BW)',
    resources: ['석유', '관광·금융 서비스'],
    tags: ['기후', '산업'],
    explanation: '석유 의존도를 낮추기 위해 인공섬·초고층 건물·국제공항 등 관광과 서비스 산업을 육성했다.',
  },
];
