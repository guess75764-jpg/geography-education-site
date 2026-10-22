import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  // 안전장치: 브라우저로 나가는 VITE_ 변수에 비밀 키가 들어가면 빌드를 멈춘다.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  for (const [name, value] of Object.entries(env)) {
    if (value.startsWith('sb_secret_') || value.includes('service_role')) {
      throw new Error(
        `${name} 에 Supabase 비밀 키가 들어 있습니다. 브라우저에는 공개용(sb_publishable_) 키만 넣으세요.`,
      );
    }
  }

  // npm run build:html → 스크립트·스타일·지도·캐릭터 이미지를 모두 담은 HTML 파일 하나 (dist-single/index.html)
  if (mode === 'single') {
    return {
      plugins: [react(), viteSingleFile()],
      build: { outDir: 'dist-single', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
    };
  }
  return { plugins: [react()] };
});
