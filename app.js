'use strict';
// 개발행위 1차 판단 (제천시 전역) — 판단 규칙은 rules.js(판단규칙표 엑셀에서 생성)를 따릅니다.
const R = window.RULES;
const $ = id => document.getElementById(id);
// 제천시 법정 읍·면·리, 동 (브이월드 행정구역 LT_C_ADEMD_INFO·LT_C_ADRI_INFO, 2026. 10. 16. 조회, 법정동코드 순)
const RI = {
  '봉양읍': ['주포리', '장평리', '미당리', '명도리', '봉양리', '명암리', '학산리', '옥전리', '구학리', '팔송리', '연박리', '원박리', '구곡리', '공전리', '마곡리', '삼거리'],
  '금성면': ['구룡리', '성내리', '월굴리', '중전리', '포전리', '활산리', '사곡리', '적덕리', '진리', '월림리', '위림리', '양화리', '대장리', '동막리'],
  '청풍면': ['읍리', '연곡리', '광의리', '계산리', '황석리', '후산리', '사오리', '부산리', '장선리', '단돈리', '방흥리', '오산리', '진목리', '양평리', '도곡리', '대류리', '신리', '용곡리', '연론리', '단리', '물태리', '도리', '실리곡리', '북진리', '도화리', '교리', '학현리'],
  '수산면': ['수산리', '내리', '적곡리', '수곡리', '수리', '대전리', '계란리', '괴곡리', '원대리', '다불리', '전곡리', '구곡리', '도전리', '율지리', '지곡리', '서곡리', '오티리', '성리', '상천리', '하천리', '능강리', '고명리'],
  '덕산면': ['도전리', '성암리', '신현리', '수산리', '월악리', '도기리', '선고리'],
  '한수면': ['황강리', '서창리', '덕곡리', '한천리', '역리', '북노리', '상노리', '탄지리', '복평리', '송계리'],
  '백운면': ['평동리', '운학리', '덕동리', '화당리', '도곡리', '방학리', '모정리', '애련리', '원월리'],
  '송학면': ['무도리', '장곡리', '입석리', '시곡리', '도화리', '포전리', '송한리', '오미리'],
};
const DONG = ['의림동', '서부동', '동현동', '남천동', '교동', '중앙로1가', '중앙로2가', '명동', '화산동', '영천동', '하소동', '신월동', '청전동', '모산동', '고암동', '장락동', '흑석동', '두학동', '고명동', '신백동', '강제동', '명지동', '산곡동', '왕암동', '천남동', '신동', '자작동', '대랑동'];
const isDong = emd => DONG.includes(emd);
// 토지이용계획 코드 UQS~UQY는 도시·군계획시설(교통·공간·유통공급·공공문화체육·방재·보건위생·환경기초)
const isFacility = u => /^UQ[S-Y]/.test(u.code || '') || /^(대로|중로|소로|광로)/.test(u.name);
const SOLAR_ROW = 68, LIVESTOCK_ROW = 61;
const NEW_SOLAR_DATE = '2026-09-18';
const RANK = { NA: 0, OK: 1, COND: 2, CK: 3, NG: 4 };
const LABEL = { NA: '허가 대상 아님', OK: '가능', COND: '조건부 가능', CK: '확인 필요', NG: '불가' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 받침에 따라 "이라/라"
const iRa = w => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '이라' : '라'); };
const fmt = n => Math.round(n).toLocaleString('ko-KR');
const fmtA = n => (+n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });   // 대장 면적은 소수점까지

// ---------- 인증키 ----------
function getKey() { try { return localStorage.getItem('vworldKey') || ''; } catch (e) { return ''; } }
function setKey(v) { try { localStorage.setItem('vworldKey', v); } catch (e) {} }
function refreshKeyCard() { $('keyCard').classList.toggle('hide', !!getKey()); }
$('saveKey').onclick = () => { setKey($('key').value.trim()); $('key').value = ''; refreshKeyCard(); if (map) { map.remove(); map = null; } };
$('showKey').onclick = e => { e.preventDefault(); $('keyCard').classList.remove('hide'); };
refreshKeyCard();
{ const m = (document.querySelector('script[src*="app.js"]') || {}).src?.match(/v=([0-9-]+)/); if ($('ver')) $('ver').textContent = '화면 버전 ' + (m ? m[1] : '-'); }

// ---------- 입력 화면 ----------
$('emd').innerHTML = `<optgroup label="읍·면">${Object.keys(RI).map(e => `<option>${e}</option>`).join('')}</optgroup>` +
  `<optgroup label="동">${DONG.map(e => `<option>${e}</option>`).join('')}</optgroup>`;
// 동은 리가 없으므로 리 칸을 막음
function fillRi() {
  const e = $('emd').value;
  $('ri').innerHTML = isDong(e) ? '<option value="">(동은 리 없음)</option>' : '<option value="">리 선택</option>' + RI[e].map(r => `<option>${r}</option>`).join('');
  $('ri').disabled = isDong(e);
}
$('emd').addEventListener('change', fillRi);
fillRi();
function fillActs(filter) {
  const q = (filter || '').replace(/\s/g, '');
  const groups = {};
  R.acts.forEach(a => {
    const hay = (a.label + ',' + a.alias + ',' + (a.row ? R.rows[a.row].cat : '')).replace(/\s/g, '');
    if (q && !hay.includes(q)) return;
    const g = a.kind === '개발행위' ? '개발행위(건물 없이)' : (a.row ? (a.id > 64 ? '자주 묻는 것' : R.rows[a.row].cat) : '기타');
    (groups[g] = groups[g] || []).push(a);
  });
  const rank = k => (k === '자주 묻는 것' ? 0 : k === '개발행위(건물 없이)' ? 1 : 2);
  const keys = Object.keys(groups).sort((x, y) => rank(x) - rank(y));
  const prev = $('act').value;
  $('act').innerHTML = (keys.length ? (q ? '' : '<option value="">하려는 일 선택</option>') : '<option value="">찾는 결과가 없습니다</option>') +
    keys.map(g => `<optgroup label="${esc(g)}">` + groups[g].map(a => `<option value="${a.id}">${esc(a.label)}</option>`).join('') + '</optgroup>').join('');
  if ([...$('act').options].some(o => o.value === prev)) $('act').value = prev;
  renderOpts();
}
$('actSearch').addEventListener('input', e => fillActs(e.target.value));
$('act').addEventListener('change', renderOpts);
const actOf = () => R.acts.find(a => String(a.id) === $('act').value);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function numBox(id, label, ph) { return `<div><label class="f">${label}</label><input type="number" id="${id}" inputmode="decimal" placeholder="${ph || ''}"></div>`; }
function selBox(id, label, opts) { return `<div><label class="f">${label}</label><select id="${id}">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div>`; }
function renderOpts() {
  const a = actOf();
  let h = '';
  if (!a) { $('opts').innerHTML = ''; return; }
  const yn = [['', '선택'], ['n', '없음'], ['y', '있음']];
  if (a.row === SOLAR_ROW) {
    h = (a.label.includes('건물 위') ? numBox('o_ton', '태양광 설비 무게(톤)') + numBox('o_m3', '부피(㎥)') + numBox('o_m2', '수평투영면적(㎡)') : selBox('o_form', '사업 구분', [['ground', '일반 사업용(전기 판매)'], ['self', '자가소비용(자기 집·공장에서 씀)'], ['resident', '주민참여형 발전사업'], ['public', '국가·지자체·공공기관 설치'], ['village', '마을공동사업(주민 동의)']])) +
      `<div><label class="f">신청일(상담이면 오늘)</label><input type="date" id="o_date" value="${today()}"></div>`;
  } else if (a.label.startsWith('공작물')) {
    h = numBox('o_ton', '무게(톤)') + numBox('o_m3', '부피(㎥)') + numBox('o_m2', '수평투영면적(㎡)') +
      selBox('o_report', '높이 2m 넘는 옹벽·담장 등 건축법 신고 공작물', [['', '선택'], ['n', '아님'], ['y', '해당']]);
  } else if (a.label.startsWith('토지 형질변경')) {
    h = numBox('o_cm', '절토·성토 높이(cm, 누적)') + selBox('o_jimok', '지목변경', yn) + selBox('o_pave', '포장', yn);
  } else if (a.label.startsWith('토석채취')) {
    h = numBox('o_m2', '채취 면적(㎡)') + numBox('o_m3', '채취 부피(㎥)');
  } else if (a.label.startsWith('토지분할')) {
    h = numBox('o_min', '분할 후 가장 작은 필지 면적(㎡)');
  } else if (a.label.startsWith('물건 적치')) {
    h = numBox('o_m2', '적치 면적(㎡)') + numBox('o_ton', '무게(톤)') + numBox('o_m3', '부피(㎥)') + selBox('o_month', '기간', [['', '선택'], ['y', '1개월 이상'], ['n', '1개월 미만']]);
  }
  h += selBox('o_type', '성장관리계획 유형(구역 안일 때, 도면 확인 후)', [['', '모름(세 유형 모두 보기)'], ['일반형', '일반형 (용도지역 기준 그대로)'], ['주거형', '주거형 (주택 위주)'], ['복합형', '복합형 (주택·상가 혼합)']]);
  const minorHint = a.row === SOLAR_ROW || a.label.startsWith('공작물')
    ? `<div class="hint"><b>개발행위허가 없이 설치할 수 있는 경우(경미한 행위)</b>: 무게·부피·수평투영면적이 <b>모두</b> 아래 기준 이하일 때 · 도시지역·지구단위계획구역 <b>50톤·50㎥·50㎡</b> · 그 밖의 지역(관리·농림) <b>150톤·150㎥·150㎡</b> · 자연환경보전지역은 해당 없음(허가 필요)${a.label.includes('건물 위') ? '' : ' · 높이 5m 넘는 태양광 등 건축법 신고 공작물은 제외'} . 농지·산지 전용 등 다른 허가는 별도 (국토계획법 시행령 제53조2호)</div>` : '';
  $('opts').innerHTML = `<div class="opts">${h}</div>` + (a.note ? `<div class="hint">${esc(a.note)}</div>` : '') + minorHint;
}
fillActs('');

// ---------- 브이월드 호출 (JSONP) ----------
let seq = 0;
function jsonp(url, params) {
  return new Promise((resolve, reject) => {
    const cb = 'vw' + (++seq) + Date.now();
    const s = document.createElement('script');
    const t = setTimeout(() => { done(); reject(new Error('브이월드 응답이 없습니다')); }, 20000);
    function done() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = d => { done(); resolve(d); };
    s.onerror = () => { done(); reject(new Error('브이월드에 연결하지 못했습니다')); };
    s.src = url + '?' + new URLSearchParams({ ...params, key: getKey(), callback: cb });
    document.head.appendChild(s);
  });
}
// 브이월드 토지 API(ned)는 가끔 '인증키 정보가 올바르지 않습니다'를 잘못 돌려주므로 두 번까지 다시 묻는다
async function ned(name, params) {
  let r;
  for (let i = 0; i < 3; i++) {
    r = await jsonp('https://api.vworld.kr/ned/data/' + name, params);
    if (!/INCORRECT_KEY/.test(JSON.stringify(r))) return r;
    await new Promise(ok => setTimeout(ok, 700));
  }
  return r;
}
function vwError(r) { const e = ((r || {}).response || {}).error; return e ? `브이월드 오류: ${e.text || e.code}` : ''; }
async function findParcel(addr) {
  const r = await jsonp('https://api.vworld.kr/req/search', { service: 'search', request: 'search', version: '2.0', type: 'address', category: 'parcel', format: 'json', size: '10', query: addr });
  if (r.response.status === 'ERROR') throw new Error(vwError(r));
  const items = (r.response.result || {}).items || [];
  const k = s => String(s).replace(/\s/g, '');
  return items.find(i => k(i.address.parcel) === k(addr));
}
async function landUses(pnu) {
  const r = await ned('getLandUseAttr', { pnu, format: 'json', numOfRows: '200', pageNo: '1' });
  const box = r.landUses || r.response || {};
  if (box.resultCode && box.resultCode !== '') throw new Error(`토지이용계획 조회 실패: ${box.resultMsg || box.resultCode}`);
  return [].concat(box.field || []).map(f => ({ name: f.prposAreaDstrcCodeNm, cn: f.cnflcAtNm, code: f.prposAreaDstrcCode || '' }));
}
async function landChar(pnu) {
  const r = await ned('getLandCharacteristics', { pnu, format: 'json', numOfRows: '100', pageNo: '1' });
  const box = r.landCharacteristicss || r.response || {};
  return [].concat(box.field || []).sort((a, b) => (b.stdrYear + b.lastUpdtDt).localeCompare(a.stdrYear + a.lastUpdtDt))[0] || null;
}
// 토지(임야)대장의 현재 면적·지목 (공부상 면적)
async function landReg(pnu) {
  const r = await ned('ladfrlList', { pnu, format: 'json', numOfRows: '10', pageNo: '1' });
  const box = r.ladfrlVOList || {};
  return [].concat(box.ladfrlVOList || []).find(x => x.lndpclAr) || null;
}
async function parcelGeom(pnu) {
  const r = await jsonp('https://api.vworld.kr/req/data', { service: 'data', request: 'GetFeature', data: 'LP_PA_CBND_BUBUN', attrFilter: `pnu:=:${pnu}`, geometry: 'true', format: 'json', crs: 'EPSG:4326' });
  const f = ((((r.response || {}).result || {}).featureCollection || {}).features || [])[0];
  if (!f) throw new Error(vwError(r) || '필지 경계를 받지 못했습니다.');
  return f;
}
async function buildings(bbox) {
  const out = [];
  for (let page = 1; page <= 4; page++) {
    const r = await jsonp('https://api.vworld.kr/req/data', { service: 'data', request: 'GetFeature', data: 'LT_C_BLDGINFO', geomFilter: `BOX(${bbox.join(',')})`, geometry: 'true', format: 'json', size: '1000', page: String(page), crs: 'EPSG:4326' });
    if (r.response.status === 'NOT_FOUND') break;
    if (r.response.status !== 'OK') throw new Error('주변 건물 자료 조회 실패: ' + (vwError(r) || r.response.status));
    out.push(...r.response.result.featureCollection.features);
    if (+r.response.page.total <= page) break;
  }
  return out;
}
// 주택 추정: 건축물 주용도코드 단독주택(01000~01003)·공동주택(02000~02003). 공관(01004)·기숙사(02004) 제외
const isHouse = f => /^(0100[0-3]|0200[0-3])$/.test(f.properties.usability || '');
const isUnknown = f => !f.properties.usability;

// ---------- 지도 ----------
let map, layer;
function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true });
  L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${getKey()}/Satellite/{z}/{y}/{x}.jpeg`, { maxZoom: 19, minZoom: 7 }).addTo(map);
  L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${getKey()}/Hybrid/{z}/{y}/{x}.png`, { maxZoom: 19, minZoom: 7 }).addTo(map);
  layer = L.layerGroup().addTo(map);
}
// 지도 크게 보기 / 작게 보기 (보던 위치·확대 정도는 그대로 둠)
const ICON_BIG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_SMALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const mapCard = () => document.querySelector('.mapcard');
const isBig = () => mapCard().classList.contains('big');
function setBig(on) {
  const ctr = map && map.getCenter(), z = map && map.getZoom();
  mapCard().classList.toggle('big', on);
  document.body.classList.toggle('mapbig', on);
  $('mapBig').innerHTML = on ? ICON_SMALL + '작게 보기' : ICON_BIG + '크게 보기';
  $('mapBig').setAttribute('aria-pressed', String(on));
  setTimeout(() => {
    if (map) { map.invalidateSize({ animate: false }); map.setView(ctr, z, { animate: false }); }
    if (!on) placeCards();
  }, 30);
}
setBig(false);
$('mapBig').onclick = () => setBig(!isBig());
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isBig()) setBig(false); });

// ---------- 판정 도우미 ----------
const ZONE_BY_API = Object.fromEntries(Object.entries(R.zones).map(([k, z]) => [z.api, k]));
const URBAN = /주거|상업|공업/;
function zoneGroup(z) {
  if (URBAN.test(z)) return 'urban';
  if (/녹지/.test(z)) return 'green';
  if (/관리/.test(z)) return 'mgmt';
  if (z === '농림') return 'agri';
  if (z === '자연환경보전') return 'nature';
  return 'other';
}
function scaleLimit(z) {
  if (/주거|상업/.test(z) || z === '자연녹지' || z === '생산녹지') return 10000;
  if (/공업/.test(z)) return 30000;
  if (z === '보전녹지' || z === '자연환경보전') return 5000;
  return 30000;
}
function judgeValue(z, v) {
  const zone = R.zones[z];
  if (!v) return { st: 'CK', text: '표에 값이 없습니다' };
  v = String(v).trim();
  if (/확인 필요|※/.test(v)) return { st: 'CK', text: v.replace(/^[○◎×]\s*/, '') };
  if (v.startsWith('×')) return { st: 'NG', text: '건축할 수 없는 용도' + (v.length > 1 ? ' — ' + v.slice(1).trim() : '') };
  const rest = v.slice(1).trim();
  const by = v.startsWith('◎') ? '조례로 허용' : '시행령으로 허용';
  const zc = v.startsWith('◎') && zone.common && zone.common.includes('◎') ? ' · ' + zone.common : '';
  if (rest) return { st: 'COND', text: `${by}, 조건: ${rest}${zc}`, zc: !!zc };
  if (v.startsWith('◎') && zone.common && zone.common.includes('◎')) return { st: 'COND', text: `${by}, 조건: ${zone.common}` };
  return { st: 'OK', text: by };
}
const FORM_NAME = { ground: '부지 위 · 일반 사업용', roof: '건물 위 설치', self: '부지 위 · 자가소비용', resident: '부지 위 · 주민참여형', public: '부지 위 · 공공기관 설치', village: '부지 위 · 마을공동사업' };
const formIs = f => `설치 형태(${FORM_NAME[f]})`;
function solarFormAllowed(text, form) {
  return (form === 'public' && /공공/.test(text)) || (form === 'self' && /자가소비/.test(text)) ||
    (form === 'roof' && /건축물 위|지붕/.test(text)) || (form === 'village' && /마을/.test(text));
}
// 성장관리계획 유형 설명 (시행지침 제7조 유형별 건축물 용도계획)
const GTYPE = {
  '일반형': '따로 막는 용도 없이 용도지역 기준을 그대로 따릅니다',
  '주거형': '주택 위주로 지키는 곳. 공장·창고·축사·사업용 태양광 등을 막습니다',
  '복합형': '주택과 가게가 섞인 곳. 축사·위험물 시설·사업용 태양광 등을 막습니다',
};
const SOLAR_EXC = '공공용·자가소비용·건물 위·마을공동사업';
function growthStatus(text, isSolar, form) {
  if (!text || text === '허용') return { st: 'OK', text: '막는 용도가 아니어서 용도지역 기준대로 판단합니다' };
  if (text.startsWith('불허')) return { st: 'NG', text: '이 유형에서는 지을 수 없는 용도(불허용도)입니다' + (text.replace(/^불허\s*/, '') ? ' — ' + text.replace(/^불허\s*/, '') : '') };
  if (text.startsWith('확인 필요')) return { st: 'CK', text };
  if (text.startsWith('권장')) return { st: 'OK', text: '권장 용도' + text.replace(/^권장/, '') + '입니다. 지키면 건폐율·용적률을 더 받을 수 있습니다(인센티브)' };
  if (text.startsWith('조건')) {
    if (isSolar) return solarFormAllowed(text, form)
      ? { st: 'OK', text: `태양광은 막는 용도지만 ${SOLAR_EXC}은 예외입니다. 이번 경우(${FORM_NAME[form]})는 예외에 해당해 가능합니다` }
      : { st: 'NG', text: `태양광은 막는 용도입니다. ${SOLAR_EXC}만 예외인데, 이번 경우(${FORM_NAME[form]})는 예외가 아닙니다` };
    return { st: 'COND', text: text.replace(/^조건:\s*/, '') };
  }
  return { st: 'OK', text };
}
function deliberation(z, act, uses, has) {
  const g = zoneGroup(z);
  if (g === 'urban') return { text: '주거·상업 1만㎡(공업 3만㎡) 이상 형질변경만 심의. 그 미만은 심의 없음', basis: '조례 제28조' };
  if (has(/자연취락지구|개발진흥지구|기반시설부담구역|준산업단지|공장입지유도/)) return { text: '심의 제외(자연취락지구 등 안)', basis: '영 제57조①1의2 가목' };
  if (has(/성장관리|지구단위계획/)) return { text: '심의 제외(성장관리계획·지구단위계획 수립 지역)', basis: '국토계획법 제59조②' };
  const r = act.row;
  const cond = ' 이 경우 "준공 후 용도변경 시 심의" 조건을 붙입니다.';
  const lowCons = z === '보전녹지' || z === '보전관리';
  let t = '형질변경이 따르면 원칙적으로 도시계획위원회 심의 대상';
  if (!r) t = '건축·공작물 설치 목적 형질변경이면 원칙적으로 심의 대상(형질변경만이면 규모 기준)';
  else if (r === 9 || r === 10) t = '대지 5천㎡ 미만·단독주택 10호 미만이면 심의 제외.' + cond;
  else if (r >= 11 && r <= 13) t = '대지 5천㎡ 미만·주택법 사업계획승인 대상이 아니면 심의 제외.' + cond;
  else if (r >= 14 && r <= 24) t = '대지 5천㎡ 미만이면 심의 제외.' + cond;
  else if (r === 25) t = '대지 5천㎡ 미만이면 심의 제외(다중생활시설은 심의 대상).' + cond;
  else if (r >= 26 && r <= 30) t = '대지 5천㎡ 미만이면 심의 제외.' + cond;
  else if (r >= 31 && r <= 33) t = '심의 대상(단란주점·안마시술소·노래연습장은 제외 대상 아님)';
  else if (r === 45) t = lowCons ? '심의 대상' : '유치원은 부지 1,500㎡ 미만이면 심의 제외, 중·고등학교는 심의 대상.' + cond;
  else if (r === 47) t = lowCons ? '심의 대상' : '아동 관련 시설(부지 1,500㎡ 미만)·노인여가복지시설(형질변경 1,500㎡ 이내)이면 심의 제외, 그 밖은 심의 대상.' + cond;
  else if (r === 54) t = z === '자연환경보전' ? '심의 대상' : '형질변경 660㎡ 이내면 심의 제외.' + cond;
  else if (r === 61 || r === 63) t = z === '자연환경보전' ? '심의 대상' : '부지 660㎡ 이내면 심의 제외.' + cond;
  return { text: t, basis: '영 제57조①1의2, 조례 제28조의2' };
}
// 공작물 경미한 행위 기준(영 제53조2호): 도시지역·지구단위 50, 그 밖 150, 자연환경보전 없음
function structLimit(z, has) {
  const g = zoneGroup(z);
  if (g === 'nature') return null;
  return (g === 'urban' || g === 'green' || has(/지구단위계획/)) ? 50 : 150;
}
function minorCheck(act, z, area, has, noReport) {
  // 경미한 행위(영 제53조). 값이 모두 있을 때만 판정
  const v = id => { const e = $(id); return e && e.value !== '' ? e.value : null; };
  const n = id => (v(id) === null ? null : Number(v(id)));
  const g = zoneGroup(z), dj = has(/지구단위계획/);
  const urbanStd = (g === 'urban' || g === 'green' || dj);
  const L = act.label;
  const res = (minor, why) => ({ st: minor ? 'NA' : 'COND', text: minor ? `경미한 행위 → 허가 대상 아님 (${why})` : `허가 대상 (${why})` });
  if (L.startsWith('공작물')) {
    const t = n('o_ton'), m3 = n('o_m3'), m2 = n('o_m2'), rep = noReport ? 'n' : v('o_report');
    if (t === null || m3 === null || m2 === null || !rep) return null;
    if (rep === 'y') return res(false, '건축법 시행령 제118조① 신고 공작물');
    if (g === 'nature') return res(false, '자연환경보전지역은 경미 기준 없음');
    const lim = urbanStd ? 50 : 150;
    return res(t <= lim && m3 <= lim && m2 <= lim, `기준 ${lim}톤·${lim}㎥·${lim}㎡ 이하`);
  }
  if (L.startsWith('토지 형질변경')) {
    const cm = n('o_cm'), jm = v('o_jimok'), pv = v('o_pave');
    if (cm === null || !jm || !pv) return null;
    const a1 = cm <= 50 && pv === 'n' && (g === 'urban' || jm === 'n');
    const a2 = (g === 'mgmt' || g === 'agri') && !dj && area && area <= 660 && jm === 'n';
    if (a1) return res(true, '높이 50cm 이내(누적), 포장 아님' + (g === 'urban' ? '' : ', 지목변경 없음'));
    if (a2) return res(true, `관리·농림 필지 총면적 ${fmtA(area)}㎡ ≤ 660㎡, 지목변경 없음`);
    const why = [cm > 50 && '높이 50cm 초과', pv === 'y' && '포장 포함', jm === 'y' && g !== 'urban' && '지목변경 있음',
      (g === 'mgmt' || g === 'agri') && !dj && area > 660 && `필지 ${fmtA(area)}㎡로 660㎡ 초과`].filter(Boolean).join(', ');
    return res(false, why || '경미 기준에 해당하지 않음');
  }
  if (L.startsWith('토석채취')) {
    const m2 = n('o_m2'), m3 = n('o_m3');
    if (m2 === null || m3 === null) return null;
    if (g === 'nature') return res(false, '자연환경보전지역은 경미 기준 없음');
    const [a, b] = urbanStd ? [25, 50] : [250, 500];
    return res(m2 <= a && m3 <= b, `기준 ${a}㎡·${b}㎥ 이하`);
  }
  if (L.startsWith('물건 적치')) {
    const mo = v('o_month');
    if (g === 'urban' || g === 'agri') return { st: 'NA', text: '주거·상업·공업·농림지역의 물건 적치는 허가 대상 아님' };
    if (mo === 'n') return { st: 'NA', text: '1개월 미만 적치는 허가 대상 아님' };
    const m2 = n('o_m2'), t = n('o_ton'), m3 = n('o_m3');
    if (!mo || m2 === null || t === null || m3 === null) return null;
    if (g === 'nature') return res(false, '자연환경보전지역은 경미 기준 없음');
    const [a, b, c] = (g === 'green' || dj) ? [25, 50, 50] : [250, 500, 500];
    return res(m2 <= a && t <= b && m3 <= c, `기준 ${a}㎡·${b}톤·${c}㎥ 이하`);
  }
  if (L.startsWith('토지분할')) {
    const mn = n('o_min');
    if (g === 'urban') return { st: 'COND', text: '주거·상업·공업지역은 분할제한면적(건축조례 제30조) 이상·너비 5m 초과면 허가 대상 아님' };
    if (mn === null) return null;
    const lim = g === 'green' ? 200 : 60;
    return mn >= lim ? { st: 'COND', text: `허가 대상. 최소면적 ${lim}㎡ 이상 충족. 개발이 불가능한 토지면 택지식 분할 금지·1필지당 2년간 5필지 이하` }
      : { st: 'NG', text: `분할 후 ${fmt(mn)}㎡ < 최소면적 ${lim}㎡ (조례 제25조①)` };
  }
  return null;
}

// 소규모 환경영향평가·재해영향평가 기준 안내(면적은 묻지 않고 기준만 표시, 결론은 바꾸지 않음)
function impactCrit(crit, z, act, live, has, hasFull, lim, isSolar) {
  const I = R.impact || [];
  const g = zoneGroup(z);
  const L = act.label;
  const isSplit = /^토지분할/.test(L), isPile = /^물건 적치/.test(L);
  const parts = [], notes = [];
  if (isSplit) parts.push('토지분할은 개발사업이 아니므로 해당 없음');
  else {
    if (g === 'green') parts.push(`${z}지역(녹지)은 등록체육시설(체육시설법 제12조)·골재채취예정지·어항·도시·군계획시설·지구단위계획 사업으로서 10,000㎡ 이상일 때만 대상 → 일반 건축·형질변경은 해당 없음`);
    else if (g === 'urban') parts.push(`${z}지역은 등록체육시설·골재채취예정지·어항·도시·군계획시설·지구단위계획 사업으로서 60,000㎡ 이상일 때만 대상 → 일반 건축·형질변경은 해당 없음`);
    else {
      const zr = I.find(r => r.kind === '소규모환경-용도지역' && r.name === z);
      if (zr) parts.push(`${z}지역은 사업면적 ${fmt(zr.area)}㎡ 이상이면 소규모 환경영향평가 대상(허가 전 협의)`);
    }
    const ov = I.filter(r => r.kind === '소규모환경-구역' && r.pat && !/산지/.test(r.name) && live.some(u => new RegExp(r.pat).test(u.name)));
    ov.forEach(r => {
      const u = live.find(x => new RegExp(r.pat).test(x.name));
      parts.push(`${u.name}${u.cn === '저촉' ? '(일부)' : ''}: ${r.text}`);
    });
    if (ov.length) notes.push('용도지역 기준과 구역 기준이 함께 해당하면 용도지역 기준은 빼고 구역 기준 중 작은 면적을 적용(비고 2)');
    if (has(/보전산지|임업용산지|공익용산지|준보전산지/)) notes.push('산지: 개발행위허가와 함께 받으면 산지 기준(4호) 대신 위 용도지역·구역 기준을 적용');
    if (z === '계획관리') {
      const t = isSolar ? '태양광(다른 사업으로 이미 조성된 유휴토지에 단순 공작물로 설치하는 경우만)' : isPile || act.row === 55 ? '야적장·적치장 등 창고' : act.row === 59 ? '주차시설(세차장 제외)' : act.row === 49 ? '운동장·체육관 등 체육시설' : '';
      if (t) notes.push(`계획관리 중 토지피복지도상 나지에서 3만㎡ 미만인 ${t}은 대상에서 제외(비고 4 아목)`);
    }
    if (act.row === LIVESTOCK_ROW && ['mgmt', 'agri', 'nature'].includes(g)) notes.push('축사는 가축분뇨 배출·처리시설 면적 합계 5,000㎡ 이상이면 대상(비고 7)');
    notes.push('둘 이상 지역에 걸치면 지역별 (면적÷기준면적)을 더해 1 이상이면 대상');
    notes.push('같은 사업자가 10년 안에 승인받은 곳 경계 50m 안에서 추가하면, 합계가 기준 이상이고 추가분이 기준의 30% 이상일 때 대상(하천·왕복 2차로 이상 도로·철도로 나뉘면 제외)');
    notes.push('충주호 등 광역상수도 호소 상류 1km 안이면 7,500㎡(공동주택 5,000㎡) 기준 → 원주지방환경청 확인');
  }
  crit.push(['소규모 환경영향평가', parts.join(' · '), '환경영향평가법 시행령 별표 4 (1~7호, 비고 2·4·7·8·9·11)', notes.join(' · ')]);

  let d;
  const dz = live.find(u => /자연재해위험개선지구|해일위험지구/.test(u.name));
  if (isSplit || isPile) d = '해당 없음(토지분할·물건적치는 협의 대상 아님)';
  else if (dz && hasFull(/자연재해위험개선지구|해일위험지구/)) d = `${dz.name} 안이라 면적과 관계없이 허가 전 재해영향평가 협의 필요`;
  else if (dz) d = `${dz.name}에 일부 걸침: 부지 전부가 지구 안이면 면적과 관계없이 협의`;
  else d = `보통의 개발행위는 해당 없음 — 부지 5,000㎡ 이상이면서 ${z} 허가 규모(${fmt(lim)}㎡)를 넘겨 허가하는 경우(충북 도시계획위원회 심의 등)만 대상`;
  const dn = (isSplit || isPile) ? '' : '같은 사업자의 인접 사업은 면적 합산 · 길이 2km 이상 선형사업은 면적과 관계없이 대상' + (act.row === 53 ? ' · 공장설립 승인으로 진행하면 부지 1만㎡ 이상이면 대상' : '');
  crit.push(['재해영향평가', d, '자연재해대책법 시행령 별표 1 (가목 1), 비고 1·3)', dn]);

  if (isSolar) crit.push(['환경영향평가', '태양광 발전시설용량 10만kW 이상이면 환경영향평가 대상', '환경영향평가법 시행령 별표 3']);
  else if (act.row === 53) crit.push(['환경영향평가', '공장설립 승인 사업면적 15만㎡ 이상이면 환경영향평가 대상', '환경영향평가법 시행령 별표 3']);
}

// ---------- 실행 ----------
function showMsg(t) { $('msg').textContent = t; $('msg').style.display = t ? 'block' : 'none'; }
$('run').onclick = run;
$('bunji').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

async function run() {
  showMsg('');
  if (!getKey()) { $('keyCard').classList.remove('hide'); showMsg('먼저 브이월드 인증키를 저장해 주십시오.'); return; }
  const emd = $('emd').value, ri = $('ri').value, bunji = $('bunji').value.trim().replace(/\s/g, ''), act = actOf();
  if (!isDong(emd) && !ri) { showMsg('리를 골라 주십시오.'); return; }
  if (!bunji) { showMsg('번지를 넣어 주십시오.'); return; }
  if (!/^\d+(-\d+)?$/.test(bunji)) { showMsg('번지는 숫자로 넣어 주십시오. 예: 123, 727-7'); return; }
  if (!act) { showMsg('하려는 일을 골라 주십시오.'); return; }
  const addr = `충청북도 제천시 ${emd} ${isDong(emd) ? '' : ri + ' '}${$('san').checked ? '산 ' : ''}${bunji}`;
  $('run').disabled = true; $('status').textContent = '브이월드에서 조회하는 중…';
  try {
    const hit = await findParcel(addr);
    if (!hit) throw new Error(`"${addr}"를 찾지 못했습니다. 리·번지·산 여부를 확인해 주십시오.`);
    const pnu = hit.id;
    const [uses, ch, reg, geom] = await Promise.all([landUses(pnu), landChar(pnu).catch(() => null), landReg(pnu).catch(() => null), parcelGeom(pnu)]);
    if (!uses.length) throw new Error('토지이용계획 자료를 받지 못했습니다.');
    const isSolar = act.row === SOLAR_ROW;
    const date = isSolar ? ($('o_date').value || today()) : today();
    const legacy = isSolar && date < NEW_SOLAR_DATE;
    const radius = legacy ? 300 : 200;
    let blds = [];
    const needB = isSolar || (act.row && R.growth[act.row] && R.growth[act.row].env);
    if (needB) {
      const buf = turf.buffer(geom, radius / 1000, { units: 'kilometers' });
      blds = await buildings(turf.bbox(buf));
    }
    $('status').textContent = '';
    render({ emd, addr, pnu, uses, ch, reg, geom, act, isSolar, date, legacy, blds });
  } catch (e) {
    showMsg(e.message); $('status').textContent = '';
  } finally { $('run').disabled = false; }
}

// ---------- 국토계획법 제76조⑤ 특별법 적용 지역 ----------
// 용도지역표 대신 농지법·산지관리법을 적용하는 지역에서 그 법에 허용 근거가 확인된 용도만 적음 (없으면 확인 필요)
const SPECIAL = {
  54: {   // 농업·임업·축산업·수산업용 창고
    '농업진흥구역': { st: 'COND', text: '다음 경우만 가능합니다. ① 농업인·농업법인이 자기가 생산한 농산물을 건조·보관하는 창고(자기 농지가 있는 읍·면 또는 바로 붙은 읍·면에 설치) ② 농업인이 공동으로 운영·사용하는 창고', basis: '농지법 제32조①3·2, 같은 법 시행령 제29조⑤1·③1', field: '농업인·농업법인 여부, 자기가 생산한 농산물 보관용인지, 자기 농지 소재 읍·면(신청 서류로 확인)' },
    '농업보호구역': { st: 'COND', text: '농업진흥구역에서 허용되는 경우(① 농업인·농업법인이 자기가 생산한 농산물을 건조·보관하는 창고, 자기 농지가 있는 읍·면 또는 바로 붙은 읍·면 ② 농업인 공동 창고)는 가능합니다. 그 밖의 창고는 농지법 시행령 제30조 확인', basis: '농지법 제32조②1, 같은 법 시행령 제29조⑤1·③1', field: '농업인·농업법인 여부, 자기가 생산한 농산물 보관용인지, 자기 농지 소재 읍·면(신청 서류로 확인)' },
    '임업용산지': { st: 'COND', text: '농림어업인·생산자단체·영농조합법인·농업회사법인이 부지 3천㎡ 미만으로 짓는 농축수산물 창고·농기계창고만 가능합니다', basis: '산지관리법 제12조①5, 같은 법 시행령 제12조⑤1다목', field: '신청인이 농림어업인·생산자단체·영농법인인지, 창고 부지 3천㎡ 미만인지' },
  },
};
const SPECIAL_LAW = { '농업진흥구역': '농지법', '농업보호구역': '농지법', '임업용산지': '산지관리법', '공익용산지': '산지관리법', '보전산지': '산지관리법' };

// ---------- 카드 배치 ----------
let boardCards = [];
function placeCards() {
  if (!boardCards.length || isBig()) return;   // 크게 보기 중에는 지도 칸 높이가 빠져 배치가 틀어지므로 작게 보기로 돌아올 때 다시 배치
  boardCards.forEach(e => e.remove());
  const cols = [$('col1'), $('col2'), $('col3')];
  const [first, second, ...rest] = boardCards;
  $('col2').appendChild(first);
  $('col3').appendChild(second);
  rest.forEach(e => cols.reduce((m, c) => (c.offsetHeight < m.offsetHeight ? c : m)).appendChild(e));
}
let placeTimer;
window.addEventListener('resize', () => { clearTimeout(placeTimer); placeTimer = setTimeout(placeCards, 150); });

// ---------- 판정과 화면 ----------
function render(c) {
  const { uses, ch, reg, geom, act, isSolar } = c;
  const live = uses.filter(u => u.cn !== '접함');
  const has = re => live.some(u => re.test(u.name));
  const hasFull = re => live.some(u => u.cn === '포함' && re.test(u.name));
  const steps = [];   // {k, st, text, basis}
  const field = [];
  const form = isSolar ? (act.label.includes('건물 위') ? 'roof' : $('o_form').value) : null;
  const gtype = $('o_type') ? $('o_type').value : '';
  const mapArea = turf.area(geom);
  let area = mapArea;
  // 면적
  let areaNote = `지도상 약 ${fmt(mapArea)}㎡`;
  const jimok = reg ? reg.lndcgrCodeNm : ch ? ch.lndcgrCodeNm : '';
  if (reg) {
    area = +reg.lndpclAr;
    areaNote = `${fmtA(area)}㎡ (${reg.regstrSeCodeNm || '토지대장'}${reg.lastUpdtDt ? ' ' + reg.lastUpdtDt + ' 기준' : ''}) · 지도상 약 ${fmt(mapArea)}㎡`;
  } else if (ch) {
    const a = +ch.lndpclAr, recent = +ch.stdrYear >= new Date().getFullYear() - 1, close = Math.abs(a - mapArea) / a <= 0.1;
    areaNote = `${fmt(a)}㎡ (토지특성 ${ch.stdrYear}년) · 지도상 약 ${fmt(mapArea)}㎡`;
    if (recent && close) area = a; else field.push('지적 면적: 토지대장 자료를 받지 못했고 토지특성 자료가 오래됐거나 지도 면적과 달라 토지대장으로 확인');
  } else field.push('지적 면적: 토지대장·토지특성 자료를 받지 못해 토지대장으로 확인(최근 분할·합병 필지일 수 있음)');

  // 1) 용도지역
  const zoneUses = live.filter(u => ZONE_BY_API[u.name]);
  const villagesAll = zoneUses.filter(u => u.name.endsWith('취락지구'));
  const villages = villagesAll.filter(u => u.cn === '포함');   // 필지 전체가 취락지구 안
  const bases = zoneUses.filter(u => !u.name.endsWith('취락지구'));
  const baseZone = bases.length ? ZONE_BY_API[(bases.find(u => u.cn === '포함') || bases[0]).name] : null;
  // 취락지구 안이면 취락지구 시트, 일부만 걸치면 용도지역과 취락지구를 함께 판정
  const ruleZones = (villages.length ? villages : [...bases, ...villagesAll]).map(u => ZONE_BY_API[u.name]);
  const partial = zoneUses.some(u => u.cn === '저촉') || bases.length > 1;
  if (!ruleZones.length) steps.push({ k: '용도지역', st: 'CK', text: has(/관리지역/) ? '관리지역이 세분되지 않았습니다(보전·생산·계획관리 확인)' : '용도지역을 확인하지 못했습니다', basis: '' });

  const isBuilding = !!act.row;
  const growthOn = has(/성장관리/) && ruleZones.includes('계획관리') && !villages.length;
  // 76조⑤
  const resolved = [];   // 특별법 허용 근거가 확인된 구역(빨간 경고로 결론을 묶지 않음)
  const z76 = (baseZone === '농림' && (hasFull(/농업진흥구역|농업보호구역/) || hasFull(/(^|[^준])보전산지|임업용산지|공익용산지/))) ||
    (baseZone === '자연환경보전' && hasFull(/공원구역|자연공원|상수원보호|(문화유산|문화재)보호구역/));
  const forestFull = hasFull(/(^|[^준])보전산지|임업용산지|공익용산지/), forestPart = !forestFull && has(/(^|[^준])보전산지|임업용산지|공익용산지/);

  if (isBuilding && ruleZones.length) {
    if (z76) {
      // 1줄: 국토계획법(용도지역표) 결과는 참고로 보여 주고, 2줄: 실제 적용 법의 결과로 판정
      const j = judgeValue(baseZone, R.zones[baseZone].vals[act.row]);
      const areas = baseZone === '농림'
        ? [hasFull(/농업진흥구역/) ? '농업진흥구역' : hasFull(/농업보호구역/) ? '농업보호구역' : null,
           hasFull(/공익용산지/) ? '공익용산지' : hasFull(/임업용산지/) ? '임업용산지' : forestFull ? '보전산지' : null].filter(Boolean)
        : [live.find(u => u.cn === '포함' && /공원구역|자연공원|상수원보호|(문화유산|문화재)보호구역/.test(u.name)).name];
      steps.push({ k: `국토계획법 (${baseZone}지역)`, st: j.st, info: true, text: `용도지역표로는 "${LABEL[j.st]}"(${j.text})입니다. 다만 이 필지는 ${iRa(areas.join('·'))} 이 기준 대신 ${[...new Set(areas.map(x => SPECIAL_LAW[x] || '해당 법'))].join('·')}을 적용합니다.`, basis: `${R.zones[baseZone].basis} · 국토계획법 제76조⑤3·4` });
      areas.forEach(x => {
        const law = SPECIAL_LAW[x] || '해당 법';
        const r = (SPECIAL[act.row] || {})[x];
        if (r) { steps.push({ k: `${x} → ${law} 적용`, st: r.st, text: r.text, basis: r.basis }); field.push(r.field); resolved.push(x); }
        else steps.push({ k: `${x} → ${law} 적용`, st: 'CK', text: law === '농지법' ? `농지법 제32조에서 정한 행위만 할 수 있습니다. 이 용도가 해당하는지 농정부서와 확인하십시오.` : law === '산지관리법' ? `산지관리법 제12조에 열거된 행위만 할 수 있어 그 밖의 용도는 불가 가능성이 큽니다. 산림부서와 확인하십시오.` : `${x} 관련 법의 행위제한으로 판단합니다. 담당 부서와 확인하십시오.`, basis: law === '농지법' ? '농지법 제32조' : law === '산지관리법' ? '산지관리법 제12조' : '' });
      });
    } else {
      ruleZones.forEach(z => {
        const j = judgeValue(z, R.zones[z].vals[act.row]);
        const common = R.zones[z].common && !R.zones[z].common.includes('◎') ? ` · 지역 공통: ${R.zones[z].common}` : '';
        const cn = (zoneUses.find(u => ZONE_BY_API[u.name] === z) || {}).cn;
        if (partial && j.st === 'NG' && cn === '저촉') { j.st = 'CK'; j.text += ' (필지 일부만 걸친 지역: 걸친 부분이 330㎡ 이하면 넓은 쪽 지역 기준)'; }
        steps.push({ k: `용도지역 (${z})`, st: j.st, text: j.text + common, basis: R.zones[z].basis, zc: j.zc });
      });
      if (partial) steps.push({ k: '걸친 지역', st: 'CK', text: '필지가 두 개 이상 용도지역에 걸치거나 일부만 저촉됩니다. 가장 작은 부분이 330㎡ 이하면 넓은 쪽 기준(국토계획법 제84조)', basis: '국토계획법 제84조, 영 제94조' });
    }
  }

  // 2) 성장관리
  let growthBox = '';
  if (isBuilding && growthOn) {
    const gv = R.growth[act.row];
    const res = ['일반형', '주거형', '복합형'].map(t => ({ t, ...growthStatus(gv[t], isSolar, form) }));
    const cell = r => `<div class="s-${r.st}"${gtype && gtype !== r.t ? ' style="opacity:.45"' : ''}><div class="gh"><b>${r.t}</b><span class="tag s-${r.st}" style="background:#fff">${LABEL[r.st]}</span></div><div class="gd">${GTYPE[r.t]}</div><div>${esc(r.text)}</div></div>`;
    let solarTable = '';
    if (isSolar) {
      const forms = ['ground', 'resident', 'self', 'public', 'village', 'roof'];
      const SHORT = { ground: '일반 사업용', resident: '주민참여형', self: '자가소비용', public: '공공기관 설치', village: '마을공동사업', roof: '건물 위 설치' };
      const mark = (f, t) => growthStatus(gv[t], true, f).st === 'OK' ? '<span class="ok">가능</span>' : '<span class="ng">불가</span>';
      solarTable = `<div class="gt"><div class="gt-h">태양광 종류별로 보면</div><table><thead><tr><th>태양광 종류<br>(건물 위 외에는 부지 위)</th><th>일반형</th><th>주거형</th><th>복합형</th></tr></thead><tbody>${forms.map(f => `<tr${f === form ? ' class="me"' : ''}><td>${esc(SHORT[f])}${f === form ? ' <span class="tag" style="background:#3182f6;color:#fff">이번 경우</span>' : ''}</td>${['일반형', '주거형', '복합형'].map(t => `<td>${mark(f, t)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="basis">주거형·복합형은 태양광 발전시설을 막는 용도로 정했지만 ${SOLAR_EXC}(주민 동의 + 국가·지자체 지원 + 마을공동체 직접 시행)은 예외입니다. 그래서 땅 위에 세워 전기를 파는 사업용만 막힙니다.</div></div>`;
    }
    growthBox = `<div class="sub2"><b>성장관리계획구역 유형별 판단</b>
      <div class="hint" style="margin-top:2px">이 필지는 성장관리계획구역 안입니다. 구역마다 일반형·주거형·복합형 중 하나로 정해져 있고, 유형마다 지을 수 없는 용도가 다릅니다. ${gtype ? `고르신 유형(${gtype})을 진하게 표시했습니다.` : '이 필지의 유형은 지형도면(제천 지형도면 모음)에서 찾아 확인합니다.'}</div>
      <div class="three">${res.map(cell).join('')}</div>${solarTable}
      <div class="basis">세 유형 공통: 건폐율 40%(권장 용도 등 인센티브 시 최대 50%) · 용적률 100%(최대 125%) · 도시계획위원회 심의 제외 · 체크리스트 제출. 근거: 성장관리계획 시행지침 제7·8·18조</div></div>`;
    if (gtype) { const r = res.find(x => x.t === gtype); steps.push({ k: `성장관리 (${gtype})`, st: r.st, text: r.text, basis: '성장관리계획 시행지침 제7조' }); }
    else {
      const sts = [...new Set(res.map(r => r.st))];
      if (sts.length === 1) steps.push({ k: '성장관리', st: sts[0], text: `세 유형 모두 ${LABEL[sts[0]]}`, basis: '성장관리계획 시행지침 제7조' });
      else if (!sts.some(s => s === 'NG' || s === 'CK')) steps.push({ k: '성장관리', st: sts.includes('COND') ? 'COND' : 'OK', text: '어느 유형이든 가능합니다. 유형에 따라 조건이 붙습니다(아래 "유형별 판단" 참고).', basis: '성장관리계획 시행지침 제7조' });
      else steps.push({ k: '성장관리', st: 'SPLIT', text: '성장관리계획구역 유형(일반형·주거형·복합형)에 따라 다릅니다. 아래 "유형별 판단"을 보시고, 지형도면에서 유형을 확인해 위 "성장관리계획 유형"을 고르면 결론이 하나로 나옵니다.', basis: '성장관리계획 시행지침 제7조' });
    }
    if (gv.env && act.id !== 65) {
      const b200 = turf.buffer(geom, 0.2, { units: 'kilometers' });
      const n = c.blds.filter(f => isHouse(f) && turf.booleanIntersects(f, b200)).length;
      const all = gv.env === '해당';
      steps.push({ k: '환경오염유발시설', st: all ? 'CK' : 'COND', text: `${all ? '' : '(' + gv.env.replace(/^해당\(|\)$/g, '') + '에 해당하면) '}주택 10호 이상 주거밀집지역·정온시설에서 200m 이상 떨어져야 합니다. 200m 안 주택 추정 ${n}동`, basis: '성장관리계획 시행지침 제13조' });
    }
  } else if (isBuilding && has(/성장관리/) && villages.length) {
    steps.push({ k: '성장관리', st: 'OK', text: '성장관리계획구역 안 취락지구는 성장관리 유형 대신 취락지구 건축제한을 적용합니다', basis: '성장관리계획 시행지침 제7조①' });
  } else if (isBuilding && has(/성장관리/) && !villages.length) {
    steps.push({ k: '성장관리', st: 'CK', text: '성장관리계획구역이 걸려 있으나 용도지역이 계획관리가 아닙니다. 걸친 범위 확인', basis: '' });
  }

  // 3) 태양광
  let solarInfo = null, solarRoofMinor = false;
  if (isSolar) {
    const buf = turf.buffer(geom, 0.2, { units: 'kilometers' });
    const in200 = c.blds.filter(f => turf.booleanIntersects(f, buf));
    const h200 = in200.filter(isHouse).length, u200 = in200.filter(isUnknown).length;
    let h300 = null, buf300 = null;
    if (c.legacy) { buf300 = turf.buffer(geom, 0.3, { units: 'kilometers' }); h300 = c.blds.filter(f => isHouse(f) && turf.booleanIntersects(f, buf300)).length; }
    solarInfo = { buf, buf300, h200, u200, h300 };
    const fBasis = '산지관리법 제12조(①임업용·②공익용산지), 제10조7호 나목 단서';
    if (forestFull && form !== 'roof') steps.push({ k: '산지(태양광)', st: 'NG', text: '보전산지(임업용·공익용)에는 태양광을 설치할 수 없습니다', basis: fBasis });
    else if (forestFull) steps.push({ k: '산지(태양광)', st: 'CK', text: '보전산지이나 기존 건축물 지붕 위 설치는 산지전용이 생기지 않으므로 건축물 적법 여부 확인', basis: fBasis });
    else if (forestPart) steps.push({ k: '산지(태양광)', st: 'CK', text: '필지 일부가 보전산지입니다. 그 부분은 태양광 설치 불가', basis: fBasis });
    const rural = has(/자연취락지구/);
    const legalEx = ['resident', 'roof', 'self'].includes(form);
    const ordEx = ['public', 'self', 'roof', 'village'].includes(form);
    const ruralStep = () => {
      if (hasFull(/자연취락지구/)) steps.push({ k: '이격거리(취락)', st: ordEx ? 'COND' : 'NG', text: ordEx ? '자연취락지구 안이지만 조례 제21조의2② 예외로 재량 허가 가능' : '자연취락지구 안이라 조례 제21조의2①2호 적용(불허 사유)', basis: '재생에너지법 시행령 제27조의3①2, 조례 제21조의2' });
      else if (rural) steps.push({ k: '이격거리(취락)', st: 'CK', text: '필지 일부가 자연취락지구에 걸칩니다. 걸친 부분은 조례 제21조의2①2호 적용', basis: '재생에너지법 시행령 제27조의3①2, 조례 제21조의2' });
    };
    if (!c.legacy) {
      ruralStep();
      if (legalEx) steps.push({ k: '이격거리(주택)', st: 'OK', text: `${formIs(form)}: 주택 이격거리를 적용하지 않습니다. (200m 안 주택 추정 ${h200}동)`, basis: '재생에너지법 제27조의3③' });
      else if (h200 >= 5) steps.push({ k: '이격거리(주택)', st: ordEx ? 'COND' : 'NG', text: `200m 안 주택 추정 ${h200}동 → 5호 이상이라 이격거리 적용` + (ordEx ? '. 조례 ② 예외로 재량 허가 가능' : ''), basis: '재생에너지법 제27조의3②, 영 제27조의3②1, 조례 제21조의2①3' });
      else if (h200 + u200 >= 5) steps.push({ k: '이격거리(주택)', st: 'CK', text: `200m 안 주택 추정 ${h200}동, 용도 미상 건물 ${u200}동 → 미상 건물에 따라 5호를 넘을 수 있음`, basis: '재생에너지법 시행령 제27조의3②1' });
      else steps.push({ k: '이격거리(주택)', st: 'OK', text: `200m 안 주택 추정 ${h200}동(용도 미상 ${u200}동) → 5호 미만이라 이격거리 적용 안 함`, basis: '재생에너지법 시행령 제27조의3②1' });
      field.push('태양광: 경지정리지구 안이면 불허될 수 있음(농정부서 확인, 조례 제21조의2①5)');
      field.push('태양광: 정식 신청 건은 고시 기준(1년 전입세대 없는 주택·멸실 제외)으로 주택 수를 다시 셈');
    } else {
      ruralStep();
      const bad = h300 >= 5 ? `300m 안 주택 추정 ${h300}동(5호 이상 → 300m 이격)` : (h200 >= 1 ? `5호 미만이지만 200m 안 주택 추정 ${h200}동(200m 이격)` : '');
      steps.push({ k: '이격거리(종전 조례)', st: bad ? (ordEx ? 'COND' : 'NG') : 'CK', text: (bad || `주택 이격은 해당 없음(300m 안 ${h300}동, 200m 안 ${h200}동)`) + ' · 도로 500m, 자연취락지구 경계 200m, 충주댐 500m, 경지정리지구는 확인 필요', basis: '조례 제21조의2①(2026. 9. 17. 이전 신청, 재생에너지법 부칙 제3조)' });
    }
    if (form !== 'roof') steps.push({ k: '태양광 공통', st: 'OK', text: '부지 경계 2m 이상 울타리(조례 제21조의2③) · 높이 5m 초과는 건축법 신고 공작물', basis: '조례 제21조의2③, 건축법 시행령 제118조①' });
    if (form === 'roof') {
      const m = minorCheck({ label: '공작물' }, baseZone || '', area, has, true);
      if (m) steps.push({ k: '허가 대상 여부', st: m.st, text: m.text, basis: '국토계획법 시행령 제53조2호' });
      else { const lim = structLimit(baseZone || '', has); steps.push({ k: '허가 대상 여부', st: 'COND', text: lim ? `무게 ${lim}톤·부피 ${lim}㎥·수평투영면적 ${lim}㎡가 모두 이하이면 경미한 행위(허가 대상 아님)입니다. 위 칸에 넣으면 바로 판정합니다` : '자연환경보전지역은 경미한 공작물 기준이 없어 허가 대상입니다', basis: '국토계획법 시행령 제53조2호' }); }
      solarRoofMinor = !!(m && m.st === 'NA');
    }
    // 보전관리·자연환경보전 등 조건부 입지(공공·자가소비·건축물 위)는 설치 형태로 다시 판정
    steps.forEach(s => { if (s.k.startsWith('용도지역') && s.st === 'COND' && /자가소비|공공/.test(s.text)) { const ok = solarFormAllowed(s.text, form); s.st = ok ? (s.zc ? 'COND' : 'OK') : 'NG'; s.text += ` → ${formIs(form)}: ${ok ? '가능' : '불가'}`; } });
  }

  // 4) 개발행위(건물 없이) 경미 판정
  if (!isBuilding && baseZone) {
    const m = minorCheck(act, baseZone, area, has);
    steps.push(m ? { k: '허가 대상 여부', st: m.st, text: m.text + (m.st === 'NA' ? ' · 개발행위허가만 해당(농지·산지 전용, 건축신고는 별도)' : ''), basis: '국토계획법 시행령 제53조' }
      : { k: '허가 대상 여부', st: 'COND', text: '규모를 모두 넣으면 경미한 행위인지 판정합니다. 지금은 "허가 대상일 수 있음"으로 봅니다', basis: '국토계획법 시행령 제53조' });
  }

  // 5) 구역 경고
  const warns = [];
  const skip = /^(도시지역|관리지역|농림지역|자연환경보전지역)$/;
  live.forEach(u => {
    if (ZONE_BY_API[u.name] || skip.test(u.name)) return;
    const w = R.warn.find(w => w.pat && new RegExp(w.pat).test(u.name)) || (isFacility(u) ? R.warn.find(x => /도시계획시설/.test(x.pat)) : null);
    let lv = w ? w.level : '정보';
    if (w && lv.startsWith('불가 가능성(축사)')) lv = act.row === LIVESTOCK_ROW ? '불가 가능성' : '정보';
    if (w && /성장관리|자연취락지구|보호취락지구/.test(w.pat)) lv = '정보';
    if (w && /자연재해위험개선지구/.test(w.pat) && /^(토지분할|물건 적치)/.test(act.label)) lv = '정보';
    if (lv.startsWith('불가') && resolved.some(x => u.name === x || (x === '임업용산지' && u.name === '보전산지'))) lv = '협의 필요';
    warns.push({ name: u.name + (isFacility(u) && !/^(대로|중로|소로|광로)/.test(u.name) ? '(도시·군계획시설)' : '') + (u.cn === '저촉' ? ' (일부 저촉)' : ''), lv, text: w ? w.text : '해당 법령에서 행위제한을 확인하십시오.', basis: w ? w.basis : '' });
  });
  const red = warns.filter(w => w.lv.startsWith('불가'));
  // 국토계획법 제64조①: 필지 전체가 도시·군계획시설 부지면 그 시설이 아닌 건축물·공작물은 허가할 수 없음
  const facFull = live.filter(u => u.cn === '포함' && isFacility(u));
  if (isBuilding && facFull.length) steps.push({ k: '도시·군계획시설 부지', st: 'CK', text: `필지 전체가 ${facFull.map(u => u.name).join('·')} 부지(도시·군계획시설)라 그 시설이 아닌 건축물·공작물은 허가할 수 없습니다. 예외(영 제61조, 미집행 시설의 가설건축물 등 법 제64조②)에 해당하는지 확인`, basis: '국토계획법 제64조, 영 제61조' });

  // 6) 개발행위 기준(정보)
  const crit = [];
  if (baseZone) {
    const lim = scaleLimit(baseZone);
    crit.push(['허가 규모', `${baseZone} 형질변경 ${fmt(lim)}㎡ 미만 (필지 ${area === mapArea ? '약 ' + fmt(area) : fmtA(area)}㎡)` + (area >= lim ? ' → 필지가 상한 이상, 형질변경 면적 확인' : ''), '영 제55조, 조례 제20조']);
    if (isSolar || act.label.startsWith('공작물')) {
      const sl = structLimit(baseZone, has);
      crit.push(['경미한 행위(공작물)', sl ? `무게 ${sl}톤·부피 ${sl}㎥·수평투영면적 ${sl}㎡ 모두 이하이면 개발행위허가 없이 설치 가능${form === 'roof' ? '' : '(높이 5m 넘는 태양광 등 건축법 신고 공작물은 제외)'}. 농지·산지 전용 등 다른 허가는 별도` : '자연환경보전지역은 경미한 공작물 기준이 없어 허가 대상', sl === 50 ? '영 제53조2호 가목(도시지역·지구단위계획구역)' : '영 제53조2호 나목(도시지역·자연환경보전지역·지구단위계획구역 외)']);
    }
    impactCrit(crit, baseZone, act, live, has, hasFull, lim, isSolar);
    const d = deliberation(baseZone, act, uses, hasFull);
    crit.push(['도시계획위원회', d.text, d.basis]);
    const b = R.bcr[baseZone];
    if (b) {
      let t = `건폐율 ${b[0]}% · 용적률 ${b[1]}%`;
      if (growthOn) t = '건폐율 40%(인센티브 시 최대 50%) · 용적률 100%(최대 125%)';
      if (villages.length) t = `건폐율 60%(취락지구) · 용적률 ${b[1]}%`;
      crit.push(['건폐율·용적률', t, '조례 제50·51·59·60조']);
    }
    // 건축법 제3조②: 도시지역·지구단위계획구역 밖의 동·읍이 아닌 지역(면)은 접도 규정(제44조) 미적용
    const noFrontage = (c.emd || '').endsWith('면') && !/주거|상업|공업|녹지/.test(baseZone) && !has(/지구단위계획/);
    if (ch && ch.roadSideCodeNm === '맹지' && noFrontage) {
      crit.push(['도로', `맹지입니다. ${c.emd}의 비도시지역이라 건축법 접도 규정(4m 도로에 2m 접함)은 적용하지 않지만, 조례 제22조의 도로·상하수도 기준은 확인해야 합니다`, '건축법 제3조②, 조례 제22조']);
      if (isBuilding && !isSolar) steps.push({ k: '도로(맹지)', st: 'CK', text: '맹지라 진입도로(조례 제22조) 확보 계획 확인 필요', basis: '조례 제22조, 영 별표 1의2' });
    } else if (ch && ch.roadSideCodeNm === '맹지') {
      crit.push(['도로', `맹지입니다. 건축하려면 너비 4m 이상 도로에 2m 이상 접해야 합니다(${isDong(c.emd) ? '동 지역이라' : (c.emd || '').endsWith('읍') ? '읍 지역이라' : /주거|상업|공업|녹지/.test(baseZone) ? '도시지역이라' : '지구단위계획구역이라'} 적용)`, '건축법 제44조, 제3조②']);
      if (isBuilding && !isSolar) steps.push({ k: '도로(맹지)', st: 'CK', text: '맹지라 진입도로 확보 계획이 있어야 건축 가능', basis: '건축법 제44조, 조례 제22조' });
    } else if (ch) crit.push(['도로', `도로 접면: ${ch.roadSideCodeNm}`, '토지특성']);
    if (jimok === '임야') crit.push(['경사도·입목축적', '임야는 산지관리법 기준(평균경사도 25도 이하, 입목축적 150% 이하 등) — 산림부서 협의', '산지관리법 시행령 별표 4']);
    else if (/계획관리/.test(baseZone) || zoneGroup(baseZone) === 'urban') crit.push(['경사도·입목축적', '계획관리·주거·상업·공업지역은 조례 제21조 적용 제외', '조례 제21조']);
    else crit.push(['경사도·입목축적', '최대경사도 36% 미만, 입목축적 150% 이하 — 경사분석도·산림조사서로 확인', '조례 제21조']);
  }

  // 결론
  const real = steps.filter(s => !s.info).map(s => s.st).filter(x => x !== 'SPLIT');
  let st = real.length ? real.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), real[0]) : (steps.length ? 'OK' : 'CK');
  const split = steps.some(s => s.st === 'SPLIT');
  if (solarRoofMinor && !steps.some(s => s.st === 'NG' && !s.info)) st = 'NA';
  const wasNA = st === 'NA';
  if (red.length && RANK[st] < RANK.CK) st = 'CK';
  let big = LABEL[st], why = '';
  const ng = steps.find(s => s.st === 'NG' && !s.info), ck = steps.find(s => s.st === 'CK' && !s.info);
  if (st === 'NG') why = ng.text;
  else if (wasNA && red.length) why = `국토계획법상 개발행위허가 대상은 아닙니다. 다만 ${red.map(w => w.name).join(', ')} 관련 허가·협의를 확인해야 합니다.`;
  else if (split && RANK[st] <= RANK.COND) { big = '성장관리 유형에 따라 다름'; why = '아래 세 유형 결과를 보고 안내해 주십시오.'; }
  else if (st === 'CK') why = red.length ? `불가 가능성 있는 구역: ${red.map(w => w.name).join(', ')}` : (ck ? ck.text : '');
  else if (st === 'COND') why = steps.filter(s => s.st === 'COND' && !s.info).map(s => (s.k.includes('→') ? s.k + ': ' : '') + s.text).join(' / ');
  else if (st === 'NA') why = (steps.find(s => s.st === 'NA') || {}).text || '';
  else why = '용도지역상 건축(설치)할 수 있는 용도입니다. 아래 개발행위 기준을 함께 안내하십시오.';
  const yel = warns.filter(w => w.lv.startsWith('협의')).length;
  const vcls = split && RANK[st] <= RANK.COND ? 'SPLIT' : st;

  // 현장 확인
  if (isBuilding && !isSolar) field.push('진입도로 폭·접도, 상하수도(조례 제22조), 배수·비탈면(조례 제23조)');
  if (!isBuilding) field.push('공사 규모(높이·면적·부피)와 지목변경 여부, 배수·비탈면');
  if (growthOn) field.push('성장관리 유형: 지형도면(제천 지형도면 모음)에서 확인');

  // ---------- 그리기 ----------
  const zchips = zoneUses.map(u => `<span class="chip z">${esc(u.name)}${u.cn === '저촉' ? ' (저촉)' : ''}</span>`).join('');
  const ochips = live.filter(u => !ZONE_BY_API[u.name]).map(u => `<span class="chip">${esc(u.name)}${u.cn === '저촉' ? ' (저촉)' : ''}</span>`).join('');
  const stepHtml = steps.map(s => `<div class="step"><div class="sh"><span class="tag s-${s.st}">${s.st === 'SPLIT' ? '유형별 다름' : LABEL[s.st]}</span><b>${esc(s.k)}</b></div>${esc(s.text)}${s.basis ? `<div class="basis">${esc(s.basis)}</div>` : ''}</div>`).join('');
  const warnHtml = warns.length ? warns.map(w => `<div class="warn ${w.lv.startsWith('불가') ? 'w-red' : w.lv.startsWith('협의') ? 'w-yel' : 'w-gray'}"><b>${esc(w.name)} · ${esc(w.lv)}</b>${esc(w.text)}${w.basis ? `<div class="basis">${esc(w.basis)}</div>` : ''}</div>`).join('') : '<div class="hint">다른 지역·지구·구역이 없습니다.</div>';
  const solarHtml = solarInfo ? `<div class="sub2"><b>태양광 이격거리 (${c.legacy ? '9. 17. 이전 신청 · 종전 조례' : '9. 18. 이후 신청 · 재생에너지법'})</b>
    <div class="kv" style="margin-top:6px"><span class="k">신청일</span><span>${esc(c.date)}</span><span class="k">설치 형태</span><span>${esc(FORM_NAME[form])}</span>
    <span class="k">200m 안</span><span class="num">주택 추정 <b>${solarInfo.h200}동</b> · 용도 미상 ${solarInfo.u200}동</span>
    ${c.legacy ? `<span class="k">300m 안</span><span class="num">주택 추정 <b>${solarInfo.h300}동</b></span>` : ''}</div>
    <div class="basis">${c.legacy ? '종전 조례: 5호 이상 300m / 5호 미만 200m, 도로 500m, 충주댐 500m, 자연취락지구 경계 200m, 경지정리지구' : '도로 500m·충주댐 500m·주택 300m 기준은 적용하지 않습니다. 주택 수는 건물 자료로 센 추정치입니다.'}</div></div>` : '';

  $('verdict').className = `verdict s-${vcls}`;
  $('verdict').innerHTML = `<div class="lab">${esc(act.label)} · ${esc(c.addr.replace('충청북도 제천시 ', ''))}</div><div class="big">${esc(big)}</div><div class="why">${esc(why)}${yel ? ` <span style="opacity:.8">· 협의 필요 구역 ${yel}건</span>` : ''}</div>`;
  // 카드: 판단 근거(가운데)·토지 정보(오른쪽)를 먼저 두고, 나머지는 그때그때 가장 짧은 열 아래에 붙임 (좁은 화면은 o1~o6 순서로 한 줄)
  const holder = document.createElement('div');
  holder.innerHTML = `
    <div class="card o2"><h2>판단 근거</h2>${stepHtml}${growthBox}${solarHtml}</div>
    <div class="card o5"><h2>개발행위 허가 기준</h2>${crit.map(r => `<div class="step"><b>${esc(r[0])}</b><div>${esc(r[1])}</div>${r[3] ? `<div class="basis" style="color:#4e5968">${esc(r[3])}</div>` : ''}<div class="basis">${esc(r[2])}</div></div>`).join('')}</div>
    <div class="card o3"><h2>토지 정보</h2><div class="kv">
      <span class="k">지목</span><span>${esc(jimok || '자료 없음')}</span>
      <span class="k">면적</span><span class="num">${esc(areaNote)}</span>
      <span class="k">도로 접면</span><span>${esc(ch ? ch.roadSideCodeNm : '자료 없음')}</span>
      <span class="k">용도지역</span><div class="chips">${zchips || '<span class="chip">확인 안 됨</span>'}</div>
      <span class="k">그 밖</span><div class="chips">${ochips || '-'}</div></div></div>
    <div class="card o6"><h2>현장 확인 필요</h2><ul class="field">${[...new Set(field)].map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
    <div class="card o4"><h2>구역별 주의</h2>${warnHtml}</div>`;
  // 이전 조회의 카드를 지우고 새 카드로 바꿈
  document.querySelectorAll('.board .card:not(.mapcard)').forEach(e => e.remove());
  boardCards = ['o2', 'o3', 'o5', 'o4', 'o6'].map(k => holder.querySelector('.' + k));
  $('result').classList.remove('hide');
  placeCards();

  // 지도
  initMap();
  $('mapTitle').textContent = c.addr;
  layer.clearLayers();
  const p = L.geoJSON(geom, { style: { color: '#ff3b30', weight: 3, fillOpacity: 0.12 } }).addTo(layer);
  const leg = ['<span><span class="sw" style="background:#ff3b30"></span>신청 필지</span>'];
  if (solarInfo) {
    L.geoJSON(solarInfo.buf, { style: { color: '#3182f6', weight: 2, dashArray: '6 4', fillOpacity: 0 } }).addTo(layer);
    if (solarInfo.buf300) L.geoJSON(solarInfo.buf300, { style: { color: '#8b95a1', weight: 2, dashArray: '2 4', fillOpacity: 0 } }).addTo(layer);
    let i = 0;
    c.blds.filter(f => turf.booleanIntersects(f, solarInfo.buf300 || solarInfo.buf)).forEach(f => {
      if (isHouse(f)) L.geoJSON(f, { style: { color: '#ffcc00', weight: 2, fillOpacity: 0.55 } }).bindTooltip(String(++i), { permanent: true, direction: 'center', className: '' }).addTo(layer);
      else if (isUnknown(f)) L.geoJSON(f, { style: { color: '#ffffff', weight: 2, dashArray: '3 3', fillOpacity: 0.2 } }).addTo(layer);
    });
    leg.push(`<span><span class="sw" style="border:2px dashed #3182f6"></span>${c.legacy ? '200m · 회색 300m' : '200m'}</span>`, '<span><span class="sw" style="background:#ffcc00"></span>주택 추정</span>', '<span><span class="sw" style="border:2px dashed #999"></span>용도 미상 건물</span>');
    map.fitBounds(L.geoJSON(solarInfo.buf300 || solarInfo.buf).getBounds());
  } else map.fitBounds(p.getBounds(), { maxZoom: 18 });
  $('legend').innerHTML = leg.join('');
  setTimeout(() => map.invalidateSize(), 50);
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
