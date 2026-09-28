// 샘플 직원 시드 데이터. birthDate 가 null 인 경우는 원본에서 "(확인되지 않음)".
// 로그인 ID 는 사번이고 원본에 이메일이 없으므로 이메일은 비워 둔다.
export interface SeedEmployee {
  employeeNumber: string;
  name: string;
  birthDate: string | null;
}

export const SEED_EMPLOYEES: SeedEmployee[] = [
  { employeeNumber: 'EMP-001', name: '김민준', birthDate: '1990-03-15' },
  { employeeNumber: 'EMP-002', name: '김민준', birthDate: '1994-11-02' }, // 동명이인
  { employeeNumber: 'EMP-003', name: '남궁서준', birthDate: '1988-07-21' },
  { employeeNumber: 'EMP-004', name: '황보라온', birthDate: '1995-02-09' },
  { employeeNumber: 'EMP-005', name: '김솔', birthDate: '1992-12-30' },
  { employeeNumber: 'EMP-006', name: '선우진', birthDate: '1991-05-05' },
  { employeeNumber: 'EMP-007', name: '이서연', birthDate: null },
  { employeeNumber: 'EMP-008', name: '박민준', birthDate: '1993-08-17' },
  { employeeNumber: 'EMP-009', name: '최지우', birthDate: '1996-04-03' },
  { employeeNumber: 'EMP-010', name: '정하윤', birthDate: '1989-10-11' },
];
