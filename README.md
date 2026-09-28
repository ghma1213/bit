# 직원 관리 시스템

직원 포털(User Portal) + 관리자 대시보드(Admin Dashboard). 프론트엔드/백엔드를 별도 패키지로 완전히 분리한 구조.

## 스택 (LTS/안정 버전 기준)

| 구분 | 기술 |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind v4 + shadcn/ui, React Router, TanStack Query, React Hook Form + Zod |
| Backend | NestJS 11, TypeScript, Prisma 7, express-session + connect-pg-simple, argon2, Zod(환경변수 검증) |
| DB | PostgreSQL 17 (Docker) |
| Runtime | Node.js LTS (`.nvmrc` = 24, 최소 22.13) |

Nest 12, Prisma 8(rc)은 LTS/stable 기준에 맞지 않아 사용하지 않는다 (Nest 11 / Prisma 7.10 고정).

## 구조

```
.
├── backend/    NestJS API 서버 (독립 패키지, 포트 3000, prefix /api)
├── frontend/   React SPA (독립 패키지, 포트 5173, 개발 시 /api → 3000 프록시)
└── docker-compose.yml   PostgreSQL
```

> `swagger.yaml`(Background Check API 명세)은 과제용으로 개별 제공된 파일이라 이 저장소에는 포함하지 않았습니다. 로컬에서 참고하려면 별도로 받은 파일을 프로젝트 루트에 두면 됩니다.

- 프론트와 백엔드는 코드/타입을 공유하지 않고 **HTTP API(+Swagger)로만** 통신한다.
- 인증은 서버 세션(HttpOnly 쿠키, Postgres 저장). 프론트는 토큰을 저장하지 않는다.

## 실행

```bash
# 1) DB
docker compose up -d --wait

# 2) 백엔드
cd backend
cp .env.example .env        # SESSION_SECRET 을 반드시 교체 (openssl rand -hex 32)
npm install
npx prisma migrate dev
npm run prisma:seed         # 초기 관리자(ADM-001) + 샘플 직원 EMP-001~010 (production 에서는 샘플 건너뜀)
npm run start:dev           # http://localhost:3000/api/health , Swagger: /api/docs

# 3) 프론트엔드
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## 배경조회 (Background Check)

- 외부 API 는 **백엔드가 중계**한다. `X-Candidate-Key` 는 `backend/.env` 의 `BACKGROUND_CHECK_API_KEY` 에만 두고 프론트/저장소에는 넣지 않는다.
- 키가 없으면 관련 API 가 503(연동 미설정)을 반환한다.
- 관리자 전용. 결과(범죄 이력·신용 등급 등)는 저장하지 않고 매번 외부에서 조회하며, 요청/조회는 감사 로그에 남는다.
- 요청 전에 관리자가 성/이름(서버가 규칙으로 나눈 제안값)을 확인·수정한다. 이름은 DB 에 `name` 하나로 저장하고 외부 전송 시에만 나눈다.
- 등록된 생년월일이 없으면 요청 모달에서 `YYYY-MM-DD` 로 입력받아 이번 요청에만 사용한다(직원 정보에 저장하지 않음).

## 로그인

- 로그인 ID 는 **사번**이다 (대소문자/앞뒤 공백 무시). 이메일은 연락용 선택 필드.
- 개발용 계정: 관리자 `ADM-001` (비밀번호 `.env` 의 `SEED_ADMIN_PASSWORD`), 샘플 직원 `EMP-001`~`EMP-010` (`SEED_EMPLOYEE_PASSWORD`).
- 관리자가 만든 계정은 임시 비밀번호가 발급되고, 첫 로그인 시 비밀번호를 변경해야 다른 API 를 쓸 수 있다.

## 범위 — 넣은 것 / 뺀 것

과제 안내에 "완성도보다 판단의 근거를 본다"는 기준이 있어서, 시간 배분을 어떻게 했는지 명시한다.

**넣은 것**
- 인증/세션: 사번 로그인, argon2, session fixation 방지, 퇴사자 즉시 차단(매 요청 DB 재검증), 로그인 시도 제한 + 계정 잠금(원자적 SQL), CSRF(SameSite+Origin 검증)
- 접근 제어: 전역 `AuthGuard`/`RolesGuard`, IDOR 방지(`/api/me`는 ID 파라미터 없음)
- 직원 포털: 본인 정보 조회/수정(연락처·주소), 비밀번호 변경(임시 비밀번호 강제 변경 포함), 변경 이력 감사 로그
- 관리자: 계정 생성(임시 비밀번호 1회 발급), 목록/상세(검색·필터·페이지네이션), 퇴사 처리(멱등성, 자기 자신/마지막 관리자 보호)
- Background Check 연동: 요청/이력/결과, 실제 외부 API로 검증, 이름 분리·불일치 검증, 생년월일 입력 모달, 실측(MEASUREMENTS.md) 기반 타임아웃/재시도/폴링 정책
- 배포: GCP Compute Engine + Nginx(리버스 프록시) + HTTPS, GitHub 저장소

**뺀 것**
- 관리자의 **기존 직원 정보 수정** 화면(이름/부서/직책/권한) — 계정 생성과 퇴사 처리만 가능하고, 한 번 등록된 정보는 관리자도 고칠 방법이 없다
- 계정 잠금 수동 해제 API, 임시 비밀번호 재발급 API
- 전역 예외 필터, 요청 로깅(PII 마스킹), 만료 세션 정리 배치
- 자동화된 프론트엔드 테스트(Playwright E2E) — 브라우저 수동 검증만 수행. 백엔드는 단위/통합 테스트 있음
- 다중 서버 환경 대비 동시성 락(현재는 프로세스 내부 메모리 기반이라 서버 1대 가정)
- 백엔드 Dockerfile, 접근성/번들 최적화

각 항목이 왜 빠졌는지(우선순위 판단)는 [TODO.md](TODO.md)의 해당 섹션에 남겨 두었다.

## 주의

- `backend/src/generated/` 는 `prisma generate` 결과물이며 git 에 포함하지 않는다 (`postinstall`/`build` 에서 자동 생성).
- 로컬 Node 가 22.13 미만이면 일부 의존성이 `EBADENGINE` 을 낸다. `.nvmrc` 의 LTS 로 맞출 것.
- `.env` 의 시드 계정/DB 비밀번호는 개발 전용 값이다.
