import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 인증 없이 접근 가능한 라우트. 기본값은 "인증 필수"다. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
