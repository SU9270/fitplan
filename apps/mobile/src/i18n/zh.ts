/**
 * 中文文案。键的集合以本文件为准（`MessageKey`），`en.ts` 必须逐键对应。
 * 插值写成 `{name}`，由 `t()` 替换。
 */
export const zh = {
  'app.name': 'FitPlan',

  'lang.switch': 'English',
  'lang.switchLabel': '切换为英文',

  'auth.email.label': '邮箱',
  'auth.email.placeholder': 'you@example.com',
  'auth.password.label': '密码',
  'auth.password.placeholder': '至少 {min} 位',
  'auth.inviteCode.label': '邀请码',
  'auth.inviteCode.placeholder': '向朋友要一个邀请码',

  'auth.signIn.title': '欢迎回来',
  'auth.signIn.subtitle': '登录后继续你的健身饮食计划',
  'auth.signIn.submit': '登录',
  'auth.signIn.toSignUp': '还没有账号？用邀请码注册',

  'auth.signUp.title': '创建账号',
  'auth.signUp.subtitle': 'FitPlan 目前仅限邀请注册',
  'auth.signUp.submit': '注册',
  'auth.signUp.toSignIn': '已有账号？去登录',

  'auth.signOut': '退出登录',

  'auth.error.emailInvalid': '请输入有效的邮箱地址',
  'auth.error.passwordRequired': '请输入密码',
  'auth.error.passwordTooShort': '密码至少需要 {min} 位',
  'auth.error.inviteRequired': '注册需要邀请码',
  'auth.error.inviteExhausted': '邀请码无效或已用完，请换一个',
  'auth.error.invalidCredentials': '邮箱或密码不正确',
  'auth.error.emailTaken': '这个邮箱已经注册过了，请直接登录',
  'auth.error.tooManyRequests': '尝试次数过多，请稍后再试',
  'auth.error.network': '连不上服务器，请检查网络后重试',
  'auth.error.unknown': '出了点问题，请稍后再试',

  'gate.loading': '正在加载…',
  'gate.error.title': '暂时无法读取你的资料',
  'gate.error.retry': '重试',

  'onboarding.goal.title': '设定你的目标',
  'today.title': '今日',

  'report.kcal': '{n} 千卡',
} as const;

export type MessageKey = keyof typeof zh;
