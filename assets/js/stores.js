// 이벤트 참여 오토스테이 지점 데이터 (tools/build_stores.py 자동생성 - 직접 수정 금지)
// 좌표 출처: 카카오 로컬 API 지오코딩, 주소 정확매칭 + 시군구 검증 통과
// 생성 기준 파일: 오토스테이_지점별_반경분석(분석)_참여매장표시_260902.xlsx
// 지점 수: 15개 (수도권 12 / 비수도권 3 · 직영 7 / 가맹 8)

const STORES = [
  { id: "as-01", no: 1, name: "오토스테이 일산 풍동", addr: "경기도 고양시 일산동구 풍산로 11", hours: "08:00~22:00",
    type: "직영", region: "고양", zone: "수도권", group: "goyang", lat: 37.672153, lng: 126.787606 },
  { id: "as-02", no: 2, name: "오토스테이 하남 미사", addr: "경기도 하남시 미사강변중앙로 17", hours: "08:00~23:00",
    type: "직영", region: "하남", zone: "수도권", group: "north", lat: 37.548534, lng: 127.192088 },
  { id: "as-03", no: 3, name: "오토스테이 고양 삼송", addr: "경기도 고양시 덕양구 통일로 313", hours: "08:00~22:00",
    type: "직영", region: "고양", zone: "수도권", group: "goyang", lat: 37.662768, lng: 126.89261 },
  { id: "as-04", no: 7, name: "오토스테이 파주 운정", addr: "경기도 파주시 오도로 52", hours: "08:00~22:00",
    type: "가맹", region: "파주", zone: "수도권", group: "goyang", lat: 37.745524, lng: 126.723046 },
  { id: "as-05", no: 9, name: "오토스테이 자유로88", addr: "경기도 고양시 덕양구 자유로 88", hours: "08:00~23:00",
    type: "직영", region: "고양", zone: "수도권", group: "goyang", lat: 37.581899, lng: 126.854648 },
  { id: "as-06", no: 10, name: "오토스테이 대구 율하", addr: "대구광역시 동구 안심뉴타운4로 20", hours: "08:00~22:00",
    type: "가맹", region: "대구", zone: "비수도권", group: "daegu", lat: 35.874647, lng: 128.703606 },
  { id: "as-07", no: 16, name: "오토스테이 광명", addr: "경기도 광명시 하안로 12", hours: "08:00~23:00",
    type: "직영", region: "광명", zone: "수도권", group: "seoul", lat: 37.439567, lng: 126.895598 },
  { id: "as-08", no: 17, name: "오토스테이 서대구역", addr: "대구광역시 서구 와룡로 480", hours: "08:00~22:00",
    type: "가맹", region: "대구", zone: "비수도권", group: "daegu", lat: 35.87545, lng: 128.539807 },
  { id: "as-09", no: 18, name: "오토스테이 고양 화정", addr: "경기도 고양시 덕양구 충장로 402", hours: "08:00~22:00",
    type: "가맹", region: "고양", zone: "수도권", group: "goyang", lat: 37.648149, lng: 126.840255 },
  { id: "as-10", no: 19, name: "오토스테이 용인 신갈", addr: "경기도 용인시 기흥구 용구대로2193번길 9", hours: "08:00~22:00",
    type: "가맹", region: "용인", zone: "수도권", group: "south", lat: 37.283353, lng: 127.104375 },
  { id: "as-11", no: 20, name: "오토스테이 서울 성수", addr: "서울특별시 성동구 뚝섬로1나길 17", hours: "08:00~23:00",
    type: "직영", region: "서울", zone: "수도권", group: "seoul", lat: 37.544092, lng: 127.048896 },
  { id: "as-12", no: 24, name: "오토스테이 양주 광적", addr: "경기도 양주시 광적면 부흥로 836-8", hours: "08:00~21:00",
    type: "가맹", region: "양주", zone: "수도권", group: "north", lat: 37.817514, lng: 126.985862 },
  { id: "as-13", no: 27, name: "오토스테이 안성 석정", addr: "경기도 안성시 아양2로 86", hours: "08:00~23:00",
    type: "직영", region: "안성", zone: "수도권", group: "south", lat: 37.010097, lng: 127.257682 },
  { id: "as-14", no: 28, name: "오토스테이 구미 구평", addr: "경상북도 구미시 구평동 118-7", hours: "08:00~23:00",
    type: "가맹", region: "구미", zone: "비수도권", group: "daegu", lat: 36.092708, lng: 128.452316 },
  { id: "as-15", no: 29, name: "오토스테이 평택 죽백", addr: "경기도 평택시 죽백동 134-2", hours: "08:00~23:00",
    type: "가맹", region: "평택", zone: "수도권", group: "south", lat: 37.010633, lng: 127.135778 }
];
