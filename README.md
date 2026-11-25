# AVING KES — avingkes.news

AVING이 보도한 **KES(Korea Electronics Show, 한국전자전 · 서울 COEX)** 영문 기사를 모아 보여주는 디스커버리 허브입니다.
[avingfix.news](https://avingfix.news/)(저장소 `tec-create/aving-fix`)와 같은 구조입니다: 빌드 없는 정적 사이트 + JSON 데이터 + 클라이언트 렌더링.
기사 목록에서 사이트 안 본문을 읽고, 원문 링크로 us.aving.net 보도를 확인할 수 있습니다.

## 폴더 구조

```
aving-kes/
├─ index.html              # 페이지 뼈대 (헤더/검색/플레이어/푸터)
├─ assets/
│  ├─ style.css            # Dibo aving@KES 기준의 다크 아카이브, 블루 강조색
│  ├─ app.js               # 렌더링 + 해시 라우팅 + 검색 + 영상 플레이어
│  ├─ favicon.svg
│  └─ og.png               # SNS 공유 이미지 (1200x630)
├─ data/
│  ├─ stories.json         # 사이트가 읽는 데이터 (meta + items)
│  └─ body/<id>.json       # 기사 본문 (기사 페이지를 열 때만 읽음)
├─ scripts/
│  ├─ update-kes.mjs       # us.aving.net에서 KES 기사 재수집 (1.5초/건)
│  └─ raw-kes.json         # 수집 원본 캐시 (다음 업데이트 때 새 기사만 요청)
└─ vercel.json             # 캐시 헤더, www → 루트 도메인 리다이렉트
```

## 페이지(해시 라우팅)

| 주소 | 내용 |
|---|---|
| `/#/` | 홈: KES·연도 타이포그래피 + 전시 소개 → 동일 크기 기사 카드 → Innovation Awards → 대표 영상 → 연도별 에디션 → 추가 기사 |
| `/#/edition/2026` | 연도별 에디션 (섹션 필터) |
| `/#/awards` | KES Innovation Awards 수상 기사 |
| `/#/videos` | 영상이 있는 기사 |
| `/#/all` | 전체 기사 |
| `/#/article/12345` | 기사 본문 |

검색: 우측 상단 돋보기 또는 키보드 `/`, `Ctrl+K`.

## 로컬에서 보기

```bash
cd aving-kes
npx serve .        # 또는: python -m http.server 8080
```
`file://`로 바로 열면 JSON fetch가 막히니 꼭 로컬 서버로 여세요.

## 처음 받은 뒤 꼭 한 번 실행 (기사 본문 채우기)

초기 데이터는 기사 목록(`data/stories.json`)만 들어 있고 `data/body/`는 비어 있습니다.
본문이 없으면 기사 페이지에 요약 + "AVING USA에서 전체 읽기" 버튼이 나옵니다.
아래 명령을 한 번 실행하면 KES 기사 52건의 본문을 1.5초 간격으로 받아 `data/body/`를 채웁니다 (약 3분).

```bash
node scripts/update-kes.mjs --yes
```

## 데이터 업데이트 (새 KES 기사 반영)

```bash
node scripts/update-kes.mjs          # 예상 요청 횟수 출력 → y 입력 시 진행
node scripts/update-kes.mjs --yes    # 확인 없이 진행
node scripts/update-kes.mjs --build  # 네트워크 없이 stories.json만 재생성
```

### 수집 기준 (중요)

us.aving.net 검색은 **부분 일치**라서 `KES`로 검색하면 `makes`, `likes` 같은 단어가 든 기사와 CES 기사까지 함께 나옵니다
(2026-11-23 기준 검색 결과 778건 중 실제 KES 기사는 일부).

1. **CES 기사 제외**: 제목에 `CES`가 들어간 기사는 상세 요청도 하지 않고 버립니다. (CES Asia Unveiled Seoul 처럼 KES 현장 행사여도 제목에 CES가 있으면 제외)
2. **KES 기사 판별**: 아래 중 하나에 해당하면 사용
   - 제목/리드에 `KES`(대문자) 또는 `Korea Electronics Show`
   - 본문에 KES 언급이 2회 이상이고 CES 언급보다 많음
3. **에디션 연도**: 제목의 `KES 20xx` → 본문의 `KES 20xx` → 기사 날짜 순으로 판단
4. **태그**: 제목/리드에 `Innovation Award` → awards, 제목에 `Interview` → interview

- 요청 간격 1.5초, 이미 받은 기사는 다시 요청하지 않습니다.
- 업데이트 후 `git commit` + `git push` 하면 Vercel이 자동 배포합니다.

## 배포 (GitHub → Vercel → Namecheap)

1. **GitHub**: `tec-create/aving-kes` 저장소 생성 → 이 폴더를 push
   ```bash
   git init -b main
   git add .
   git commit -m "Initial AVING KES site"
   git remote add origin https://github.com/tec-create/aving-kes.git
   git push -u origin main
   ```
2. **Vercel**: Add New → Project → GitHub `aving-kes` Import
   - Framework Preset: **Other**, Build Command: 비움, Output Directory: 비움(루트)
3. **도메인**: Vercel 프로젝트 → Settings → Domains → `avingkes.news`, `www.avingkes.news` 추가
4. **Namecheap**: Domain List → Manage → Advanced DNS (Vercel Domains 화면에 표시되는 값 기준)
   - `A` / Host `@` / Value `76.76.21.21`
   - `CNAME` / Host `www` / Value `cname.vercel-dns.com`
   - 반영까지 수 분~수 시간. SSL은 Vercel이 자동 발급.
